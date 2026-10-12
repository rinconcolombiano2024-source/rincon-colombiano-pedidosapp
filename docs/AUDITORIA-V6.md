> Informe histórico incluido en el ZIP recibido. Sus cifras y afirmaciones no certifican esta entrega. Consulta MERGE-REPORT.md y QA-REPORT.md para las correcciones y resultados actuales. PGlite ejecuta PostgreSQL embebido, pero serializa llamadas; no demuestra concurrencia de conexiones nativas.

# Auditoría y endurecimiento V5 -> V6

## Resultado de la auditoría de V5 (verificado ejecutando, 2026-10-10)
- Manifiesto SHA-256: 481/481 coinciden. Pruebas que corren sin red: todas pasan.
- No ejecutables sin red (5 archivos): requieren `@electric-sql/pglite` (pruebas contra Postgres real) o `xcode`. RLS (7) omitidas: requieren Supabase de pruebas.
- Hallazgos A (fiscal), B (outbox), C (conciliación), D (migraciones), F (identificadores) y G (centro de integraciones): resueltos en V5 (A, C: criterio conservador; B: reclamación atómica con token y estados `processing`/`unknown`).

## Cambios V6 (todos con prueba)
| Hallazgo | Corrección | Verificación |
|---|---|---|
| CSP permitía `unsafe-inline` | Hash SHA-256 del único script inline; `unsafe-inline` eliminado de la CSP activa y de Report-Only | `tests/shared/csp-policy.test.mjs` + Chromium real: el script autorizado se ejecuta y un script inline no autorizado queda BLOQUEADO |
| Traducción pública abusable (cuota falsificable, tabla sin límite) | `MIGRACION-V5-20261010-08`: tope global horario atómico y diario, limpieza acotada; la Edge Function usa `cf-connecting-ip`, cae a v1 si v2 no está aplicada y falla cerrada ante otros errores | `tests/shared/translation-quota.test.mjs` (estructura). **El SQL no se ha ejecutado contra Postgres.** |
| IVA sin interfaz (puntos 6 y 9) | Selector **IVA del producto** (heredar/23/8/5/0/ZW) y **IVA por defecto del restaurante** en el editor de menú; ES/PL/EN. 'Heredar' no escribe la clave `vatRate` (el servidor usa `defaultVatRate`); un valor inválido nunca se guarda. Cambios registrados como deltas revisados reversibles (`tests/hardening/reviewed-source-deltas.json`) | `scripts/browser-menu-vat.py` en Chromium real: guardado, persistencia, carga en el formulario, ajuste por defecto e idiomas. Lectura del servidor: `save_current_restaurant_menu/settings` guardan el JSON tal cual (por lectura de SQL, no ejecutado) |
| Outbox: `CLAIM_LOST` abortaba el lote | `finish` aislado: se cuenta como `lost`, el resto se procesa; errores de almacén distintos se propagan | `delivery-bridge/tests/outbox-claim-lost.test.mjs` |
| Conciliación: varias filas del proveedor (cargo + reembolso) daban falso positivo | Opción explícita `aggregateProviderRows` (suma con signo contra `amount - refunded_amount`); por defecto sigue ambiguo; duplicados locales nunca se agregan | `accounting/tests/reconcile-aggregate.test.mjs` |

## Pendientes conocidos (no resueltos)
1. Clave de Google Maps en el repositorio: restringir por dominio o rotar (el escáner la avisa).
2. Los QR se generan con `api.qrserver.com` (tercero): el enlace viaja a un servicio externo; sustituir por generación local.
3. CSP: la política con `default-src`/`connect-src` sigue en Report-Only; promoverla requiere probar Maps y Stripe en línea.
4. IVA: la interfaz existe, pero **las tasas por plato las debe fijar tu contable**; un plato sin tasa y sin defecto se acepta y el cierre contable lo marca `VAT_RATE_MISSING`. Nota: sin sesión, la app arranca con el menú vacío tras recargar (comportamiento previo, independiente del IVA).
5. UNKNOWN fiscal: no hay herramienta de resolución manual en la interfaz.
6. Todo lo que exige red/hardware/credenciales: Postgres real, RLS en Supabase de pruebas, E2E completo, Stripe en modo de pruebas, sandbox de plataformas, impresora física.

## Nivel real por objetivo (escala del prompt maestro: 1 estructura, 2 implementación, 3 simulador, 4 pruebas oficiales, 5 conexión real, 6 producción)
| # | Objetivo | Nivel | Nota |
|---|---|---|---|
| 1 | Pedidos | 3* | *pruebas de BD declaradas por V5, no reproducidas aquí |
| 2 | Restaurante/cocina | 2-3* | idem |
| 3 | Impresora fiscal | 3 | NoviAPI solo simulación; Posnet/Elzab sin implementar |
| 4 | Apps de reparto | 3 | ninguna plataforma con credenciales ni sandbox |
| 5 | Pagos | 2 | motor existente; sin pruebas en modo test de Stripe |
| 6 | Contabilidad | 3 | cálculos y cierres probados; UI de IVA añadida; faltan tasas reales y cierres persistidos |
| 7 | Repartidores/GPS | 2 | sin prueba con dispositivos |
| 8 | Seguridad | 3 | CSP verificada en navegador; RLS omitida |
| 9 | Administración | 2 | centro de integraciones e IVA presentes; sin resolución UNKNOWN ni pantalla de comisiones verificada |
| 10 | Producción | 0 | requiere entorno real |
