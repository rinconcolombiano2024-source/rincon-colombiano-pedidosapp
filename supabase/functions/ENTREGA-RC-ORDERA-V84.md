# RC ORDERA V84 - entrega tecnica

## Alcance terminado

### Fase A - estabilidad

- Disponibilidad del colaborador persistente en Supabase.
- No cambia al minimizar, bloquear, perder GPS, aceptar, recoger o entregar.
- Cierre de sesion explicito y suspension administrativa cambian la disponibilidad a `false`.
- Pedidos mediante RPC con idempotencia y precios validados desde el menu actual.
- Historial inmutable de estados, auditoria y aceptacion atomica para un solo colaborador.
- Realtime filtrado y notificaciones Push preparadas.

### Fase B - delivery core

- Busqueda secuencial por distancia usando la ultima ubicacion conocida.
- El GPS antiguo se registra, pero no desconecta al colaborador.
- Al vencer o rechazar, se intenta con el siguiente; terminado el ciclo, se vuelve a intentar hasta que acepten o cambie el pedido.
- ETA inicial de recogida y entrega guardado en pedido y asignacion.
- Scoring y motivo guardados en `score` y `score_reason`.
- Batching preparado mediante limites del perfil, desactivado por seguridad.

### Fase C - experiencia

- Timeline del pedido basado en `order_status_history`.
- KDS y estaciones existentes conservados.
- Alarma persistente en primer plano y Push de sistema en segundo plano.
- PWA con cache V84 y estrategia network-first para documentos y codigo.

### Fase D - crecimiento

- Favoritos de restaurantes conectado en Cliente.
- Repetir pedido valida productos, disponibilidad y precios actuales.
- Estructura para direcciones, modificadores, disponibilidad temporal, horarios especiales, promociones, resenas, incidencias y fidelizacion.

### Fase E - finanzas preparadas

- Desglose de subtotal, domicilio, descuento, propina y total.
- Tablas para pagos, reembolsos y liquidaciones.
- El navegador no puede escribir directamente pagos, reembolsos, liquidaciones ni puntos.
- No se activo ningun cobro online ni proveedor externo.

## Archivos modificados

- `admin.js`, `app.js`, `cliente.html`, `cliente.js`, `colaborador.js`, `mesero.js`
- `styles.css`, `service-worker.js`
- `manifest.webmanifest`, `cliente-manifest.webmanifest`, `colaborador-manifest.webmanifest`, `admin-manifest.webmanifest`
- `README.md`

## Archivos nuevos

- `MIGRACION-FASE1-V82-ESTABILIDAD-CORE.sql`
- `MIGRACION-FASE2-V83-DESPACHO-PERSISTENTE.sql`
- `MIGRACION-FASES3-5-V84-EXPERIENCIA-CRECIMIENTO-FINANZAS.sql`
- `VALIDACION-V84.sql`, `qa-v84.cjs`
- `supabase/functions/courier-push/deno.json` e `index.ts`
- `supabase/functions/delivery-dispatch/deno.json` e `index.ts`

## Orden de migraciones

Ejecutar en Supabase SQL Editor, cada archivo completo y por separado:

1. `MIGRACION-FASE1-V82-ESTABILIDAD-CORE.sql`
2. `MIGRACION-FASE2-V83-DESPACHO-PERSISTENTE.sql`
3. `MIGRACION-FASES3-5-V84-EXPERIENCIA-CRECIMIENTO-FINANZAS.sql`
4. `VALIDACION-V84.sql` (solo lectura)

No repetir migraciones historicas ya aplicadas. V82, V83 y V84 son idempotentes y no borran tablas ni datos.

## Push y despacho automatico

Configurar estos secrets en Supabase Edge Functions:

- `VAPID_SUBJECT`, por ejemplo `mailto:soporte@tu-dominio.com`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `COURIER_PUSH_WEBHOOK_SECRET`, aleatorio de al menos 24 caracteres
- `DELIVERY_DISPATCH_SECRET`, aleatorio largo

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` pertenecen al entorno de Edge Functions. Nunca copiarlos al frontend.

Desplegar:

```text
supabase functions deploy courier-push --no-verify-jwt
supabase functions deploy delivery-dispatch --no-verify-jwt
```

Crear un Database Webhook para `INSERT` y `UPDATE` en `public.notifications`, apuntando a `courier-push`, y enviar `x-rc-ordera-webhook-secret`.

V83 intenta programar `pg_cron` cada minuto. Si no esta habilitado, programar un POST cada minuto a `delivery-dispatch` con `x-rc-ordera-dispatch-secret`.

## Despliegue Vercel

1. Ejecutar las migraciones y revisar `VALIDACION-V84.sql`.
2. Configurar y probar las Edge Functions.
3. Subir el contenido de V84 al repositorio conectado con Vercel.
4. Confirmar que `supabase-config.js` contiene solo URL base y clave publicable, nunca `service_role`.
5. Desplegar y volver a abrir la PWA. El cache `rc-ordera-v84-platform-core` reemplaza versiones anteriores.

## Pruebas realizadas

- Sintaxis de las cinco interfaces y el service worker.
- JSON de los cuatro manifiestos y `vercel.json`.
- QA automatizado `qa-v84.cjs`: aprobado.
- Chrome movil 390x844: Inicio, Cliente, Colaborador y Mesero.
- Chrome escritorio 1440x900: Restaurante y Administracion.
- Sin desbordamiento horizontal, IDs duplicados ni errores JavaScript de pagina.
- No se agrego `service_role`, contrasena ni clave VAPID privada al frontend.

Las migraciones no pudieron ejecutarse contra Supabase productivo desde el entorno local. RLS, Cron, Push y concurrencia deben validarse despues de ejecutar el SQL en el proyecto real.

## Prueba obligatoria en Supabase

1. Aprobar un colaborador, compartir ubicacion y pulsar `EN LINEA`.
2. Minimizar la PWA y comprobar `courier_live_locations.available = true`.
3. Crear un domicilio y comprobar una oferta al mas cercano.
4. Esperar tres minutos y confirmar que la oferta vence y pasa al siguiente.
5. Aceptar simultaneamente desde dos colaboradores; solo uno debe ganar.
6. Entregar y comprobar que `available` continua `true`.
7. Pulsar `DESCONECTARSE` y comprobar `available = false`.
8. Suspender desde Administracion y comprobar `available = false`.

## Limitaciones honestas

- Android/iOS no garantizan audio infinito con pantalla bloqueada. En segundo plano se usa Push con vibracion y notificacion persistente cuando el sistema lo permite.
- Una PWA no garantiza GPS continuo bloqueada. Conserva `available=true`, usa la ultima ubicacion y refresca GPS al volver.
- GPS continuo real requiere futura app nativa/Capacitor con background location.
- Modificadores, promociones, resenas, soporte, fidelizacion, pagos, reembolsos y liquidaciones tienen contratos de base de datos; solo favoritos, repetir y timeline quedaron conectados a la interfaz en V84.
- Pagos online siguen desactivados hasta integrar un proveedor con webhooks firmados.

## Rollback

- Frontend: volver a desplegar el ZIP oficial anterior.
- Base: no borrar tablas V82-V84. Desactivar Cron/Webhooks o revocar funciones nuevas mientras se diagnostica.
- Push: desactivar el Database Webhook.
- Despacho: ejecutar `select cron.unschedule(jobid) from cron.job where jobname = 'rc-ordera-delivery-dispatch-v83';` si Cron esta instalado.

Este rollback evita perder pedidos, historial, usuarios y configuracion.
