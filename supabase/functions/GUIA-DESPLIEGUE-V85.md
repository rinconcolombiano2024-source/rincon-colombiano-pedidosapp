# Despliegue RC ORDERA V85

## 1. Staging

Usa primero un proyecto Supabase y un proyecto Vercel de pruebas. Ejecuta las tres
migraciones V85 en el orden documentado y luego `VALIDACION-V85.sql`.

## 2. Supabase Auth

- Activa correo y contrasena.
- Configura `Site URL` con el dominio HTTPS real.
- Agrega URLs de redireccion para `index.html`, `cliente.html`,
  `colaborador.html`, `mesero.html` y `admin.html`.
- Personaliza los correos con el nombre RC ORDERA.
- No agregues `file://` como URL autorizada.

## 3. Storage y Realtime

Conserva los buckets y politicas existentes. Comprueba carga de logo, imagenes y
documentos con los roles reales. Verifica Realtime entre dos dispositivos para
menu, pedidos, estaciones, entregas y notificaciones.

## 4. Pagos

Sigue `PAGOS-MARKETPLACE-V85.md`. Despliega las seis Edge Functions, configura
secrets y webhook, y completa onboarding Connect. Los pagos de Colombia quedan
desactivados hasta disponer de un contrato compatible.

## 5. Vercel

Despliega la carpeta raiz del proyecto como sitio estatico. No uses `www` como
raiz de Vercel; esa carpeta es solo para Android. `.vercelignore` evita publicar
migraciones, pruebas y funciones privadas.

Comprueba estos encabezados:

- `service-worker.js`: sin cache permanente.
- HTML: `must-revalidate`.
- `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` y permisos de
  camara/geolocalizacion.

## 6. Produccion

1. Ejecuta `npm run qa`.
2. Publica Vercel.
3. Abre una ventana privada y comprueba que aparece V85.
4. Prueba cada rol con una cuenta distinta.
5. Prueba un pedido de caja, mesero, cliente y domicilio.
6. Prueba estaciones y ticket termico real.
7. Prueba pago Stripe de importe controlado y conciliacion.
8. Supervisa logs de Vercel, Supabase, Edge Functions y Stripe.

La aplicacion puede operar sin cobro online mientras se termina la certificacion
financiera. No declares pagos disponibles hasta completar la puerta de produccion.
