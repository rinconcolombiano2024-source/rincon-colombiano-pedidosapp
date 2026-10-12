# RC ORDERA R19 — SumUp Hosted Checkout (una empresa), INACTIVO hasta pruebas
Fecha: 12-10-2026

Se añadieron contratos de reserva idempotente, persistencia de checkout y confirmación verificable desde SumUp para **un solo restaurante**. El proveedor nunca recibe desde el navegador el precio, merchant ni credenciales. `RC_SUMUP_RESTAURANT_USER_ID` limita exactamente el comercio permitido. `RC_SUMUP_PAYMENTS_ENABLED` debe valer `1` y deben existir `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `APP_BASE_URL` y los secretos de Supabase. **Todo permanece desactivado por defecto.**

## Qué se añadió
1. `MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql`: una reserva por pedido y precio confirmado en el servidor; estados inciertos requieren reconciliación, una restricción bloquea cancelar mientras el dinero es incierto. Tablas con RLS sin políticas públicas, RPCs privadas `service_role`.
2. `sumup-checkout`: autenticación del cliente o token invitado comprobado por RPC; bloqueo transaccional de doble cobro; Hosted Checkout, URL oficial verificada, persistencia; nunca repetir una creación si se perdió su respuesta.
3. `sumup-webhook`: el texto del webhook no decide el dinero; consulta el ID guardado en el libro, revisa SumUp por GET y solo entonces escribe vía RPC idempotente. Desconocidos se ignoran sin modificar pedidos.
4. Adaptador `sumup-hosted.ts` acepta el `return_url` oficial únicamente bajo el host de Supabase y ruta exacta.
5. QA sobre PGlite y respuestas SumUp simuladas.

## Bloqueos expresos
**No se ha habilitado el botón de SumUp para clientes**, cambiado el proveedor de restaurante, ejecutado SQL de producción, desplegado Edge Functions ni cobrado dinero. Primero hay que verificar en staging la migración completa, los controles RLS positivos y negativos y que no existan triggers externos que rechacen escritura a `customer_orders` y `payment_transactions`. Luego configurar secretos de la cuenta SumUp empresarial; hacer cobros y reembolsos de prueba, conciliación y aprobación. Los cobros de reparto multiempresarial **continúan en Stripe Connect**; SumUp no puede asumirse como sustituto de transferencias multi-beneficiario.

### Preflight obligatorio
- Respaldar producción; crear un proyecto staging con estructura y roles equivalentes.
- Ejecutar la migración allí, con prueba de checkout/PAID/FAILED/EXPIRED, webhooks duplicados, devolución, cancelación y timeouts inciertos. Confirmar pagos y recibos reales sin alteraciones de precio.
- Validar código PGlite y QA de GitHub. No aplicar la migración solo por pasar pruebas locales.
- Ajustar el menú de configuración de tienda para SumUp únicamente tras pasar staging, conocer el merchant code y activar el servicio controladamente. Si faltan credenciales o SQL, devolver error 503 sin ventas registradas.

Referencias oficiales: https://developer.sumup.com/api/checkouts/create ; https://developer.sumup.com/online-payments/checkouts/hosted-checkout ; https://developer.sumup.com/online-payments/webhooks
