# Correcciones P0 sobre ZIP 19

Se corrigieron exclusivamente los cuatro puntos criticos solicitados:

1. Instrucciones de despliegue alineadas con schema 91 y contrato 7; V91-01 sola no es suficiente.
2. V91-07 incorpora orders y customer_order_messages a supabase_realtime de forma idempotente, sin cambiar RLS.
3. Eliminadas las referencias a la inexistente V91-08; se conserva contrato 7 en frontend y SQL.
4. Checkout reutiliza el identificador y la clave del intento pendiente cuando no se persistio la sesion. Los errores ambiguos 5xx, 429 y 409 conservan el intento. Un intento sin clave exige reconciliacion, no abre otro pago.

Validacion local:

- node --check app.js: aprobado.
- node qa-v91.cjs: aprobado. Se actualizaron las comprobaciones obsoletas de contrato 6 y formato de salto de linea.
- node --test tests/checkout-recovery.test.cjs: 4 aprobadas. Prueban seleccion y reutilizacion del intento; no realizan cobros reales.
- npm run qa: NO aprobado completamente: qa-i18n-v87.cjs informa textos sin cobertura en index.html. No se alteraron ni ocultaron estas comprobaciones ni se modifico el portal.

No se modificaron app.js, www/app.js, menu, horarios, estaciones, autenticacion ni datos locales. No se ejecutaron migraciones ni pagos en produccion. La migracion requiere validacion en Supabase de prueba y la recuperacion del pago requiere prueba integrada con Stripe antes de produccion.

Para instalar seguir ENTREGA-RC-ORDERA-V91.md. Si V91-01 a V91-06 ya estan aplicadas, ejecutar la V91-07 revisada, verificar compatible=true y desplegar marketplace-checkout en Supabase. Solo subir los archivos a GitHub/Vercel no instala estos cambios de servidor.
