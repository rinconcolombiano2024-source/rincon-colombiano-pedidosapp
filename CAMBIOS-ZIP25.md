# Cambios exactos frente al ZIP (25)

Lineas referidas a los archivos nuevos. No se cuentan como cambios los archivos identicos.
Las lineas marcadas con ancla indican una eliminacion sin lineas nuevas en ese punto.

| Archivo | Lineas modificadas/agregadas | Correccion |
| --- | --- | --- |
| .github/workflows/supabase-test.yml | Nuevo: 1-34 | Preflight y workflow de integracion TEST; ejecucion real aun pendiente. |
| .gitignore | Nuevo: 1-6 | Excluir temporales/dependencias y fuentes internas del hosting. |
| .vercelignore | Nuevo: 1-16 | Excluir temporales/dependencias y fuentes internas del hosting. |
| LEEME-ENTREGA-ZIP25.md | Nuevo: 1-120 | Documentacion de esta entrega. |
| MIGRACION-V91-08-CONCILIACION-DISPUTAS.sql | Nuevo: 1-126 | Conciliacion de disputas y propiedad de retenciones, servicio restringido. |
| MIGRACION-V91-09-CONCILIACION-REEMBOLSOS.sql | Nuevo: 1-155 | Refund verificado, cola de reversiones, leases y conservacion del hold. |
| admin-manifest.en.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| admin-manifest.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| admin.html | 91 | Carga de la misma version del SDK desde el proyecto. |
| admin.js | 70 | Carga de la misma version del SDK desde el proyecto. |
| app.js | 1-9, 2917, 3026-3035, 6675, 11216 | UUID valido, retorno onboarding y SDK local. |
| cliente-manifest.en.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| cliente.html | 813 | Carga de la misma version del SDK desde el proyecto. |
| cliente.js | 1883, 4814-4819 | UUID valido y SDK local; no cambio del carrito. |
| colaborador-manifest.en.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| colaborador.html | 399 | Carga de la misma version del SDK desde el proyecto. |
| colaborador.js | 568, 2437-2443 | Retorno onboarding y SDK local. |
| manifest.en.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| manifest.pl.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| manifest.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| mesero-manifest.en.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| mesero-manifest.webmanifest | 6 | Rutas/versiones de entrada y manifests de restaurante. |
| mesero.html | 214 | Carga de la misma version del SDK desde el proyecto. |
| mesero.js | 1-9, 1086, 1315-1316 | UUID valido y Realtime del catalogo publico con filtro correcto. |
| package-lock.json | 16, 75-81 | Ejecutar pruebas de regresion y fijar PGlite solo para desarrollo. |
| package.json | 7, 22, ancla 28 | Ejecutar pruebas de regresion y fijar PGlite solo para desarrollo. |
| qa-v91.cjs | 51 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| restaurante-manifest.en.webmanifest | Nuevo: 1-19 | Rutas/versiones de entrada y manifests de restaurante. |
| restaurante-manifest.pl.webmanifest | Nuevo: 1-19 | Rutas/versiones de entrada y manifests de restaurante. |
| restaurante.html | 1108, ancla 1114 | Carga de la misma version del SDK desde el proyecto. |
| scripts/prepare-capacitor.mjs | 15, 29-30, 33-35, 66-69 | Incluye restaurante, manifests y vendor; subdirectorios y paridad. |
| scripts/require-test-supabase.cjs | Nuevo: 1-7 | Preflight y workflow de integracion TEST; ejecucion real aun pendiente. |
| scripts/serve-static.cjs | 6-7, 36 | Sirve los headers de seguridad reales durante E2E. |
| service-worker.js | 1, 5, 19, 21-23, 54, 59-69, 92, 99, 115, 118, 124, 127-130 | Fallback offline, precache de restaurante/SDK y caches limitadas a RC ORDERA. |
| supabase/functions/_shared/refund-reconciliation.ts | Nuevo: 1-72 | Reversiones de refunds con cola persistente, confirmacion y backoff. |
| supabase/functions/delivery-quote/index.ts | 90-94 | Cuota estable por identidad; no reiniciarla cambiando User-Agent. |
| supabase/functions/marketplace-checkout/index.ts | 92, 97-99, 106-136, 138-140, 145, 159-160, 167-168, 170-171, 174, 177-180, 183-188, 191-192, 195-197, 204-207, 216-219, 221, 224-226, 228, ancla 229, 233, 235 | Reutilizacion de intentos, idempotencia y conservacion de estados. |
| supabase/functions/marketplace-onboarding/index.ts | 16, 20-21, 54, 57, 61, 64, 72-73, 76, 79-81, 83-109, 112, 116-120, 122, ancla 123, 125, 127-131, 134-137, 140-143, 145, 147, 153-155, 165-168, 170, 174-177 | Reserva, recuperacion y retorno correcto del onboarding. |
| supabase/functions/marketplace-settlement/index.ts | 2, 48-54 | Reversiones de refunds con cola persistente, confirmacion y backoff. |
| supabase/functions/marketplace-webhook/index.ts | 2, 62, 67, 73, 78, 163, 169-174, 182, 186-188, 192, 194-222, 256, 258, 260, 265, 272-294, 297, 299, 305, 310, 312, 314-316, 327-331 | Disputas cerradas, refunds completos/paginados y persistencia de eventos. |
| tests/checkout-idempotency.test.cjs | Nuevo: 1-136 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/delivery-quota.test.cjs | Nuevo: 1-30 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/dispute-sql.test.cjs | Nuevo: 1-96 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/e2e/interactions.spec.js | 13 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/e2e/runtime-security.spec.js | Nuevo: 1-15 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/e2e/smoke.spec.js | 5-6 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/e2e/support/supabase-mock.cjs | 78 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/offline-runtime.test.cjs | Nuevo: 1-71 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/onboarding-idempotency.test.cjs | Nuevo: 1-95 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/refund-sql.test.cjs | Nuevo: 1-110 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/refund-worker.test.cjs | Nuevo: 1-65 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/uuid-fallback.test.cjs | Nuevo: 1-25 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/vendor-runtime.test.cjs | Nuevo: 1-18 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| tests/webhook-disputes.test.cjs | Nuevo: 1-107 | Pruebas de regresion y actualizacion de rutas/SDK en E2E. |
| vendor/README.md | Nuevo: 1-10 | Bundle original 2.57.4, licencia y trazabilidad. |
| vendor/SUPABASE-LICENSE.txt | Nuevo: 1-21 | Bundle original 2.57.4, licencia y trazabilidad. |
| vendor/supabase-2.57.4.js | Archivo nuevo original (131061 bytes); hash en vendor/README.md | Bundle original 2.57.4, licencia y trazabilidad. |
| vercel.json | 22 | CSP compatible con SDK local y Maps; no CSP estricta por nonces. |
| www/admin-manifest.en.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/admin-manifest.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/admin.html | 91 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/admin.js | 70 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/app.js | 1-9, 2917, 3026-3035, 6675, 11216 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/cliente-manifest.en.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/cliente-manifest.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/cliente.html | 723-727, 813 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/cliente.js | 1883, 4814-4819 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/colaborador-manifest.en.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/colaborador-manifest.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/colaborador.html | 385, 399 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/colaborador.js | 568, 2437-2443 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/index.html | 1, 3-7, ancla 8, 10, 12-14, ancla 15, 17-229, 231, 233-234, 236, 238, 240-243, 245-246, 248, 250-251, 253, 255, 257-260, 262-263, 265, 267, 269-271, 273-276, ancla 277 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/manifest.en.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/manifest.pl.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/manifest.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/mesero-manifest.en.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/mesero-manifest.webmanifest | 6 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/mesero.html | 214 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/mesero.js | 1-9, 1086, 1315-1316 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/restaurante-manifest.en.webmanifest | Nuevo: 1-19 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/restaurante-manifest.pl.webmanifest | Nuevo: 1-19 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/restaurante-manifest.webmanifest | Nuevo: 1-34 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/restaurante.html | Nuevo: 1-1114 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/service-worker.js | 1, 5, 19, 21-23, 54, 59-69, 92, 99, 115, 118, 124, 127-130 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/vendor/SUPABASE-LICENSE.txt | Nuevo: 1-21 | Copia generada y emparejada con raiz; sin edicion independiente. |
| www/vendor/supabase-2.57.4.js | Nuevo: 1-1 | Copia generada y emparejada con raiz; sin edicion independiente. |

Archivos agregados/modificados: 86 (mas este informe generado).
Archivos originales eliminados: 0. Historico SQL original conservado; solo se agregan V91-08 y V91-09.

Ver LEEME-ENTREGA-ZIP25.md para resultados, limites y orden de despliegue.

