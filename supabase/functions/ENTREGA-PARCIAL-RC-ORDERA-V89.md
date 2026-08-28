# RC ORDERA V89 - Entrega estabilizada

## Cambios incluidos

- Guardado del menu serializado para evitar escrituras simultaneas.
- Deteccion y conciliacion de cambios realizados desde varios equipos.
- Confirmacion de que el menu guardado quedo publicado para el cliente.
- Reconexion controlada de Supabase Realtime en el menu del cliente.
- Fotografias de platos y logo almacenadas como archivos estables en Supabase Storage.
- Migracion automatica de imagenes base64 existentes al volver a guardar el menu.
- Compresion de imagenes antes de subirlas.
- Carga inicial del restaurante paralelizada sin reducir el historial.
- Reutilizacion de solicitudes simultaneas del directorio y menu del cliente.
- PWA y carpeta `www` sincronizadas con la version V89.

## Migraciones que se deben ejecutar en Supabase

1. `MIGRACION-V88-01-SINCRONIZACION-MENU-PUBLICO.sql`
2. `MIGRACION-V89-01-FOTOS-MENU-RAPIDAS-Y-PERSISTENTES.sql`
3. Ejecutar `VALIDACION-V88-MENU-REALTIME.sql`.
4. Ejecutar `VALIDACION-V89-FOTOS-Y-RENDIMIENTO.sql`.

Las migraciones son incrementales y no eliminan tablas ni datos. La migracion V89 crea el bucket publico `restaurant-media`, limita las imagenes a 2 MB y permite que cada restaurante escriba solamente dentro de su propia carpeta.

## Pruebas ejecutadas

- Sintaxis de los modulos de restaurante, cliente, colaborador, mesero, administrador, traduccion y PWA.
- QA estructural V89: 201 comprobaciones aprobadas.
- QA de idiomas sin conexion: 1.988 comprobaciones aprobadas.
- Sincronizacion de 33 archivos web para Android/Capacitor.

## Limites de esta entrega

- Las migraciones no fueron ejecutadas en el proyecto Supabase productivo desde este equipo.
- No se hizo una compra real ni una prueba real de Stripe.
- No se pudo validar un guardado entre dos dispositivos contra la base productiva sin acceso a las sesiones de prueba.
- La version debe desplegarse en Vercel despues de ejecutar las migraciones para que las fotos nuevas sean persistentes.

## Despliegue

1. Ejecutar las migraciones y validaciones en Supabase en el orden indicado.
2. Desplegar el contenido de esta carpeta en Vercel.
3. Iniciar sesion como restaurante, editar un producto, subir una foto y guardar.
4. Abrir el mismo restaurante en `cliente.html` desde otro dispositivo y confirmar que nombre, precio y foto aparecen sin recargar.
