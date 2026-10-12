# SumUp Hosted Checkout — fase segura (NO ACTIVADA)

Estado: **adaptador aislado y probado con respuestas simuladas; ningún pago real habilitado**.

Se añadió `supabase/functions/_shared/sumup-hosted.ts`: crea un checkout alojado por SumUp desde un contexto de servidor, comprueba la respuesta (importe, PLN, comercio, referencia, URL HTTPS oficial) y recupera el estado para una reconciliación posterior. No hay ruta pública que invoque el adaptador, ni migraciones, cambios en pedidos, despliegue de Edge Functions, credenciales o modificaciones en Stripe Connect.

## Restricción financiera importante

El flujo marketplace actual utiliza **Stripe Connect** para repartos a restaurante, repartidor y plataforma. **Hosted Checkout de SumUp no implementa automáticamente la misma distribución de fondos**. No se puede sustituir el nombre del proveedor y considerar que los pagos, comisiones, reembolsos y liquidaciones funcionan.

Antes de activar SumUp en RC ORDERA, implementar y revisar:

1. Cuenta SumUp empresarial verificada en Polonia, merchant code, clave API y permisos online. Guardar secretos **solo** en Supabase Edge Function Secrets (nunca en GitHub, PWA, Vercel público, app Windows o `supabase-config.js`).
2. Definir si los cobros SumUp pertenecen a **Rincón Colombiano como restaurante individual**, o al marketplace de terceros. Para marketplace multi-beneficiario, cerrar diseño legal/contable y capacidad real de transferencias/reembolsos.
3. Crear una reserva transaccional y única de intento de pago por pedido: verificar identidad/guest token, precio **desde base de datos**, estado del pedido y referencia de intento única. Nunca aceptar importes del navegador.
4. Persistir el intento de pago **antes** de llamar a SumUp. Si hay timeout, **consultar el checkout existente y reconciliar antes de crear otro**, no reintentar POST a ciegas. Usar bloqueos/índices de base de datos.
5. Implementar webhook de `return_url` en Supabase Edge y verificar cada evento mediante **GET a SumUp**; el webhook por sí solo y `redirect_url` **no prueban PAID**. Reconciliar idempotentemente solo si checkout, importe, moneda, merchant y referencia coinciden con ledger, sin aceptar eventos repetidos como nuevos pagos.
6. Contabilizar refunds, chargebacks y conciliación con el proveedor. No reutilizar los jobs de Stripe Connect para cobrar/transferir por SumUp.
7. Activar solo por feature flag del restaurante y primero en sandbox. Cubrir approved/failed/expired, demora, duplicados, fallos de red, intento concurrente, cancelación, devolución, cocina sin pago y separación de restaurantes. Aprobación del CEO antes de dinero real.

### Comprobación sin pagos

```bash
node --experimental-strip-types --no-warnings --test tests/hardening/sumup-hosted.test.mjs
```

Los tests tienen un `fetch` falso. No realizan peticiones a SumUp.

Documentación: https://developer.sumup.com/online-payments/checkouts/hosted-checkout y https://developer.sumup.com/online-payments/webhooks

**No desplegar/activar pagos SumUp en producción antes del circuito financiero completo y revisión de datos reales con autorización.**
