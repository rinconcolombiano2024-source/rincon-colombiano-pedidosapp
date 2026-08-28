# RC ORDERA V84.1 - despliegue controlado

## Estado

V84.1 es una candidata de produccion incremental sobre el ZIP oficial V84. No modifica las migraciones V82, V83 o V84, no borra tablas y no cambia usuarios, contrasenas, restaurantes, menus ni pedidos.

La revision local termino correctamente. No se declara LISTA PARA PUBLICAR hasta completar en el Supabase real las pruebas de RLS, Push, cron, concurrencia y el recorrido completo de un domicilio.

## Entregables

- Aplicacion/PWA RC ORDERA V84.1.
- MIGRACION-V84.1-ESTABILIZACION-PRODUCCION.sql.
- PREFLIGHT-V84.1.sql, solo lectura.
- VALIDACION-POST-DESPLIEGUE-V84.1.sql, solo lectura.
- REPORTE-AUDITORIA-Y-VALIDACION-V84.1.md.
- Este procedimiento de despliegue y rollback.

Los archivos automatizados de QA, capturas, credenciales y temporales se excluyen del ZIP de produccion.

## Cambios principales

- La disponibilidad del colaborador continua siendo una decision explicita.
- GPS, minimizar, reabrir, aceptar, recoger y entregar no cambian available a false.
- Cerrar sesion desconecta primero en Supabase; si falla, la sesion sigue abierta.
- Se evita iniciar mas de un canal, watcher o temporizador equivalente al reanudar.
- La alarma continua mientras exista una oferta vigente y el colaborador este disponible.
- Push valida asignacion, destinatario, estado ofrecido y vencimiento.
- Despacho externo exige un secreto de al menos 24 caracteres.
- Un pedido solo puede tener una asignacion activa.
- Cliente y restaurante reciben seguimiento autorizado.
- Se completo el RPC de historial del colaborador que faltaba en V84.
- El restaurante sincroniza cambios pendientes y limpia datos locales al cerrar sesion.
- Manifiestos, enlaces y cache usan V84.1.

## Archivos modificados

- admin-manifest.webmanifest
- app.js
- cliente.html
- cliente.js
- cliente-manifest.webmanifest
- colaborador.js
- colaborador-manifest.webmanifest
- manifest.webmanifest
- mesero.js
- service-worker.js
- styles.css
- supabase/config.toml
- supabase/functions/courier-push/index.ts
- supabase/functions/delivery-dispatch/index.ts
- README.md

## Archivos nuevos

- MIGRACION-V84.1-ESTABILIZACION-PRODUCCION.sql
- PREFLIGHT-V84.1.sql
- VALIDACION-POST-DESPLIEGUE-V84.1.sql
- ENTREGA-RC-ORDERA-V84.1.md
- REPORTE-AUDITORIA-Y-VALIDACION-V84.1.md

## RPC y seguridad

RPC creados o reforzados:

- set_courier_availability(boolean)
- upsert_courier_live_location(boolean,numeric,numeric,integer)
- get_customer_order_tracking(uuid,text)
- get_current_restaurant_delivery_tracking()
- get_my_courier_delivery_history()
- rc_ordera_notify_delivery_offer()

Trigger reemplazado de forma idempotente:

- rc_ordera_notify_delivery_offer_trigger sobre delivery_assignments.

Politica RLS nueva:

- Active order participants read courier live location.

La ubicacion activa solo puede verla el propio colaborador, el cliente autenticado del pedido o el restaurante/personal con permiso view_orders. Invitados usan el RPC y el token secreto del pedido. RLS permanece activa.

## Orden exacto de despliegue

1. Conserva el ZIP V84 y crea una copia de seguridad de la base.
2. Confirma que V82, V83 y V84 ya fueron aplicadas.
3. En Supabase SQL Editor ejecuta completo PREFLIGHT-V84.1.sql.
4. No continues si falta un objeto o aparecen asignaciones activas duplicadas.
5. Ejecuta completo MIGRACION-V84.1-ESTABILIZACION-PRODUCCION.sql.
6. Ejecuta completo VALIDACION-POST-DESPLIEGUE-V84.1.sql.
7. Configura secrets y despliega las Edge Functions.
8. Configura el webhook de notificaciones y un solo despacho cada minuto.
9. Despliega el ZIP V84.1 en Vercel.
10. Realiza el recorrido critico de este documento.
11. Habilita produccion solo cuando todas las pruebas reales pasen.

## Supabase

### API y Auth

- supabase-config.js debe tener solo URL base https://PROYECTO.supabase.co y clave sb_publishable o anon.
- Nunca usar service_role o sb_secret en navegador, GitHub o Vercel.
- Site URL: dominio final HTTPS de Vercel.
- Redirect URLs: index.html, cliente.html, colaborador.html, mesero.html y admin.html bajo el dominio final.
- Mantener confirmacion de correo donde corresponda.

### Storage

- El bucket courier-documents debe existir y ser privado.
- Las politicas existentes deben limitar cada carpeta al UUID del colaborador.
- Administracion abre documentos con enlaces firmados.
- No volver publico el bucket.

### Realtime

Confirmar estas tablas en supabase_realtime:

- customer_orders
- delivery_assignments
- courier_live_locations
- notifications
- order_status_history

La migracion las agrega solamente si faltan.

### Secrets de Edge Functions

Configurar sin guardar valores en archivos publicos:

- VAPID_SUBJECT
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- COURIER_PUSH_WEBHOOK_SECRET, minimo 24 caracteres
- DELIVERY_DISPATCH_SECRET, minimo 24 caracteres

SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY pertenecen al entorno seguro de Edge Functions.

Comandos de despliegue:

    supabase functions deploy courier-push
    supabase functions deploy delivery-dispatch
    supabase functions deploy delete-own-restaurant-account

supabase/config.toml conserva JWT para eliminar la propia cuenta y permite las llamadas backend de Push/despacho autenticadas por secreto.

### Webhook y despacho

- Database Webhook en public.notifications para INSERT y UPDATE.
- Destino: Edge Function courier-push.
- Header: x-rc-ordera-webhook-secret.
- El valor coincide con COURIER_PUSH_WEBHOOK_SECRET.

Si existe el trabajo pg_cron rc-ordera-delivery-dispatch-v83, no programes otro. Si no existe, usa un scheduler de servidor que haga POST cada minuto a delivery-dispatch con x-rc-ordera-dispatch-secret.

## Vercel

1. Publicar el contenido de la carpeta raiz de la aplicacion.
2. Framework preset: Other.
3. Build command: vacio.
4. Output directory: vacio o raiz.
5. Production branch: rama que contiene V84.1.
6. Confirmar HTTPS y aplicacion de vercel.json.
7. /service-worker.js debe responder Cache-Control public, max-age=0, must-revalidate.
8. Probar directamente /cliente.html, /colaborador.html, /mesero.html y /admin.html.
9. Cerrar/abrir o reinstalar la PWA para tomar rc-ordera-v84-1-platform-core.

Vercel no necesita claves privadas para este frontend.

## Prueba critica real

1. Iniciar como administrador y confirmar el rol.
2. Aprobar un colaborador de prueba.
3. Iniciar colaborador, compartir GPS y pulsar EN LINEA.
4. Confirmar available = true en courier_live_locations.
5. Minimizar, bloquear y reabrir; debe seguir true.
6. Crear un domicilio real de prueba.
7. Confirmar oferta al colaborador elegible mas cercano.
8. Confirmar notificacion interna y Push.
9. Mantener la oferta abierta; la alarma de primer plano debe continuar.
10. Vencer o rechazar; debe ofrecerse al siguiente.
11. Aceptar simultaneamente desde dos dispositivos; solo uno gana.
12. Marcar llegada, recogida, llegada al cliente y entrega.
13. Cliente y restaurante ven estados y ubicacion permitida.
14. Historial de estados conserva todos los eventos.
15. Historial del colaborador muestra la entrega.
16. available sigue true despues de entregar.
17. Pulsar DESCONECTARSE; cambia a false.
18. Volver a conectar y suspender desde Administracion; cambia a false.
19. Usar dos dispositivos del restaurante; pedidos/menu se sincronizan.
20. Cerrar restaurante con cambios pendientes; sincroniza o impide el cierre.

## Rollback sin perdida

1. En Vercel vuelve a desplegar el ZIP oficial V84.
2. Desactiva temporalmente el webhook courier-push si Push falla.
3. Desactiva el scheduler externo; si usas pg_cron, pausa el trabajo.
4. No borres tablas, columnas, historiales ni usuarios.
5. Conserva la migracion aplicada: sus contratos son compatibles con V84.
6. Diagnostica con los resultados de preflight y post-verificacion.

## Limitaciones

- Una PWA no garantiza audio, GPS o JavaScript continuo con iOS/Android bloqueado. Push cubre segundo plano; GPS refresca al reabrir cuando el sistema detuvo la pagina.
- Push depende del permiso, VAPID, webhook y limites del sistema operativo.
- El mapa muestra la ultima posicion autorizada, no navegacion nativa continua.
- Pagos online, reembolsos, promociones, fidelizacion, soporte completo y prueba avanzada de entrega siguen parciales o pendientes.
- Esta sesion local no pudo ejecutar la migracion ni Edge Functions contra Supabase productivo.
- En capturas anteriores se mostro una clave privada de Supabase. Debe rotarse antes de produccion y nunca guardarse en frontend.

