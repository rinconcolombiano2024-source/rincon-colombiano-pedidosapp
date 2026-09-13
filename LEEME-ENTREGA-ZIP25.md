# RC ORDERA — entrega continuada desde ZIP (25)

Base: rincon-colombiano-pedidosapp-main (25).zip, preservada sin cambios.
Esta guia y CAMBIOS-ZIP25.md describen esta entrega; los informes anteriores
conservados en el proyecto describen versiones anteriores.

## Resultado comprobado localmente

- node --check app.js y sintaxis de JavaScript de raiz y www: OK.
- npm run qa: QA general aprobado, i18n 2062 comprobaciones, 95 pruebas aprobadas, 0 fallos.
- npm run qa:e2e: 15 pruebas de navegador aprobadas.
- Raiz y www: 40 archivos generados verificados byte por byte (incluye BUILD-METADATA).
- SQL financiero: funciones ejecutadas con PostgreSQL local de pruebas (PGlite),
  con fixtures reducidos del contrato V86 y pruebas conjuntas de ambas migraciones.
- Stripe se simulo en las pruebas; NO se movio dinero ni se llamo a Stripe de produccion.
- No se aplicaron SQL, cambios de permisos ni despliegues a tu Supabase.

Las pruebas no equivalen a una garantia de ausencia absoluta de errores ni a una
certificacion de RLS, Stripe real, GPS real o CPU del servidor de produccion.

## Reparaciones incluidas

1. Checkout: reutiliza pending sin URL, ID y clave; congela los parametros del
   intento nuevo; evita otra sesion si existe pago/autorizacion/refund; conserva
   pendientes ante 503, red y fallo de persistencia. Intentos ambiguos de mas de
   23 horas requieren conciliacion, no un cobro nuevo.
2. Reembolsos: verifica importes, moneda e identidad; recibe refund.created y
   refund.updated; pagina charge.refunded. Encola reversiones de transferencias
   conocidas para reembolsos TOTALES, con clave estable, confirmacion del proveedor,
   registro persistente, lotes de 25 y espera exponencial hasta una hora.
   Una respuesta de settlement tardia no puede retirar el hold de un refund.
3. Disputas: atiende closed/won/lost con consulta del estado actual; evita reabrir
   por eventos antiguos; una ganada solo libera la retencion creada por esta nueva
   funcion. Otra disputa abierta/perdida, refund o hold manual impide liberarla.
   Los eventos no se confirman como procesados si falla su persistencia.
4. Android: incluye restaurante.html y manifests del restaurante; www regenerado
   a partir de la raiz. Esto NO es una APK compilada.
5. Offline: recuperacion de recursos con query de version, pantalla correcta del
   restaurante, fallback ante HTTP 500 y no borrar caches de otras aplicaciones.
6. Mesero: escucha restaurant_public_catalogs con su columna restaurant_user_id.
7. Onboarding Stripe: reserva persistente, idempotencia, regreso a restaurante.html
   y consumo de return/refresh sin bucle. Un simple status no crea una cuenta.
8. UUID: fallback valido con crypto.getRandomValues, sin cambiar IDs guardados.
9. SDK Supabase 2.57.4 local, misma version y bytes originales, con licencia MIT;
   incluido en precache y Android. Sin dependencia del CDN para este SDK.
10. CSP web con lista de origenes de scripts y proteccion de base/objetos/frames.
    Conserva unsafe-inline/unsafe-eval por compatibilidad con el codigo y Maps:
    NO es una CSP estricta por nonces ni una certificacion completa contra XSS.
11. Google: el User-Agent ya no reinicia la cuota. Conserva 60 solicitudes/hora,
    por usuario autenticado o por IP para invitados. Hay que verificar que el
    gateway entrega una IP fiable y configurar restricciones/cuotas en Google.
12. QA ampliado sin quitar pruebas anteriores. Workflow Supabase TEST preparado
    con preflight que falla si faltan credenciales o se apunta a produccion.
13. Dos migraciones nuevas con nombres unicos; las historicas no se renombraron
    ni se reejecutaron en bloque. Archivos temporales y fuentes internas excluidos
    del hosting de Vercel; historicos conservados en el ZIP para trazabilidad.

## Despliegue: no basta con subir solo app.js

1. Conserva una copia del proyecto y del estado de tu base. Usa primero un proyecto
   Supabase TEST separado y Stripe TEST; no borres localStorage ni datos pendientes.
2. Verifica que V85-03 y V86-02 ya existen. NO ejecutes todas las migraciones viejas
   otra vez ni tomes el numero schema_version como prueba de su presencia.
3. En TEST aplica, en este orden:
   - MIGRACION-V91-08-CONCILIACION-DISPUTAS.sql
   - MIGRACION-V91-09-CONCILIACION-REEMBOLSOS.sql
4. Despliega en TEST marketplace-checkout, marketplace-onboarding,
   marketplace-webhook, marketplace-settlement y delivery-quote desde supabase/functions.
   Incluye el directorio _shared al desplegar las funciones que lo importan.
   Configura los secretos en Supabase, nunca en el frontend: especialmente
   STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET para el webhook.
5. Comprueba que Stripe envia los eventos de checkout/pago, refund.created,
   refund.updated, charge.refunded y charge.dispute.created/updated/closed.
   El worker marketplace-settlement debe continuar siendo invocado por tu
   programador autorizado existente: no se ha creado ni modificado ningun cron.
   Sin este worker activo, una reversion diferida no se reintentara por si sola.
6. Prueba pagos, duplicados, refund total, parcial, disputa ganada/perdida y retorno
   del onboarding en TEST. Despues de validar, programa el mismo orden SQL ->
   funciones -> frontend para produccion. No se ha realizado este paso por ti.
7. Publica el proyecto completo, incluido vendor y vercel.json. Para Android ejecuta
   android:prepare-web/android:sync en tu entorno de build y recompila la APK.
   Para PWA vuelve a abrir online para instalar el nuevo Service Worker; no elimines
   el almacenamiento local si hay pedidos pendientes.

## Pendiente: no darlo por resuelto sin estos pasos

- Integracion REAL en CI: configurar el entorno supabase-test del workflow
  .github/workflows/supabase-test.yml y sus variables/secretos, y ejecutarlo.
  No se ejecuto contra una base real. Las pruebas de concurrencia/mutacion que
  requieren fixtures siguen necesitando su configuracion; no hay un verde ficticio.
- Reembolsos PARCIALES: no existe una regla aprobada para repartir la recuperacion
  entre restaurante y repartidor. Se mantiene el hold y la revision manual.
- Refunds historicos, retenciones de disputas anteriores a V91-08 y transferencias
  cuyo ID nunca se guardo en Supabase requieren conciliacion con Stripe. No se
  inventan IDs ni se recupera dinero historico en bloque.
- La liquidacion de transferencias salientes antigua aun requiere pruebas reales
  de respuesta perdida/persistencia fallida; esta entrega no certifica ese ciclo
  como transaccion distribuida atomica.
- Revisar esquema real e historial de migraciones antes de normalizar duplicidades
  antiguas V91-04. No se renombran archivos ya aplicados sin conocer ese historial.
- CPU al 100%: no se midio produccion en esta entrega. No se promete una reduccion
  porcentual. Se conservaron las protecciones de CPU/sincronizacion de la base.
- Validar Google Maps real, restricciones de claves y CSP en los dispositivos.

## Dependencias y conservacion

No se agrego ninguna dependencia al runtime de la app. PGlite 0.5.8 es solo una
dependencia de desarrollo para ejecutar SQL en las pruebas; no entra a www.
Usa Node 22 actualizado o Node 24. El aviso experimental de stripTypeScriptTypes
en algunas versiones de Node no es un fallo de las pruebas.

Los cambios exactos y lineas se listan en CAMBIOS-ZIP25.md. Los archivos originales,
incluidos documentos y backups, se conservan; node_modules y resultados temporales
no se distribuyen. El ZIP de entrada permanece intacto.

Referencias utilizadas para el comportamiento del proveedor:
[Idempotencia Stripe](https://docs.stripe.com/api/idempotent_requests),
[Reversiones de transferencias](https://docs.stripe.com/api/transfer_reversals/create),
[Disputas](https://docs.stripe.com/api/disputes/object),
[CSP de Google Maps](https://developers.google.com/maps/documentation/javascript/content-security-policy).
