# RC ORDERA — Control de salida de pagos (2026-10-16)

Este documento es un **bloqueo de lanzamiento**, no una autorización para cobrar.
Se creó en una rama aislada sin cambiar el código de pagos, datos, RLS ni producción.

## Condiciones obligatorias para activar Stripe / SumUp / BLIK

- [ ] Menú, precios, disponibilidad, horarios y fotografías: guardar, recargar y comprobar desde cliente con el mismo restaurante.
- [ ] Confirmar que los importes se calculan y validan en servidor; nunca confiar en importes enviados por navegador.
- [ ] Identificar la cuenta mercantil real por restaurante, región y moneda; verificar que el modo de producción está configurado conscientemente.
- [ ] Verificar secretos y firmas de webhooks en servidor, con rechazo de firmas inválidas.
- [ ] Comprobar idempotencia en creación, confirmación y recepción repetida de eventos.
- [ ] Simular pago aprobado, rechazado, expirado, duplicado, cancelado y reembolso en sandbox.
- [ ] Confirmar que una operación pagada coincide con pedido, moneda, total y cuenta mercantil; conciliar con el proveedor.
- [ ] Verificar recuperación tras desconexión sin pedidos ni cobros duplicados.
- [ ] Verificar aislamiento entre restaurantes y autorización de cambios de estado.
- [ ] Confirmar compatibilidad BLIK en la cuenta Stripe/SumUp concreta, si aplica, antes de mostrarlo.
- [ ] Ejecutar `npm run qa`, `npm run qa:e2e` y pruebas operativas de pagos y menú, con CI aprobado.
- [ ] Disponer de plan de reversión, observabilidad y responsable de incidencias.
- [ ] Autorizar explícitamente el cambio de credenciales/configuración del entorno de producción una vez obtenida evidencia.

## Evidencia pendiente

No se han ejecutado pruebas de pago extremo a extremo ni verificado credenciales comerciales en esta rama. No hay medición de CPU ni certificación de disponibilidad. **No habilitar cobros reales por la sola existencia de este documento.**

## Correcciones existentes a revisar, sin duplicar

- PR #85: protecciones SumUp para no activar sandbox accidentalmente.
- PR #83: persistencia de configuraciones del restaurante.
- PR #76: líneas independientes de carrito con observaciones distintas.
- PR #75 y #73: preservación de observaciones en reparto.

Mantener todos los cambios de producción detrás de validaciones y revisiones; no fusionar por presión de fecha.
