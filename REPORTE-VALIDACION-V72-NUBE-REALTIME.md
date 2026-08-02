# RC ORDERA v72 - validacion de nube, tiempo real y eliminacion

Fecha de revision: 1 de agosto de 2026.

## Problemas encontrados y corregidos

- El cliente mostraba un restaurante como abierto mediante texto fijo. Ahora usa el estado operativo confirmado en Supabase.
- El directorio podia conservar o preferir un registro antiguo. Ahora usa el registro mas reciente, elimina duplicados visuales y descarta una seleccion que ya no existe.
- `active=false` se utilizaba para cerrar y tambien para eliminar. Ahora `active` identifica una cuenta vigente, `operational_open` abre o cierra la atencion y `deleted_at` identifica una eliminacion.
- El cierre operativo no eliminaba la cuenta y la eliminacion anterior no borraba Supabase Auth. Ahora son acciones diferentes.
- Los cambios de perfil, menu y configuracion se enviaban por escrituras separadas. La migracion v72 agrega un guardado atomico y devuelve los datos confirmados por el servidor.
- El registro del cliente quedaba cortado en movil por un centrado doble de los dialogos. Se corrigio y se valido a 390 x 844.
- La direccion obtenida por GPS podia perderse si fallaba la geocodificacion. Ahora conserva las coordenadas y permite continuar con entrada manual.
- El administrador podia tener el rol correcto pero el correo sin confirmar. Se agrego una migracion controlada para confirmar solamente la cuenta autorizada y restaurar su rol.

## Archivos principales modificados

- `index.html`, `app.js`, `styles.css`
- `cliente.html`, `cliente.js`, `cliente-manifest.webmanifest`
- `colaborador.html`, `colaborador-manifest.webmanifest`
- `manifest.webmanifest`, `admin-manifest.webmanifest`, `service-worker.js`
- `vercel.json`, `.vercelignore`
- `MIGRACION-FASE1-V72-NUBE-HORARIOS-REALTIME.sql`
- `MIGRACION-FASE1-V72-RECUPERAR-ADMIN-UNICO.sql`
- `supabase/functions/delete-own-restaurant-account/index.ts`
- `supabase/config.toml`
- `GUIA-PUESTA-EN-MARCHA-V72.md`

## Validaciones realizadas

- Todos los archivos JavaScript pasan la validacion sintactica de Node.js.
- Todos los manifiestos y `vercel.json` son JSON validos.
- No existen identificadores HTML duplicados en las cinco pantallas.
- No hay `service_role`, claves `sb_secret`, clave privada de Google ni contrasena administrativa en el frontend.
- La URL de Supabase usa la raiz del proyecto y no `/rest/v1/`.
- Pantalla inicial validada con tres accesos separados: restaurante, cliente y colaborador.
- Directorio real consultado desde Supabase: una sola tarjeta visible para RINCON COLOMBIANO y estado `Cerrado`.
- Cliente, colaborador y administracion no presentan desbordamiento horizontal a 390 px.
- Registro de cliente validado visualmente desde el titulo hasta el formulario desplazable.
- Administracion no publica el correo del propietario en la pantalla.
- El menu y el estado del restaurante tienen suscripciones Realtime filtradas por `user_id`.
- La funcion de eliminacion exige sesion valida, contrasena revalidada y la confirmacion `ELIMINAR`.

## Migraciones requeridas

Ejecutar, en este orden y una sola vez, desde Supabase SQL Editor:

1. `MIGRACION-FASE1-V72-NUBE-HORARIOS-REALTIME.sql`
2. `MIGRACION-FASE1-V72-RECUPERAR-ADMIN-UNICO.sql`

Despues desplegar la Edge Function `delete-own-restaurant-account`. Sin este despliegue, el boton de eliminacion se detiene y deja la cuenta intacta.

## Limites de esta validacion

- Las migraciones no se ejecutaron automaticamente contra la base productiva porque requieren acceso autorizado al proyecto Supabase.
- El envio de correo no puede validarse hasta configurar SMTP y las URL autorizadas en Supabase.
- No se realizo una eliminacion real de una cuenta productiva ni se probaron acciones autenticadas sin credenciales de prueba.
- La creacion del pedido sigue recibiendo el total calculado por el cliente. Antes de habilitar pagos en linea debe agregarse recalculo de precios en el servidor.
- El corte automatico fisico depende de que la impresora y su controlador admitan la orden de corte; la impresion web no puede garantizarlo para todos los modelos.

## Resultado

El paquete local v72 esta preparado para despliegue. La sincronizacion, el acceso administrativo y la eliminacion definitiva quedaran habilitados cuando se ejecuten las dos migraciones y se despliegue la Edge Function siguiendo `GUIA-PUESTA-EN-MARCHA-V72.md`.
