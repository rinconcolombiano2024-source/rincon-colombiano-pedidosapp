# Pagos marketplace RC ORDERA V85

## Regla financiera

- Venta del restaurante: comision RC ORDERA de 5% (`500` puntos base).
- Domicilio: comision RC ORDERA de 0.1% (`10` puntos base).
- Neto del restaurante: valor de productos y descuentos menos 5%.
- Neto del colaborador: tarifa de domicilio menos 0.1%.
- Plataforma: ambas comisiones y cualquier diferencia de conciliacion valida.

Los costos del proveedor, reembolsos y contracargos no desaparecen. Debe definirse
contractualmente quien los asume. V85 registra la asignacion bruta; la plataforma
debe conciliar Stripe antes de transferir fondos definitivos.

## Polonia

El flujo implementado usa Stripe Connect con cobro en la plataforma y transferencias
separadas. Cada restaurante y colaborador necesita una cuenta Connect completada y
`payouts_enabled = true`.

La liberacion se realiza asi:

- Restaurante: el restaurante marca el pedido como `delivered`.
- Colaborador: colaborador y cliente confirman la entrega.
- `marketplace-settlement` transfiere solo importes elegibles y usa claves de
  idempotencia para evitar transferencias duplicadas.

La transferencia acredita el saldo de la cuenta Connect correspondiente. La
llegada a la cuenta bancaria depende del calendario de payouts de Stripe, del
banco y de posibles revisiones; no se debe prometer abono bancario instantaneo.

## Colombia

Permanece desactivada en V85. No debe cobrarse hasta contratar un proveedor que
admita el reparto requerido entre restaurante, colaborador y plataforma. La opcion
publica 1:1 no satisface por si sola este flujo de tres beneficiarios.

## Secrets de Supabase

Configura en Supabase Edge Functions, nunca en `supabase-config.js`:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://tu-dominio-verificado
PAYMENT_SETTLEMENT_SECRET=valor-aleatorio-de-al-menos-24-caracteres
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son utilizados
por las funciones del proyecto. La `service_role` nunca puede publicarse en Vercel
ni en el navegador.

## Despliegue de funciones

```bash
supabase functions deploy marketplace-onboarding
supabase functions deploy marketplace-checkout --no-verify-jwt
supabase functions deploy marketplace-webhook --no-verify-jwt
supabase functions deploy marketplace-settlement --no-verify-jwt
supabase functions deploy marketplace-confirm-delivery --no-verify-jwt
supabase functions deploy marketplace-release-order
```

En Stripe registra el endpoint firmado:

```text
https://TU-PROYECTO.supabase.co/functions/v1/marketplace-webhook
```

Eventos minimos: `checkout.session.completed`,
`checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `payment_intent.succeeded` y
`payment_intent.payment_failed`.

Configura ademas una tarea programada segura cada cinco minutos para invocar
`marketplace-settlement` con el encabezado
`x-rc-ordera-settlement-secret`. Esto reintenta fallos temporales sin depender de
que el usuario mantenga abierta la aplicacion. El valor del encabezado debe ser el
mismo `PAYMENT_SETTLEMENT_SECRET` y nunca debe guardarse en el frontend.

## Puerta de produccion

No activar `onlinePaymentProvider = stripe` hasta comprobar en modo de prueba y
luego con importes live controlados: pago aprobado, pago fallido, reintento,
webhook duplicado, cuenta no verificada, liberacion parcial, doble confirmacion,
reembolso, contracargo y conciliacion bancaria. V85 no implementa reembolsos
automaticos; ese flujo sigue siendo un requisito previo al lanzamiento abierto.
