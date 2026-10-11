# Sexta mejora incremental — 2026-10-11

Base 6c22bf1c2c503756f80e2a7d04eee1c274785d76; sus dos CI aprobaron. Rama codex/rc-ordera-fusion-v6. Main y producción intactos.

Defectos: conversión externa major usaba Math.round sin validar precisión o rango; podía redondear precios con tres decimales y devolver grosze inseguros. Conversión de strings a Number podía perder fracciones antes de validar unidades minor.

Corrección: cadenas decimales se convierten con BigInt y rango seguro antes de devolver Number. Números validan precisión, ruido de float acotado y rango seguro. Unidades desconocidas fallan cerrado. Se conservan precios cero, strings válidos y 0.1+0.2; no se inventan tasas, importes ni contratos comerciales.

Validación: npm run qa, 399 casos aprobados, cero fallidos. Tres pruebas nuevas cubren exceso de precisión, frontera segura/overflow en ambas unidades y unidades inválidas/cero. qa:policy: 162 archivos sintácticos, 45 fuentes www iguales y diez IDs V5. Se repiten npm ci y qa desde extracción limpia y se verifica manifiesto y equivalencia total con GitHub. Las pruebas E2E reales del CI anterior aprobaron; CI actual por revisar. Nueve pruebas Supabase siguen pendientes sin entorno; E2E local bloqueado por Chromium. No se midió CPU ni se certificó servicios externos.

Objetivos reforzados: normalización de pedidos externos (1/4), exactitud contable (6), validación (8), entrega reproducible (10). Los otros mantienen funcionalidad previa; estado actual en docs/ESTADO-10-PUNTOS.md. Faltan staging/RLS, concurrencia PostgreSQL independiente, móvil, Stripe test, POSNET físico y contratos oficiales.

Instalar: npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt. No aplicar SQL automáticamente. Payloads rechazados deben registrarse/revisarse en backend; no redondear para forzar aceptación. Revertir commit restaura conversión anterior sin cambio de datos; evitar reprocesar/importar operaciones reales sin conciliación e idempotencia. Consultar DEPLOYED-COMPAT-20261011.md antes de migraciones.
