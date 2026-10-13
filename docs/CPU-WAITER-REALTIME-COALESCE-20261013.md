# RC ORDERA — Menos consultas Supabase en Mesero/Estaciones (2026-10-13)

## Hallazgo
En `mesero.js`, el canal Realtime de caja/mesero leía
`get_public_restaurant_menu` por cada notificación UPDATE de catálogo,
y el historial enviado `customer_orders` por cada UPDATE de un pedido
creado por el empleado. Aunque las lecturas idénticas en vuelo se reúnen,
ráfagas después de completarse podían producir una consulta nueva
por evento, manteniendo ocupadas conexiones y políticas RLS.

## Parche sin cambios funcionales de caja
- Ventanas independientes de 1 segundo para refrescar menú y pedidos
  enviados, sin cancelar/reiniciar continuamente el temporizador.
- 1000 eventos de menú + 1000 eventos de pedidos programan un máximo de
  dos lecturas por ventana por dispositivo, una para cada tipo.
- Cada callback comprueba que pertenece al canal actual, al restaurante
  y al usuario actuales, que Realtime sigue suscrito y que hay internet.
- Al detener, desconectar, salir o cambiar de estación, se cancelan
  los temporizadores pendientes.
- La primera conexión SUBSCRIBED conserva su lectura de puesta al día
  inmediata, sin retrasarla. El flujo de cocina/estaciones, pedidos
  nuevos y confirmaciones no cambia.
- La notificación visual de menú se emite tras cargarlo; la actualización
  en tiempo real puede demorarse hasta 1 segundo.
- Se preservan pedido, carrito, pagos, registro de cambios, RLS,
  filtros actuales y controles fiscales. Sin migraciones SQL.

Se añaden pruebas de VM sobre las funciones del código real y el
ledger reversible SHA256 de `mesero.js`.
No es una medición del porcentaje de CPU real. La decodificación WAL de
Supabase Realtime sigue siendo una posible fuente de carga y requiere
métricas de dashboard antes/después.
