# RC ORDERA R18 · No confirmar pagos desde URLs

Corregido: el retorno `?payment=success` en Cliente se mostraba como éxito antes de consultar la confirmación del proveedor. Ese parámetro se puede manipular. Ahora los tres idiomas muestran **verificación pendiente** sin estilo de éxito; se realiza una sola consulta existente a la API de pedidos y nunca se convierte la redirección en `paid`.

Ninguna Edge Function, Supabase SQL, pagos reales, Stripe, SumUp, datos, caja fiscal o reparto son modificados. Se publica nueva versión de caché PWA sin borrar pedidos. E2E Android instalado continúa pendiente.

Se añade prueba de éxito falso, cancelación y redirección de otro pedido; `www/` conserva copia exacta de los recursos. La integración SumUp continúa desactivada hasta tener reserva persistente, conciliación idempotente y secretos del comercio.
