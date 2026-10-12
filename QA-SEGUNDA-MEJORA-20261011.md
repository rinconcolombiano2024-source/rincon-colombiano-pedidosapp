# Segunda mejora incremental — 2026-10-11

Base: 0350440c42f3c62431f1f52ee63d5ffd39caf97e, rama codex/rc-ordera-fusion-v6. Los dos controles CI de esa base terminaron aprobados.

## Defectos corregidos

- Un HTTP fiscal fallido con cuerpo done podía confirmar el simulador. Ahora retorna UNKNOWN sin emitir otro comando.
- Parámetros de sondeo infinitos o inválidos podían causar trabajo sin límite. Se rechazan antes de conectar.
- getStatus identifica explícitamente simulated=true y fiscal=false.
- Conciliación sin agregación ignoraba refunded_amount y podía conciliar erróneamente el bruto de una venta reembolsada. Ahora compara el neto y valida coherencia del estado para ambas modalidades.
- El adaptador de pagos Supabase descartaba refunded_amount; conserva ese importe.

Contrato: una fila de proveedor representa saldo neto liquidado; varias filas firmadas requieren aggregateProviderRows y event_id únicos. Una fila de cargo bruto no demuestra conciliación de un reembolso. No se alteran importes persistidos ni el motor Stripe.

## Validación

npm run qa: 384 casos aprobados, cero fallidos; seis nuevos casos de regresión respecto a la entrega anterior. Sintaxis y distribución se verifican por qa:policy. Se repite QA desde una extracción limpia del ZIP. No hay nueva prueba física ni nueva ejecución real de Supabase. Las 9 pruebas reales siguen bloqueadas sin entorno. No se presentan simulaciones como certificación comercial. No se midió CPU; los límites de sondeo son controles preventivos.

## Diez objetivos

Este bloque refuerza fiscalización (3), pagos/contabilidad (5/6), límites de recursos (8) y entrega verificable (10). Pedidos (1) conserva migración compatible probada localmente, pendiente validación real. POS/meseros (2) y repartidores (7) conservan módulos y requieren prueba multidispositivo. Reparto comercial (4) requiere acceso oficial. Administración (9) dispone de diagnóstico autenticado, controles operativos todavía bloqueados. Ningún objetivo recibe un porcentaje inventado.

## Despliegue y recuperación

Main y SQL producción no se modificaron. Revisar PR y CI; validar staging y roles reales antes de integrar. POSNET requiere modelo/protocolo/hardware. Pagos y proveedores requieren sandbox autorizado. No aplicar automáticamente SQL. Para esta corrección JavaScript, revertir el commit restaura el comportamiento anterior sin migración ni cambio de datos; conservar logs de conciliación al validar datos reales.
