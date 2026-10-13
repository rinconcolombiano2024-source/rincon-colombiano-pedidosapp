# RC ORDERA — informe de propuesta
Fecha: 2026-10-13.
Commit inicial: 8ee467b7064b3068068755fa8b9479f3773ffcdc.
Rama: codex/rc-ordera-payments-release-20261013.
Estado: propuesta incremental; NO-GO financiero, sin merge ni despliegue live autorizado.
## Defectos reproducidos y corregidos
- SumUp no seleccionable/enrutable por cliente y normalización de configuración.
- RPC existentes rechazaban SumUp incluso con configuración válida.
- Commit SQL rechazaba página hospedada válida por exigir mismo UUID que checkout.
- Verificación monetaria toleraba una fracción no nula de grosz.
- Respuesta de creación perdida carecía de recuperación verificada por referencia.
- Reserva Stripe posterior a reserva SumUp no tenía barrera atómica.
- Temporizador onboarding terminaba antes de leer cuerpo completo.
- Pruebas de distribución Windows usaban separadores incompatibles.
- Fixture de cuotas Windows producía otra huella por CRLF; se normaliza únicamente carga de fixture, preservando rechazo de deriva.

## Archivos
Cliente: app.js, cliente.js, restaurante.html y copias www generadas.
Servidor: _shared/sumup-hosted.ts; sumup-checkout; marketplace-checkout; marketplace-onboarding.
SQL: tres migraciones 20261013 de compatibilidad URL/recuperación, provider en pedidos, reserva cruzada.
Verificación: scripts/check-hardening.mjs; pruebas SumUp, compatibilidad RPC, onboarding, distribución y cuotas.
No framework ni dependencia nuevos. Copias previas ajenas conservadas.

## Evidencia ejecutada
- Suite focal: node --experimental-strip-types --no-warnings --test tests/hardening/sumup-*.test.mjs tests/hardening/deployed-compat.test.mjs tests/hardening/translation-budget.test.mjs tests/hardening/public-distribution.test.mjs tests/payment-onboarding-timeout.test.cjs → 62 aprobadas, 0 fallos.
- npm run qa:e2e → 41 aprobadas, 0 fallos, 27,3 s; servicios simulados/controlados.
- npm run qa:policy → 221 archivos sintácticos, 52 distribuidos, CSP sin unsafe-eval; aprobado.
- npm run qa:shared → 24 aprobadas; la prueba CSP normaliza saltos HTML como el navegador sin cambiar los hashes autorizados.
- npm run qa:accounting → 25 aprobadas; npm run qa:i18n → 2.328 comprobaciones aprobadas.
- npm run qa:secrets → sin secretos privados detectados; claves públicas Google existentes requieren restricciones de API/referrer.
- npm run qa:integration → nueve omitidas por ausencia de staging/fixtures; NO representa validación RLS aprobada.
- QR: comparador de versión fijada conserva todos los caracteres salvo CRLF de checkout; prueba local aprobada.
- npm run qa:hardening final fuera del sandbox → 172 aprobadas de 173; único fallo: diario fiscal Windows EPERM fsync. No se omite ni debilita.
- npm run qa:concurrency-selftest fuera del sandbox → detecta error en 20 rondas sin bloqueo; cero errores con bloqueo. Es un servidor simulado, NO concurrencia Supabase real.
- Suite completa anterior: núcleo 242, fiscal bridge 74, delivery 47, readiness 6 aprobadas fuera del sandbox; fiscal-agent 43/46, tres fallos Windows EPERM en sincronización del directorio. La suite completa NO está aprobada.
- Antes de correcciones: dos fallos focales reprodujeron importe fraccionario y UUID hospedado; otro fallo reprodujo rechazo SumUp por RPC.
Resultados no implican pagos reales ni hardware probado.

## Estado operativo
SumUp: código conectado, pruebas locales; falta despliegue staging, credenciales y proveedores reales.
Stripe: controles existentes preservados; liquidaciones/conciliación y escenarios reales pendientes.
Supabase: no cambio cloud aplicado; staging separado no confirmado. Docker encendido, solo contenedor de prueba creado y detenido al inspeccionar.
Vercel: frontend generado; no despliegue de este paquete confirmado.
Fiscal: no certificación ni impresión física demostrada; fallo Windows bloquea agente.
Reparto: no alta ni contrato con nuevas plataformas realizada; puente existente no equivale a integración comercial validada.
Rendimiento: no porcentaje de mejora prometido; no nuevo polling ni timer permanente.

## Puertas abiertas
Provider sandbox, PostgreSQL concurrente/RLS multicuenta, esquemas desplegados, Stripe dispatch/fencing, fiscal Windows y dispositivo. Revisar RC-ORDERA-GO-LIVE.md antes de cualquier activación.
