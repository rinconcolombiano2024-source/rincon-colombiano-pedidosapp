# RC ORDERA R20 — Consistencia de pagos y CPU (13 octubre 2026)

## SumUp: corrección confirmada en código, todavía NO activada para cobros
La migración R19 está en GitHub, sin ejecutar en producción. Detectado un riesgo de *deadlock* AB/BA al conciliar SumUp: reserva bloqueaba `customer_orders` antes de `rc_sumup_payment_attempts`, pero confirmación y callback lo hacían al revés. R20 uniforma el orden de bloqueos: **pedido → intento**. La primera lectura de la reserva antes del bloqueo es solo una obtención de clave, verificada de nuevo después de obtener los locks.

Se impide iniciar SumUp si existen intentos de otro proveedor registrados para el mismo pedido, incluso con estado local fallido. Un fallo local Stripe podría tener confirmación asincrónica; prohibir cobros concurrentes en otros proveedores evita una doble captura. La conciliación SumUp marca `needs_review` si detecta otro proveedor y no registra una segunda venta. Se añaden pruebas aisladas PGlite de estos casos y de orden de bloqueos.

La cuenta empresarial SumUp no equivale a conocer `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE` ni a certificar el funcionamiento de los webhooks. No existe ninguna simulación que se haga pasar por un cobro real.

## CPU: optimización RLS R17 y verificación
La R17 describe exactamente cinco políticas para envolver `auth.uid()` en `(SELECT auth.uid())`. Se añade una prueba PGlite que compara lectura del propietario, cliente y extraño antes/después, para evitar que una optimización de CPU cambie autorizaciones. Este cambio no elimina el resto de las advertencias RLS ni todos los costes de WAL Realtime.

Muestra de `pg_stat_statements` a 2026-10-13 00:07 UTC: 812951 ejecuciones históricas de consulta WAL `SELECT wal->>...` (31,1 M ms acumulados), y 459235670 ejecuciones históricas de `set_config(...)` (~8,57 M ms). **Son acumulados desde la recolección de estadísticas, no CPU instantánea**. Tampoco permiten atribuir el 93 % actual a una única pantalla; requieren medición por ventana y métricas de plataforma.

## Bloqueos para la validación final
- No afirmar SumUp “verde”: staging + webhooks reales + captura y devolución bancaria + reconciliación y aprobación de operaciones.
- No afirmar POSNET “verde”: modelo y protocolo físico de impresora, agente, PTU y factura fiscal real.
- No afirmar Glovo/Wolt/UberEats “verde”: contratos y APIs oficiales.
- No afirmar 99,9 % SLO ni valor de código de USD 1 M sin medición operativa/valoración.
