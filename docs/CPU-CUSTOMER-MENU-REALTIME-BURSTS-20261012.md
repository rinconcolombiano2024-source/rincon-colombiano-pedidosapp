# RC ORDERA — CPU: actualización coalescente del menú del cliente
Fecha: 12 octubre 2026

## Causa verificada en código
El evento de Realtime para `restaurant_public_catalogs` y cambios del perfil
reactivaba `customerScheduleMenuRealtimeRefetch()`, cancelando el timeout
anterior de 350 ms. Con una ráfaga continua de eventos, el temporizador podía
reiniciarse indefinidamente. Con eventos separados por poco más de 350 ms,
el navegador podía volver a consultar el catálogo por cada evento.

## Cambio reducido, conservador
- La primera notificación programa un único refresco dentro de **1,2 s**.
- Las notificaciones siguientes dentro de esa ventana no reinician el timer.
- Se mantiene la comprobación visible/online existente y se conserva
  el refresco de menú y su representación local.
- Una ventana posterior puede actualizar de nuevo el menú.
- No se modifica la creación de pedidos, Auth, RLS, Stripe, ni Supabase SQL.
- Se conservan las páginas de cliente, restaurante, estaciones, idiomas
  ES/PL/EN y el botón de impresora fiscal en la aplicación.
- Nuevas pruebas VM sobre la función real simulan 1000 eventos, dos ventanas,
  modo oculto y sin conexión, en raíz y distribución `www/`.
- El registro reversible de `cliente.js` mantiene SHA256 actualizado.

## Alcance
El cambio limita solicitudes REST asociadas a eventos de actualización
del menú. **No elimina el coste WAL histórico de Realtime** ni acredita
un porcentaje de CPU. Para afirmar que bajó del 93 %, comparar la métrica
CPU real en Supabase y las tasas de consultas por minuto antes/después.
Evitar modificar RLS o borrar pedidos de producción sin ensayo.
