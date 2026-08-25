# RC ORDERA V87 - Reporte de traducción

Fecha de cierre técnico: 25 de agosto de 2026.

## Alcance realizado

Se trabajó exclusivamente sobre la traducción de la versión V86.1, sin cambiar diseño, lógica comercial, pagos, seguridad, rutas ni flujos operativos.

La versión V87 incorpora una fuente local estable para español, polaco e inglés. El cambio de idioma siempre parte del texto original y no encadena traducciones entre idiomas. Los textos de interfaz permanecen disponibles sin conexión.

## Cobertura inventariada

- 886 textos exactos registrados en el catálogo central, con valor ES, PL y EN.
- 26 patrones para textos dinámicos con variables.
- 308 claves propias del entorno del cliente en cada idioma.
- 1.194 claves exactas controladas por idioma entre el catálogo central y el cliente.
- 1.220 controles de traducción por idioma al incluir patrones dinámicos.
- 293 entradas antiguas de compatibilidad en polaco y 293 en inglés; ninguna superficie visible depende exclusivamente de ellas (`legacyOnlyVisible: 0`).
- 54 llamadas `alert`, 17 llamadas `confirm` y 2 llamadas `prompt` protegidas por traducción local.
- 131 placeholders, 69 `aria-label`, 21 atributos `title` y 6 textos `alt` revisados.

## Cambios principales

1. Se creó `offline-i18n.js` como catálogo central ES/PL/EN.
2. `auto-translate.js` conserva el texto original y permite cambios reversibles sin conexión.
3. Se completaron y corrigieron las 308 claves del cliente en los tres idiomas.
4. Se corrigieron tildes y ortografía española solamente sobre textos de interfaz.
5. Se normalizaron los signos y caracteres polacos sin alterar nombres, direcciones, notas, chats ni datos de usuarios.
6. Se localizaron los mensajes dinámicos, validaciones, estados vacíos, cargas, errores, avisos y confirmaciones.
7. Se sustituyeron detalles técnicos visibles por mensajes profesionales; el diagnóstico técnico permanece en consola.
8. Se añadieron manifests ES/PL/EN para restaurante, cliente, colaborador, mesero y administración.
9. El service worker incluye el catálogo y los manifests locales, limpia cachés anteriores y localiza notificaciones PWA.
10. La función `courier-push` usa `preferred_language` para la notificación de una nueva entrega.
11. Los tickets y cierres usan el idioma y la configuración regional seleccionados sin traducir datos del restaurante o del pedido.
12. La copia `www` utilizada por Android fue regenerada desde los archivos V87.

## Archivos de aplicación modificados

- `index.html`, `cliente.html`, `colaborador.html`, `mesero.html`, `admin.html`.
- `app.js`, `cliente.js`, `colaborador.js`, `mesero.js`, `admin.js`.
- `auto-translate.js`, `offline-i18n.js`.
- `service-worker.js`.
- `manifest.webmanifest`, `cliente-manifest.webmanifest`, `colaborador-manifest.webmanifest`, `admin-manifest.webmanifest`.
- Manifests nuevos `.pl.webmanifest` y `.en.webmanifest` para los cinco entornos, incluido el nuevo manifest del mesero.
- `supabase/functions/courier-push/index.ts`.
- `scripts/prepare-capacitor.mjs`, `package.json`, `qa-v86.cjs`, `qa-i18n-v87.cjs`.
- La carpeta `www` contiene la copia Android equivalente y sincronizada.

## Pruebas realizadas

- QA funcional heredado: 175 comprobaciones, resultado OK.
- QA de traducción: 1.964 comprobaciones, resultado OK.
- Paridad de claves ES/PL/EN: OK, sin valores vacíos ni claves duplicadas.
- Textos estáticos y dinámicos sin cobertura local: 0.
- Textos técnicos visibles en HTML, diálogos y salidas dinámicas: 0.
- Caracteres dañados o mojibake: 0.
- Vistas públicas comprobadas: restaurante, cliente, colaborador, mesero y administración en ES, PL y EN, 15 combinaciones.
- Mezcla de frases españolas detectada en PL/EN después de estabilizar la carga: 0.
- Desbordamiento horizontal de página en las 15 combinaciones: 0.
- Prueba móvil a 390 x 844 para cliente y colaborador: correcta, sin superposición ni desbordamiento.
- Cambios sin conexión comprobados: ES → PL → EN → ES, PL → ES → EN → PL y EN → PL → ES → EN.
- La prueba sin conexión se ejecutó con el servidor local realmente detenido.

## Instalación y despliegue

Esta fase no requiere migración SQL ni modifica tablas, datos, usuarios, roles o políticas RLS.

Para publicar la traducción web, despliega la carpeta V87 completa en Vercel. Para que las notificaciones de asignación de colaboradores también salgan en su idioma, despliega la versión V87 de la Edge Function `courier-push`. No se añadieron ni cambiaron secretos.

## Validación pendiente antes de certificación comercial

Las superficies públicas, el runtime y todos los generadores de texto identificados quedaron cubiertos. Los recorridos visuales de pantallas que exigen cuentas autenticadas reales, permisos específicos, pedidos reales o documentos no se ejecutaron porque esta copia no incluye credenciales de prueba seguras para cada rol. Sus cadenas fueron revisadas estáticamente y están incluidas en el QA, pero la certificación visual absoluta de esos estados requiere cuentas controladas de cliente, restaurante, mesero, colaborador y administrador en un entorno de pruebas.

Por esa razón, este reporte certifica cobertura técnica completa del inventario identificado y no afirma una validación comercial integral de flujos autenticados que no se pudieron abrir de manera segura.
