# Cuarta mejora incremental — 2026-10-11

Base a5f284664dca27ace3a0b9b64a7c1cc451759ab4, rama codex/rc-ordera-fusion-v6. Sus dos controles CI aprobaron. Main y producción intactos.

Hallazgos reproducidos: validación por prefijo permitía HTTP a localhost.evil.test y hosts similares; respuestas HTTP 200 vacías o sin ok:true se aceptaban como autorización sending o registro result. Esto podía permitir transmisión sin acuse o retirar prematuramente el diario local.

Correcciones: URL parseada, HTTP solo para hostname exacto localhost/127.0.0.1; rechaza credenciales y fragmentos; redirect:error evita seguir redirecciones con token; límites de timeout validados. JSON debe ser objeto; claim exige operation explícita (null significa idle), sending/result exigen ok:true y ausencia de error. Un acuse inválido conserva incertidumbre.

Validación: npm run qa, 393 casos aprobados, cero fallidos. Seis casos nuevos: destinos engañosos, redirecciones/timeout, ACK, claim, impresión bloqueada y recuperación de resultados sin repetir impresión. Sintaxis/distribución por qa:policy. Se repite instalación y QA en extracción limpia del ZIP. No se ejecutan migraciones, cobros, hardware ni conectores comerciales. Nueve pruebas Supabase siguen pendientes sin entorno; E2E local sigue bloqueado por instalación Chromium. CI del borrador ejecuta navegador; revisar revisión actual. No se midió CPU ni se certificó aislamiento real.

Objetivos: refuerza puente fiscal (3), seguridad del token y validación (8), recuperación/producción (10); conserva módulos de los otros objetivos. Pedidos/RLS necesitan staging, cocina/repartidores pruebas móviles, POSNET modelo oficial/hardware, pagos sandbox y reparto autorización comercial. No se asigna porcentaje global.

Instalar y validar: npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt. El CLI fiscal continúa limitado a mock. Para recuperar, mantener diario y operaciones UNKNOWN; los fallos de ACK se reportan otra vez, no se reimprimen. Leer DEPLOYED-COMPAT-20261011.md antes de SQL. Revertir el commit revierte cliente sin borrar datos, pero restaura las vulnerabilidades descritas. No desplegar producción sin revisión y autorización.
