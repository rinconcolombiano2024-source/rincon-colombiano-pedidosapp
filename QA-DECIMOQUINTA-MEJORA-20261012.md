# Decimoquinta mejora — compra protegida y sincronización del borrador

## Resultado y alcance

Se parte de 29ab6767cc4006315d7cc2ed74ee8f56db5c7e9d. La mejora del checkout se subió como 5bd55f6e1e9948aad1c173b45106e86640b790fc. Mientras se verificaba, la rama recibió cambios adicionales hasta 59bdc2e893f3df28cddde03491a84d4c7cf6abfa. Se respetó el rechazo de actualización por cambio de cabeza; se incorporaron los 25 archivos diferentes y se repitió QA sobre el conjunto. No se sobrescribió el trabajo concurrente.

## Corrección implementada en esta revisión

El bloqueo anterior empezaba en la petición de creación y dejaba fuera el guardado asíncrono del perfil. Veinte intentos concurrentes iniciaban veinte guardados; además, cambiar de cuenta/restaurante durante ese guardado permitía continuar la creación bajo otro contexto. Tres regresiones reprodujeron estos problemas antes de corregirlos.

Ahora el bloqueo cubre todo el envío. Mientras espera: botón con texto de espera ES/PL/EN y aria-busy, campos de dirección/pedido y controles del carrito deshabilitados, adición de productos y cambio de restaurante detenidos. Re-renderizar conserva el bloqueo. Al terminar o fallar se restaura el estado previo de los controles, incluidos los que ya estaban deshabilitados. La identidad de cuenta/restaurante se comprueba antes de crear el pedido después del guardado del perfil. Se conserva la comprobación posterior de respuesta y el motor de idempotencia existente.

Cuatro nuevas pruebas de lógica y tres escenarios E2E (ES/PL/EN, ejecutados en tres tamaños) cubren guardado, identidad, controles, re-render y recuperación. No sustituyen ventas reales ni RLS real.

## Cambios concurrentes conservados y verificados

- Centro de integraciones adaptable a 320 px y controles táctiles de al menos 44 px; prueba E2E de medidas y desbordamiento.
- Seleccionar otra vez el mismo idioma evita recorrer de nuevo la pantalla.
- PWA: cien versiones de un recurso usan una sola entrada canónica; no se guardan rutas desconocidas ni variantes de consulta con tokens. El fallback offline se conserva.
- Las notificaciones se restringen a la página del colaborador y no reemplazan una pestaña POS/administrativa activa.
- Límites reales de lectura del cuerpo en cancelaciones y gateway fiscal, incluso sin Content-Length; rechazo de JSON/tipos/UTF-8 inválidos.
- Solicitudes financieras autenticadas rechazan redirecciones.

Estos cambios llegaron a GitHub durante la revisión; no se atribuyen como desarrollados desde cero en esta entrega.

## Resultados

- npm run qa sobre el conjunto: 455 pruebas aprobadas, cero fallidas; 178 archivos de sintaxis, 50 fuentes/www iguales y 10 identificadores V5.
- CI sobre 59bdc2e893f3df28cddde03491a84d4c7cf6abfa: dos ejecuciones exitosas (38171316773 y 38171313093). Log de navegador: 99 passed (33.5s), móvil/tableta/escritorio. Una ejecución posterior cancelada no se cuenta como aprobada.
- Primer CI del checkout: 93 aprobadas y tres fallidas por discrepancia del literal polaco normalizado. Se corrigió el texto a «Wysyłanie zamówienia...» y se mantuvieron todas las aserciones de bloqueo/recuperación; el conjunto posterior aprueba.
- Supabase TEST: nueve pruebas omitidas, no aprobadas, por ausencia de proyecto/cuentas de pruebas.
- Verificación del paquete: instalación limpia, repetición de QA y manifiesto SHA-256; resultado final y hash del ZIP se publican en PR #1.

## Rendimiento y límites

La prueba concurrente reduce 20 guardados de perfil a uno durante el mismo envío. El test de caché demuestra 100 variantes de URL en una entrada. Son contadores deterministas; no se extrapolan a porcentajes de CPU global ni memoria total. No se añadieron timers ni polling al bloqueo del checkout.

No se ejecutaron operaciones comerciales, impresión física ni SQL productivo. No hay certificación de ausencia absoluta de errores ni revisión visual humana de todas las pantallas. Siguen pendientes hardware POSNET/protocolo, proveedores oficiales, Stripe test, RLS y concurrencia Supabase real, GPS/push en dispositivo y staging con migraciones controladas. Main permanece sin modificar.
