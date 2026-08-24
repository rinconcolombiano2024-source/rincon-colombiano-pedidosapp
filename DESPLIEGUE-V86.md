# RC ORDERA V86.1 - Despliegue

## 1. Copia de seguridad

Antes de actualizar, confirma que Supabase tenga una copia reciente o exporta la base. Conserva tambien el ZIP publicado actualmente en Vercel. No borres tablas ni usuarios.

## 2. Base de datos

En Supabase abre **SQL Editor** y ejecuta, uno por uno y en el orden indicado, los ocho archivos descritos en `MIGRACIONES-V86.md`. Si alguno muestra error, detente y no continues con el siguiente.

Despues ejecuta `VALIDACION-V86.sql`. Guarda una captura o exportacion de sus resultados.

## 3. Secretos de Supabase

En **Project Settings > Edge Functions > Secrets** configura los que realmente vayas a usar:

- `GOOGLE_ROUTES_API_KEY`: clave privada para Routes API y Geocoding API.
- `GOOGLE_TRANSLATE_API_KEY`: clave privada para Cloud Translation API.
- `STRIPE_SECRET_KEY`: clave de prueba o produccion de la cuenta plataforma.
- `STRIPE_WEBHOOK_SECRET`: secreto de firma del endpoint Stripe.
- `APP_BASE_URL`: `https://TU-DOMINIO-VERCEL` sin barra final.
- `PAYMENT_SETTLEMENT_SECRET`: valor aleatorio de al menos 24 caracteres.
- `DELIVERY_DISPATCH_SECRET`: valor aleatorio de al menos 24 caracteres.
- `COURIER_PUSH_WEBHOOK_SECRET`: valor aleatorio de al menos 24 caracteres.
- `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: para notificaciones push.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son proporcionadas por Supabase a las Edge Functions. Nunca pegues `service_role`, Stripe secreto ni claves privadas en `supabase-config.js`, GitHub o Vercel publico.

## 4. Edge Functions

Con Supabase CLI enlazado al proyecto, despliega:

```powershell
supabase functions deploy delete-own-restaurant-account
supabase functions deploy delivery-quote --no-verify-jwt
supabase functions deploy translate-public-content --no-verify-jwt
supabase functions deploy courier-push --no-verify-jwt
supabase functions deploy delivery-dispatch --no-verify-jwt
supabase functions deploy marketplace-onboarding
supabase functions deploy marketplace-checkout
supabase functions deploy marketplace-webhook --no-verify-jwt
supabase functions deploy marketplace-confirm-delivery --no-verify-jwt
supabase functions deploy marketplace-release-order
supabase functions deploy marketplace-settlement
```

Configura un Database Webhook para `INSERT` y `UPDATE` de `public.notifications` hacia `courier-push`, enviando `x-rc-ordera-webhook-secret`.

Debe existir un solo proceso de despacho: usa el trabajo `rc-ordera-delivery-dispatch-v83` si `pg_cron` ya esta activo; si no, programa un POST por minuto a `delivery-dispatch` con `x-rc-ordera-dispatch-secret`. No dupliques ambos schedulers.

Para recuperar liquidaciones interrumpidas, programa `marketplace-settlement` de manera periodica con `x-rc-ordera-settlement-secret`. Las confirmaciones de entrega y restaurante ya intentan ejecutarla inmediatamente.

## 5. Stripe Connect

Primero trabaja en modo de prueba. Crea el endpoint:

`https://TU-PROYECTO.supabase.co/functions/v1/marketplace-webhook`

Suscribe como minimo:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `refund.updated`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`

Cada restaurante y colaborador que reciba dinero debe completar Stripe Connect y quedar con pagos/transferencias habilitados. No actives “Pago en linea” en produccion hasta completar una compra de prueba, confirmacion por ambas partes, reparto 5%/0,1%, reembolso y disputa.

## 6. Google

Mantiene dos claves:

- La clave web de `supabase-config.js` solo para Maps JavaScript/Places, restringida al dominio de Vercel y dominios propios.
- `GOOGLE_ROUTES_API_KEY` solo en Supabase Secrets, restringida a Routes API y Geocoding API.

No uses la clave web como clave privada del backend.

## 7. Vercel

1. Sube el contenido de la carpeta V86.1 a la raiz del repositorio GitHub conectado a Vercel.
2. En Vercel confirma **Framework Preset: Other**, sin comando de compilacion y directorio de salida `.`.
3. Publica y abre primero una vista previa.
4. Comprueba `/`, `/cliente.html`, `/colaborador.html`, `/mesero.html` y `/admin.html`.
5. Confirma HTTPS, permisos de ubicacion, instalacion PWA y que `service-worker.js` responde con `must-revalidate`.
6. Solo despues promueve el despliegue a produccion.

## 8. Prueba de salida

Realiza un pedido de prueba completo con dos dispositivos: cliente crea y paga; restaurante recibe/acepta/imprime; colaborador acepta/recoge/entrega; cliente confirma; restaurante confirma; Stripe registra las transferencias correctas. Repite con efectivo, sin Internet temporal, un producto agotado y una direccion fuera de cobertura.
