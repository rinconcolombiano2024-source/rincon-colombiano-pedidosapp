# RC ORDERA V91.0.3 - Informe final de reparaciones

## 1. CORREGIDO

1. `www/` dejo de ser una fuente paralela: se regenera desde los 33 archivos runtime raiz y el script confirma byte por byte que cada copia coincide.
2. `android:open` ejecuta primero `android:sync`, evitando abrir Android con archivos web antiguos.
3. Se agrego `www/` a `.gitignore` para identificarlo como artefacto generado.
4. El QA del Service Worker ahora valida el comportamiento network-first vigente: red primero, actualizacion de cache, fallback a cache y respuesta 503 cuando no existe ningun recurso.
5. La version activa quedo unificada en V91.0.3 en paquete, runtime, PWA, enlaces internos, invalidacion de assets, notificacion del colaborador y metadatos Android generados.
6. Los tres mensajes indicados quedaron cubiertos en espanol, polaco e ingles mediante el catalogo offline existente.
7. Los tres puntos de uso traducen el mensaje antes de mostrarlo o propagarlo.
8. Se corrigio una interpolacion no escapada del nombre editable de un producto en el historial del mesero.

No fue necesaria ninguna migracion SQL.

## 2. ARCHIVOS MODIFICADOS

Fuentes y configuracion:

- `.gitignore`
- `package.json`
- `scripts/prepare-capacitor.mjs`
- `qa-v91.cjs`
- `app.js`
- `cliente.js`
- `colaborador.js`
- `mesero.js`
- `offline-i18n.js`
- `index.html`
- `cliente.html`
- `colaborador.html`
- `mesero.html`
- `admin.html`
- `manifest.webmanifest`
- `manifest.pl.webmanifest`
- `manifest.en.webmanifest`
- `cliente-manifest.webmanifest`
- `cliente-manifest.pl.webmanifest`
- `cliente-manifest.en.webmanifest`
- `colaborador-manifest.webmanifest`
- `colaborador-manifest.pl.webmanifest`
- `colaborador-manifest.en.webmanifest`
- `mesero-manifest.webmanifest`
- `mesero-manifest.pl.webmanifest`
- `mesero-manifest.en.webmanifest`
- `admin-manifest.webmanifest`
- `admin-manifest.pl.webmanifest`
- `admin-manifest.en.webmanifest`
- `supabase/functions/courier-push/index.ts`

Artefactos regenerados automaticamente en `www/`:

- `www/BUILD-METADATA.json`
- `www/index.html`
- `www/cliente.html`
- `www/colaborador.html`
- `www/mesero.html`
- `www/admin.html`
- `www/app.js`
- `www/cliente.js`
- `www/colaborador.js`
- `www/mesero.js`
- `www/offline-i18n.js`
- `www/service-worker.js`
- `www/manifest.webmanifest`
- `www/manifest.pl.webmanifest`
- `www/manifest.en.webmanifest`
- `www/cliente-manifest.webmanifest`
- `www/cliente-manifest.pl.webmanifest`
- `www/cliente-manifest.en.webmanifest`
- `www/colaborador-manifest.webmanifest`
- `www/colaborador-manifest.pl.webmanifest`
- `www/colaborador-manifest.en.webmanifest`
- `www/mesero-manifest.webmanifest`
- `www/mesero-manifest.pl.webmanifest`
- `www/mesero-manifest.en.webmanifest`
- `www/admin-manifest.webmanifest`
- `www/admin-manifest.pl.webmanifest`
- `www/admin-manifest.en.webmanifest`

Este informe tambien fue agregado como `INFORME-REPARACIONES-V91.0.3.md`.

## 3. CAMBIO REALIZADO

- `.gitignore`: declara `www/` como salida generada.
- `package.json`: version 91.0.3 y sincronizacion obligatoria antes de abrir Android.
- `scripts/prepare-capacitor.mjs`: obtiene la version desde `package.json`, regenera `www/` y valida igualdad binaria de los 33 archivos.
- `qa-v91.cjs`: sustituye la expectativa cache-first obsoleta por cuatro comprobaciones del contrato network-first vigente.
- `app.js`: version activa V91.0.3 y traduccion de los tres mensajes autorizados.
- `offline-i18n.js`: agrega exclusivamente las tres filas ES/PL/EN solicitadas.
- `cliente.js`, `colaborador.js`, `mesero.js`: actualizan solamente referencias activas de version; `mesero.js` tambien escapa la linea de producto editable antes de insertarla en HTML.
- Archivos HTML y manifests: actualizan query strings y `start_url` para invalidar correctamente la cache V91.0.2.
- `courier-push/index.ts`: actualiza el enlace profundo del colaborador a V91.0.3.
- `www/`: regenerado desde la fuente; no se edito manualmente.

## 4. PRUEBAS EJECUTADAS

- `node --check app.js cliente.js colaborador.js mesero.js admin.js service-worker.js auto-translate.js offline-i18n.js` - PASS.
- `npm run qa` - PASS.
- `npm run qa:i18n` - PASS, 2.024 comprobaciones.
- `npm run android:prepare-web` - PASS, 33 archivos generados.
- Comparacion SHA-256 raiz contra `www/` para los 33 archivos runtime - PASS, todos identicos.
- Busqueda de referencias activas `91.0.2` y `91-0-2`, excluyendo SQL y documentacion historica - PASS, ninguna encontrada.
- Comprobacion de sintaxis JavaScript generada en `www/` - PASS.
- Comprobacion dirigida de escape de producto en historial del mesero - PASS.
- Busqueda de literales de secretos privados en runtime - PASS, ninguno detectado.
- Revision completa del diff contra el ZIP original - PASS, solo cambios autorizados.

## 5. PENDIENTE

- Consolidar y certificar el orden completo de migraciones V70-V91 exige conocer el estado real del proyecto Supabase. No se creo una migracion nueva.
- Certificar pagos reales, reembolsos, disputas, conciliacion y cuentas Stripe Connect.
- Ejecutar pruebas autenticadas RLS y de aislamiento con usuarios A/B en Supabase real.
- Verificar externamente restricciones HTTP Referrer y APIs permitidas de la clave Google Maps.
- Certificar primer arranque completamente offline, impresion fisica, corte automatico e iOS nativo.
- Implementar monitoreo, CI, restauracion probada de backups y documentacion legal de produccion.
- Actualizar documentacion historica contradictoria requiere una tarea separada para no alterar registros de versiones anteriores.

## 6. NO TOCADO POR RIESGO

- Realtime, polling, `menu_revision`, `settings_revision`, colas pending/confirmed y RPC: la revision dirigida no encontro una carrera o duplicacion reproducible que justificara modificar su comportamiento.
- Los `catch` silenciosos revisados corresponden a limpieza de canales, refrescos de respaldo, mapas, Service Worker o continuacion controlada de colas; no se demostro que ocultaran una escritura critica.
- V91.02, tablas, datos, funciones, triggers y politicas RLS: no se modificaron.
- CSP: no se implemento porque requiere validar todos los dominios de Supabase, Google Maps, Stripe y CDN.
- API key browser de Google Maps: no se retiro del frontend; su restriccion debe comprobarse en Google Cloud.
- Archivos monoliticos, estilo, diseno, interfaz y arquitectura general: no se refactorizaron.

## 7. ESTADO FINAL

- `npm run qa` = **PASS**
- QA i18n = **PASS** (2.024 comprobaciones)
- Sintaxis JS = **PASS**
- Sincronizacion `www/` = **PASS** (33/33 archivos identicos)
- Runtime activo = **V91.0.3**
- Migracion SQL requerida = **NO**

El proyecto queda funcional, sin cambios destructivos y con el ZIP original preservado.
