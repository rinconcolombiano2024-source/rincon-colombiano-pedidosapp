# Revisión independiente de RC ORDERA V6 — 2026-10-12

## Línea de base
- Rama fuente: `codex/rc-ordera-fusion-v6` (commit `59bdc2e893f3df28cddde03491a84d4c7cf6abfa`).
- Esta rama de revisión no afecta `main`, Supabase de producción ni despliegues.
- La V5 que se guardó en el chat es histórica; no sobrescribir con ella módulos V6.

## Defectos confirmados y correcciones

### P1: fallo de reclamación fiscal tratado como inactividad
- Archivo: `fiscal-agent/src/gateway-client.mjs`.
- Antes: cualquier HTTP 409 en `claim()` devolvía `null`; la pasarela responde HTTP 409 ante `CLAIM_FAILED` (error RPC) y `PAYLOAD_TENANT_MISMATCH` (aislamiento). El agente podía interpretarlo como una cola vacía, sin distinguir un error del servidor.
- Después: `null` exclusivamente cuando el servidor devuelve un `200` validado con `operation:null`; errores se propagan al bucle del agente, que aplica backoff. No se dispara impresión por error.
- Se comprueba además que `operation_id` sea UUID y que `fiscal_payload` sea objeto; una respuesta inesperada no se procesa.

### P2: recuperación del diario fiscal sin presupuesto de trabajo
- Archivo: `fiscal-agent/src/agent.mjs`.
- Antes: cada iteración consultaba y escribía TODAS las operaciones desconocidas del diario (O(N) conciliaciones remotas y escrituras/fsync por ciclo), incluso las que necesitaban revisión humana. Esto puede incrementar carga con el tiempo.
- Después: hasta **25 reconciliaciones por pasada**, con cursor circular, incluyendo todas las identidades en el conjunto de bloqueo contra reimpresión. Los restantes registros no se descartan. No hay timers ni polling nuevos.
- La optimización limita *cantidad de tareas por iteración*, no garantiza una reducción porcentual de CPU/latencia de equipos reales.

### QA de interfaces y español/polaco/inglés
- Archivo: `tests/e2e/customer-mobile-ux.spec.js`.
- Verifica vista cliente a 320 px en ES/PL/EN: botones esenciales visibles, dimensiones táctiles, sin desbordamiento horizontal y cierre del diálogo de instalación. Las pruebas se repiten en la matriz de dispositivos configurada por Playwright.
- Esta ampliación de pruebas no representa un rediseño completo ni una inspección visual humana de todas las pantallas.

## Pruebas añadidas
- `fiscal-agent/tests/gateway-client.test.mjs`: 4 casos sobre códigos 409, inactividad real, agente sin impresión y payload malformado.
- `fiscal-agent/tests/recovery-bounds.test.mjs`: 3 casos de límite 25, cobertura circular, bloqueo de reimpresión y recuperación de diarios pequeños.
- `tests/e2e/customer-mobile-ux.spec.js`: 3 escenarios nuevos (ES/PL/EN), multiplicados por los proyectos de Playwright.
- La validación final debe leerse en el CI del SHA de la rama; los casos omitidos por falta de Supabase staging no se cuentan como aprobados.

## Diez objetivos: estado cualitativo (no porcentaje)
1. Pedidos — simulaciones y contratos; falta flujo real de extremo a extremo con usuarios, concurrencia y RLS.
2. POS/cocina/meseros — sistemas conservados; falta sesión multidispositivo.
3. Fiscal — mejora en reclamación y recuperación; POSNET real, protocolo y prueba física pendientes. Agente actual opera solo con driver mock.
4. Reparto — outbox y adaptadores preparados; plataformas comerciales requieren autorización oficial.
5. Pagos — pruebas simuladas; Stripe test/BLIK y liquidación oficial pendientes.
6. Contabilidad — controles de moneda, IVA y cierres; auditoría con ventas/recibos reales pendiente.
7. Repartidores — estados y GPS preparados; pruebas físicas y notificaciones pendientes.
8. Seguridad/CPU — recuperación fiscal acotada; falta carga real, PostgreSQL multi-conexión y Supabase RLS.
9. Diseño/idiomas — QA móvil ampliada; inspección visual manual y accesibilidad completa pendientes.
10. Producción — **NO APROBADA** hasta completar pruebas externas, staging, despliegue seguro y rollback.

## Condiciones de fusión
- Todos los jobs obligatorios de GitHub Actions deben terminar en verde sobre el HEAD exacto.
- Mantener `main` intacto y fusionar únicamente hacia el borrador V6.
- No ejecutar migraciones antiguas por orden ciego ni habilitar POSNET, Stripe, BLIK o plataformas externas sin hardware/certificación/credenciales oficiales.
