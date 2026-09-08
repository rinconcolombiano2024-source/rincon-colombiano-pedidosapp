# Mejora acotada de refresco central

Se modificaron app.js y www/app.js por igual, exclusivamente en scheduleCentralRefresh y sus dos variables de control.

- Los eventos acumulados comparten un temporizador, sin reiniciarlo continuamente.
- Los refrescos programados quedan separados por al menos 5 segundos.
- Se conservan los ambitos pendientes de pedidos, ajustes y perfil.
- No se modifican guardado, combinacion de pedidos, menu, horarios ni estaciones.
- Se conservan las correcciones P0 del paquete anterior.

Limite: reduce las lecturas masivas durante rafagas; no elimina la lectura de hasta 250 pedidos ni limita otras rutas de consulta. No garantiza un porcentaje de reduccion de CPU en Supabase. Los cambios remotos pueden esperar hasta 5 segundos en esta ruta.

Pruebas locales: sintaxis de app.js y www/app.js aprobada; 7 pruebas de refresco y recuperacion de checkout aprobadas; QA V91 aprobado. npm run qa sigue fallando en las traducciones sin cobertura de index.html, ajenas a este cambio.

No se desplego ni se modifico Supabase. Seguir las instrucciones de instalacion P0 incluidas para los cambios anteriores.
