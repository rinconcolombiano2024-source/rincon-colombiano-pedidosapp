# RC ORDERA · Reducción de solicitudes duplicadas en el arranque POS (2026-10-12)

## Hallazgo concreto
Al iniciar sesión en una tableta sin menú local, `loadCloudData()` leía
`app_settings` para recuperar el menú con urgencia y, acto seguido,
realizaba **otra petición** a la misma fila de `app_settings` para cargar
el resto de ajustes. Se transfería el mismo catálogo dos veces y se
aplicaban dos evaluaciones de políticas RLS innecesarias.

## Cambio seguro
- La primera petición recupera en una sola lectura todos los campos que
  requiere la lectura ordinaria (`menu`, `settings`, revisiones y fechas).
- Si la primera petición se confirma, se reutiliza su resultado en la
  fase principal: **1 llamada en lugar de 2** para arranques sin menú local.
- Si falla, se conserva exactamente la segunda petición con timeout:
  el menú puede recuperarse tras un fallo temporal.
- Si ya existe menú local, se mantiene el arranque local-first y la
  consulta ordinaria, sin cambios.
- Si no hay menú remoto, se respeta el resultado vacío y los resguardos
  contra pérdida de un menú local.
- Mismo contrato Supabase, sin migraciones SQL ni modificaciones de
  datos, caja fiscal, pagos o seguridad. `app.js` y `www/app.js`
  reflejados byte por byte y ledger reversible actualizado.

## Pruebas
Pruebas de VM de la ruta real de código: arranque frío, caliente,
lectura inicial fallida y menú remoto vacío; más GitHub CI/Playwright.

No asegura una reducción determinada de la CPU del servidor. La
observación de Postgres muestra que el coste acumulado está dominado
por consultas de decodificación WAL de Realtime; **no es una
medida directa del % de CPU**. La CPU en Supabase Dashboard, el caudal
de eventos y las tasas de queries requieren seguimiento de ventanas.
