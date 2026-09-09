# Continuacion de sincronizacion y CPU

Base: RC-ORDERA-ZIP21-CIERRE.zip entregado anteriormente. No se abrio ni modifico el ZIP22 del usuario.

## Reparado en esta entrega

1. El canal central fallido se retira inmediatamente antes de programar reconexion. La referencia se invalida antes de removeChannel, evitando que el evento CLOSED de la limpieza cree otra reconexion.
2. Los refrescos centrales directos y programados respetan el limite de 5 segundos. Un fallo temporal aplica 30 segundos de espera y conserva los ambitos pendientes. Se reutiliza el clasificador de errores existente.
3. La lectura de ofertas del colaborador devuelve false cuando Supabase responde con error: ya no se interpreta como exito ni borra la lista disponible.
4. Errores repetidos esperan 30, 60 y hasta 120 segundos; se agrega variacion aleatoria y se comparte un temporizador de recuperacion. Realtime y botones no saltan esa espera.
5. Varias llamadas ordinarias simultaneas comparten una consulta sin provocar otra ronda vacia. Un evento Realtime durante una lectura exitosa mantiene una sola reconciliacion posterior; durante un fallo espera el backoff.
6. Una respuesta atrasada del colaborador no sustituye datos de otra cuenta.

Se conservan checkout, timeout cancelable y recuperacion en foreground del paquete base. No se modificaron menu, carrito, horarios, GPS, estados de negocio, roles, permisos, traducciones, SQL de produccion ni service worker.

## Pruebas y limites

- npm run qa: aprobado, incluidas 2062 comprobaciones de i18n.
- Sintaxis de app.js, colaborador.js y sus copias www: aprobada.
- node --test tests/recovery-load.test.cjs tests/timeout-cancellation.test.cjs: 11 aprobadas.
- Pruebas con servicios simulados: 100 llamadas durante un fallo producen solo una consulta; se comprueban datos conservados, espera creciente, cierre de canal y recuperacion pendiente.
- Raiz/www verificados por hash.
- No hubo despliegue ni medicion real de CPU en Supabase. No se certifica la eliminacion del 100% de CPU.

## Cola de domicilios: pendiente de evidencia del servidor

No hay conexion PostgreSQL disponible en este entorno. Se incluye DIAGNOSTICO-CPU-DISPATCH.sql para obtener indices y el plan de lectura sin ejecutar el despacho ni bloquear pedidos. No se creo ningun indice a ciegas ni se activo/desactivo un cron. El plan debe compararse con la definicion instalada de rc_ordera_process_delivery_queue; el archivo reproduce la seleccion incluida en este paquete, sin FOR UPDATE.

Tambien hay que comprobar los trabajos cron realmente instalados: el ZIP no demuestra su estado activo. No se reemplaza esta comprobacion por afirmaciones basadas en datos acumulados.

Referencia sobre EXPLAIN ANALYZE y sus efectos: https://www.postgresql.org/docs/current/using-explain.html

## Instalacion

Publicar esta version del frontend y verificar que los dispositivos cargan el codigo actualizado. No borrar almacenamiento con pedidos pendientes. Las APK que incorporan recursos locales necesitan reconstruirse. Mantener las instrucciones de despliegue de checkout y contrato incluidas en ENTREGA-ZIP21-CIERRE.md.

Los defectos de tareas de estaciones, GPS y otros puntos declarados pendientes en el cierre anterior no se dan por reparados aqui.
