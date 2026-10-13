# RC ORDERA — Navegación nativa Android a Cliente y Estaciones

Se añade `@capacitor/browser@8.0.5`, con versión fijada en package-lock y un puente al final del bundle existente `restaurant-fiscal-ui.js`. Desde la aplicación Android, **Abrir cliente**, **Abrir estación** y **Cocina** usan Custom Tabs sin destruir la actividad principal del restaurante. Los navegadores y las PWA siguen usando enlaces HTML `target="_blank"`.

Seguridad: origen HTTPS único aprobado, rutas `cliente.html` y `mesero.html`, ninguna navegación a localhost ni dominios arbitrarios. Si el plugin nativo no existe en el APK antiguo, la navegación se bloquea y se informa al usuario sin cerrar el restaurante. No se introducen consultas, timers o escrituras nuevas en Supabase.

Para que Android utilice el nuevo plugin es **obligatorio compilar e instalar una nueva versión nativa** con `npm ci && npm run android:sync` y construir el APK/AAB firmado. Una publicación web por Vercel **no actualiza** el plugin de un APK anterior.

El navegador embebido de Android abre la URL publicada `https://rincon-colombiano-pedidosapp.vercel.app` (no la copia local del APK). El módulo Estaciones requiere su autenticación y autorización habituales; no se transportan credenciales ocultas en el enlace. Verificar el despliegue web y la cuenta del empleado.

Pruebas de regresión: `node --test tests/android-native-module-browser.test.cjs`; pruebas E2E web de pestañas separadas siguen intactas. Falta prueba en dispositivo Android físico, que es puerta de salida de la versión nativa.

Este cambio **no** habilita la impresión fiscal: el botón POSNET existente sigue siendo preflight de permiso USB, no una certificación de emisión.
