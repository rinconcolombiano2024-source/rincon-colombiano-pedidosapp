# RC ORDERA v72: Supabase y Vercel

Esta guia deja una sola plataforma y tres aplicaciones instalables: Restaurante, Cliente y Colaborador. Comparten el mismo Supabase y el mismo despliegue, pero cada perfil abre su propia pantalla.

## 1. Copia de seguridad

Antes de ejecutar SQL, descarga una copia de la base de datos desde Supabase o conserva una exportacion del proyecto. La migracion V72 es incremental y no usa `drop table`, pero la copia sigue siendo obligatoria antes de cambios productivos.

## 2. Ejecutar la migracion principal

1. Entra a Supabase.
2. Abre `SQL Editor`.
3. Pulsa `New query`.
4. Abre el archivo `MIGRACION-FASE1-V72-NUBE-HORARIOS-REALTIME.sql`.
5. Copia todo el contenido en la consulta nueva.
6. Pulsa `Run` una sola vez.
7. Al final debe aparecer el directorio de restaurantes sin error.

Esta migracion agrega apertura operativa, horario, coordenadas, persistencia atomica, directorio sin duplicados visibles y sincronizacion Realtime.

## 3. Recuperar el administrador unico

1. Crea otra consulta en `SQL Editor`.
2. Copia `MIGRACION-FASE1-V72-RECUPERAR-ADMIN-UNICO.sql`.
3. Pulsa `Run` una sola vez.
4. El resultado debe indicar `CORREO_CONFIRMADO` y `active`.

La migracion solo confirma la cuenta exacta existente y activa su rol. No cambia la contrasena. Despues entra desde la app publicada:

`https://rincon-colombiano-pedidosapp.vercel.app/admin.html`

No pruebes recuperacion desde `file://`, porque Supabase solo admite enlaces HTTP o HTTPS autorizados.

Si la contrasena sigue siendo incorrecta, configura SMTP como se explica abajo y usa `Recuperar contrasena`. No escribas la contrasena en JavaScript, SQL, GitHub ni Vercel.

## 4. Desplegar la funcion de eliminacion

La eliminacion completa necesita la Edge Function `delete-own-restaurant-account`. La clave privada permanece dentro de Supabase.

Opcion con Supabase Dashboard:

1. Abre `Edge Functions`.
2. Crea una funcion llamada exactamente `delete-own-restaurant-account`.
3. Copia el contenido de `supabase/functions/delete-own-restaurant-account/index.ts`.
4. Activa la validacion JWT.
5. Pulsa `Deploy`.

Supabase proporciona automaticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a sus Edge Functions. Nunca copies `service_role` a `supabase-config.js`.

## 5. Configuracion de Authentication

En `Authentication > URL Configuration` usa:

- Site URL: `https://rincon-colombiano-pedidosapp.vercel.app`
- Redirect URL: `https://rincon-colombiano-pedidosapp.vercel.app/**`
- Desarrollo opcional: `http://127.0.0.1:4177/**`

En `Authentication > Providers > Email`:

- Activa Email.
- Activa confirmacion de correo para cuentas nuevas.
- Mantiene habilitada la recuperacion de contrasena.

## 6. Configurar el envio de correos

El correo de prueba de Supabase tiene limites y puede no enviar a todos los destinatarios. Para produccion configura SMTP en `Project Settings > Authentication > SMTP Settings`.

Con Gmail:

- Host: `smtp.gmail.com`
- Puerto: `465` con SSL o `587` con STARTTLS, segun la opcion mostrada por Supabase.
- Usuario: la cuenta de Gmail autorizada.
- Contrasena: una contrasena de aplicacion de Google, no la contrasena normal.
- Nombre del remitente: `RC ORDERA`.

La cuenta de Google debe tener verificacion en dos pasos para crear una contrasena de aplicacion. Guarda ese secreto solo en Supabase.

Despues prueba en este orden:

1. Enviar recuperacion desde `admin.html` publicado.
2. Revisar entrada, spam y promociones.
3. Revisar `Authentication > Logs` si no llega.
4. Confirmar que la URL de redireccion pertenece a Vercel.

## 7. API y claves publicas

`supabase-config.js` debe contener solamente:

- URL base: `https://ouulrehcgmfbettseibn.supabase.co`
- Publishable key que empieza por `sb_publishable_`.

No agregues `/rest/v1/` a la URL. No uses `sb_secret_` ni `service_role` en el navegador.

## 8. Realtime

La migracion agrega `restaurant_profiles` y `app_settings` a `supabase_realtime` si faltan. Para comprobarlo:

1. Abre `Database > Publications`.
2. En `supabase_realtime` confirma `restaurant_profiles`, `app_settings` y `customer_orders`.
3. Abre Restaurante y Cliente en dos dispositivos.
4. Cambia precio o disponibilidad y guarda.
5. Abre o cierra la atencion.
6. El cliente debe actualizar menu y estado sin recargar.

## 9. Storage

El bucket `courier-documents` debe ser privado. Las politicas del esquema permiten que el colaborador gestione su carpeta y el administrador autorizado cree enlaces temporales. No marques el bucket como publico.

## 10. Configurar Vercel

Si GitHub contiene todo el repositorio, configura en Vercel:

- Framework Preset: `Other`.
- Root Directory: `outputs/rincon-colombiano-app`.
- Build Command: vacio.
- Output Directory: `.`.
- Install Command: vacio.

Si el repositorio de GitHub contiene directamente los archivos de la app, deja Root Directory vacio.

El archivo `vercel.json` evita conservar HTML o el service worker antiguo. `.vercelignore` impide publicar SQL y el codigo fuente de la Edge Function como archivos web.

Despues de desplegar:

1. Abre la URL de Vercel.
2. Pulsa `Actualizar` dentro de la app.
3. Cierra y vuelve a abrir la PWA instalada.
4. Si conserva v71, elimina una vez la app instalada y vuelve a instalarla.

## 11. Prueba de apertura y cierre

1. Inicia sesion en Restaurante.
2. Abre `Editar menu`.
3. Define el horario y pulsa `Guardar horario`.
4. Pulsa `Abrir atencion`.
5. En Cliente debe aparecer `Abierto`.
6. Pulsa `Cerrar atencion`.
7. En Cliente debe aparecer `Cerrado` y se bloquea el envio de pedidos nuevos.

Cerrar atencion no elimina el restaurante. `Eliminar restaurante` solicita contrasena y la palabra `ELIMINAR`, llama a la Edge Function y solo muestra exito si Supabase borro Auth y los datos asociados.

## 12. Una plataforma o tres proyectos

No conviene dividir ahora RC ORDERA en tres repositorios ni tres bases de datos. Eso duplicaria autenticacion, traducciones, pedidos y sincronizacion.

La configuracion recomendada ya aplicada es:

- Un repositorio.
- Un proyecto Supabase.
- Un despliegue Vercel.
- Pantallas separadas para Cliente, Restaurante, Colaborador y Administracion.
- Manifiestos PWA separados para instalar Cliente, Restaurante y Colaborador como aplicaciones diferentes.

Mas adelante pueden usarse subdominios como `cliente`, `restaurante` y `colaborador`, conservando el mismo backend y el mismo codigo compartido.

