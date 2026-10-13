# RC ORDERA — reducción de escrituras por apertura de QR (13-10-2026)

## Hallazgo verificado
En `app.js`, `syncMenuBeforeQr()` ejecutaba `saveCloudMenu()` **en cada apertura del QR cliente**, incluso cuando no había modificaciones. La función de Supabase `save_current_restaurant_menu` hace `SELECT ... FOR UPDATE` sobre `app_settings` antes de descubrir que el menú es idéntico; por tanto, cada QR producía una transacción, un bloqueo de fila y una lectura de verificación posterior. Pulsaciones simultáneas podían desencadenar guardados duplicados.

## Cambio preservador
- Si NO existe `menuPending`, tenemos la última revisión confirmada para el mismo restaurante y el menú local coincide con la copia confirmada, se omite toda escritura del menú. El enlace QR sigue apuntando a Cliente, que **consulta el menú público en la nube independientemente**.
- Si faltan datos confirmados, hay descripciones/productos cambiados, o existe un `menuPending`, **se conserva** el proceso actual completo (materializar imágenes, RPC, resolver revisiones, verificar la proyección Cliente/Caja).
- Se añade control single-flight en `syncMenuBeforeQr()`: pulsar dos veces no produce dos operaciones simultáneas.
- Se preserva cualquier token de edición local que cambie mientras guardamos. En ese caso no se declara sincronizado ni se elimina la información pendiente.
- Una sesión que cambie mientras se espera no abre el QR anterior. Dos pulsaciones simultáneas no intentan abrir dos veces el diálogo.
- No hay nuevas tablas, RLS, intervalos, suscripciones ni migraciones. Copias web/Android de `app.js` idénticas, hash SHA-256 actualizado en `tests/hardening/reviewed-source-deltas.json`.

## Verificación
`node --test tests/qr-menu-rpc-throttle.test.cjs` junto con `npm run qa` y Playwright E2E; CI de GitHub obligatorio antes de fusionar.

## Límites
No mide el porcentaje de CPU del servidor. Reduce **una fuente demostrable de escrituras redundantes** y contención de fila al abrir QR, no todas las fuentes de carga de Supabase. La web en Vercel seguirá usando el código anterior hasta resolver el bloqueo de builds. La APK de pruebas descargada antes también conserva el comportamiento anterior; para usar esta modificación en Android es necesario volver a compilar y probar el nuevo APK. No borres datos locales del dispositivo donde hay descripciones pendientes.
