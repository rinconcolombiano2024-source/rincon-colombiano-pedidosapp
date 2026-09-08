# Correccion acotada de CPU y sincronizacion — ZIP 20

Base exclusiva: rincon-colombiano-pedidosapp-main (20).zip.

## Cambios

- app.js y www/app.js: INSERT/UPDATE completos de orders recibidos por Realtime actualizan solo el pedido recibido, sin descargar los 250 pedidos.
- Conserva las ediciones pendientes locales y no las confirma mediante notificaciones.
- Ignora eventos de otro restaurante, pedidos borrados localmente y revisiones iguales o anteriores.
- Agrupa el renderizado de rafagas en un temporizador y reutiliza el guardado diferido existente.
- Conserva el refresco de respaldo limitado a 5 segundos ante eventos incompletos o cargas concurrentes; conserva recuperacion completa al reconectar.
- El refresco completo conserva _syncRevision del servidor, evitando perder la referencia de revision.
- No se cambiaron SQL, pagos, permisos, horarios, menu, rutas de estaciones ni autenticacion.

## Pruebas

- node --check app.js y node --check www/app.js: aprobados.
- node --test tests/central-order-incremental.test.cjs: 6 aprobadas; incluye 100 eventos, pendientes locales, revisiones, concurrencia y aislamiento del restaurante.
- app.js y www/app.js identicos por SHA-256.
- npm run qa: falla por las dos comprobaciones de recuperacion de checkout. El checkout del ZIP 20 no contiene la correccion unfinishedAttempt del paquete anterior. No se alteraron estas pruebas ni el checkout.
- qa-i18n-v87.cjs: falla por textos sin cobertura del portal index.html, no modificado.

## Limites y despliegue

No se puede certificar ni prometer la eliminacion del 100% de CPU sin medir Supabase. Esta correccion elimina lecturas masivas por eventos completos en la ruta central; no elimina otras consultas, tareas SQL, clientes antiguos ni la recuperacion completa necesaria.

No se desplego ni se ejecuto SQL en produccion. Actualizar el frontend servido y verificar que los dispositivos cargan el archivo nuevo; no borrar almacenamiento con pedidos pendientes. Las APK con recursos empaquetados requieren reconstruccion.

Validar con dos dispositivos: crear pedido, verlo en caja, actualizarlo, desconectar/reconectar un dispositivo y comprobar pendientes y revisiones. Medir llamadas y CPU durante un intervalo nuevo, no a partir de estadisticas historicas acumuladas.
