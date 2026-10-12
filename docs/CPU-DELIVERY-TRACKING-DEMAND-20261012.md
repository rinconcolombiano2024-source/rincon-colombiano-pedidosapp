# RC ORDERA — reducción de consultas de seguimiento en restaurante · 2026-10-12

## Hallazgo de código y parche
`performClientOrdersRefresh()` realizaba incondicionalmente **dos peticiones**
por refresco: `customer_orders` y
`get_current_restaurant_delivery_tracking`. Incluso cuando el restaurante
no tenía pedidos activos o solo atendía mesas/recogidas, la RPC de reparto
recorría el servidor sin ninguna necesidad funcional.

Ahora:
1. Se consulta la lista de pedidos activos (la fuente de verdad).
2. Si ningún pedido requiere reparto, se omite la RPC por completo y se
   conserva la renderización de los pedidos y notificaciones.
3. Si existe un pedido a domicilio, se consulta normalmente la RPC,
   conservando el seguimiento del repartidor, el fallback ante fallos y
   los límites de tiempo ya existentes.
4. Después del await de seguimiento se verifica de nuevo que la sesión
   sea la misma, para que el resultado tardío no reintroduzca datos de
   otro usuario después de cerrar sesión.
5. Errores de la consulta principal no provocan una segunda consulta
   inútil a reparto.

**Resultado determinista del parche:** una RPC de reparto menos por
refresco sin domicilios activos, en lugar de dos peticiones en paralelo.
Puede añadir la latencia de una segunda petición a la primera carga de
domicilios; se evita la llamada en servicios donde no se utiliza.

## Seguridad y despliegue
- Cambio exclusivo de frontend; no altera Postgres, pagos, facturas,
  pedidos históricos, Web Serial ni las rutas PWA.
- Mantiene archivos `app.js` y `www/app.js` iguales y actualiza el
  registro reversible de modificaciones con SHA256.
- Pruebas Node por VM para 0 pedidos, 2 recogidas, recogida+domicilio
  y error de lectura, más todas las pruebas de CI previas.
- Medir la diferencia de `get_current_restaurant_delivery_tracking`
  en `pg_stat_statements` entre dos ventanas de tráfico comparable.
  No atribuir a este cambio un porcentaje de reducción de CPU sin el
  dato del panel de recursos de Supabase.
- No limpiar datos locales ni modificar RPC o RLS de producción.

## Contexto de auditoría
Postgres mostraba `get_current_restaurant_delivery_tracking` entre las
consultas con mayor tiempo acumulado (aproximadamente 111 ms de tiempo
medio en el muestreo). Las estadísticas son acumuladas; la CPU al 93 %
mencionada por el operador sigue pendiente de correlacionar con métricas
temporales. El historial de fallos `ORDER_REVISION_CONFLICT` fue el
incidente prioritario anterior y ya tiene protección de reintentos.
