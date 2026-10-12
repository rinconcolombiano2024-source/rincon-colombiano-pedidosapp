# Actualización web V6 — 2026-10-12

El propietario solicita explícitamente fusionar el borrador con el código publicado y actualizar la app.

## Alcance de esta publicación

- PR #1, V6 sobre main `2730150506122ae59ba142ca1ba84ec820acb301`.
- Publicación estática con Vercel: interfaz, idiomas, QR local, instalación PWA, controles de envío y recuperación de seguimiento.
- Se conservan la URL pública de Supabase y los endpoints/payloads vigentes de pedidos y pagos. Vercel no ejecuta las migraciones SQL ni despliega las Edge Functions guardadas en el repositorio.
- La presencia del editor de IVA es metadato de catálogo; no certifica los snapshots fiscales del backend. Antes de usarlo para contabilidad/fiscalización, cumplir las migraciones y verificaciones descritas en DEPLOYMENT-CHECKLIST.md.
- No se habilitan agentes fiscales, conectores comerciales, nuevos cobros ni trabajadores de reparto.

## Corrección previa al merge

Las lecturas públicas de la versión anterior devolvieron HTTP 200 para `supabase-schema.sql`, guías internas y `supabase/config.toml`. La configuración anterior dependía de exclusiones de archivos; se fija explícitamente `outputDirectory: www` con framework estático y sin instalación/build. Se sirve la distribución ya generada, comprobada byte por byte por CI. El repositorio completo no es la raíz pública.

La nueva prueba public-distribution impide devolver la raíz al despliegue, comprueba las páginas y bibliotecas necesarias y rechaza archivos internos en www. BUILD-METADATA.json contiene únicamente nombre/versión públicos.

## Validación y límites

La base be2d72a aprobó 476 pruebas Node y 117 E2E. La corrección de publicación añade una prueba; exigir CI verde y estado Vercel correcto del nuevo HEAD antes de fusionar. Tras el merge, verificar las páginas públicas, cabeceras CSP, archivos internos 404 y hashes de los activos publicados contra el árbol fusionado.

Nueve escenarios Supabase no ejecutados por falta de credenciales TEST. No se certifican transacciones comerciales, CPU global, RLS real, hardware POSNET ni APIs oficiales. La publicación web no equivale a habilitar esos módulos.

## Recuperación

La versión anterior de main queda identificada arriba. Ante fallo operativo de la web, restaurar los archivos de interfaz compatibles mediante un commit revisado o recuperar el deployment anterior en Vercel. Conservar la restricción de raíz pública a www para no reabrir la exposición de archivos. No revertir/eliminar ventas, pagos, tokens ni ejecutar SQL de rollback como parte de esta publicación estática.
