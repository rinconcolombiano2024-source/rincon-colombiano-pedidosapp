# RC ORDERA — Auditoría y estabilización del 4 de septiembre de 2026

## 1. Estado general

La entrega V91.0.3 tenía una base funcional amplia y las comprobaciones estáticas existentes pasaban, pero conservaba fallos de contrato que afectaban funciones críticas. En particular, el frontend multiestación llamaba RPC que no estaban incluidas en el SQL entregado, el producto especial del mesero no podía superar la validación del servidor y las estaciones mantenían sondeo incluso con Realtime activo.

La versión resultante corrige esos puntos mediante cambios localizados, conserva la arquitectura existente y mantiene sincronizadas las copias web y Android. No se declara validación de producción: la ejecución real de RLS, concurrencia, Stripe y varios dispositivos requiere un proyecto Supabase TEST con credenciales y fixtures desechables.

## 2. Hallazgos por severidad

### P0 — Riesgo financiero

- Stripe Checkout podía crear otra sesión pagable si Stripe respondía correctamente pero fallaba persistir la URL de la primera sesión. Un reintento contaba el registro incompleto como un intento anterior y generaba una clave idempotente nueva.

### P1 — Pedidos, estaciones y sincronización

- `mesero.js` llamaba `get_my_restaurant_stations`, pero esa RPC no existía en los SQL entregados.
- `mesero.js` enviaba `p_station` a `list_my_station_orders` y `update_my_station_order`, pero solo existían las firmas antiguas sin dicho parámetro. Esto podía producir `PGRST202`.
- La función de pedido del mesero rechazaba todos los productos especiales porque intentaba localizarlos en el menú normal.
- `PGRST002`, `PGRST003` y HTTP 503 no se reconocían como fallos temporales al enviar un pedido de mesero. El usuario recibía un error genérico y la cola podía intentar todos los pendientes durante una caída.
- `customer_orders` debía estar en `supabase_realtime` para que caja y estaciones recibieran pedidos sin actualización manual; la nueva migración lo garantiza de forma idempotente.

### P2 — Rendimiento

- Las estaciones consultaban cada 15 segundos aunque Realtime estuviera conectado. Ahora el sondeo es solo respaldo y usa espera progresiva de 15 a 120 segundos.

## 3. Causas raíz

- Evolución incompleta del contrato frontend ↔ PostgreSQL para cuentas con varias estaciones.
- Diferencia entre el producto especial permitido por la interfaz y la validación de productos normales en SQL.
- Clasificación incompleta de errores temporales de Supabase.
- Reintento de pago basado en el número de filas existentes, sin reutilizar una transacción pendiente cuya URL no llegó a persistirse.
- Sondeo de estaciones independiente del estado real del canal Realtime.

## 4. Correcciones realizadas

- `mesero.js` y `www/mesero.js`:
  - confirmación del pedido solamente si el servidor devuelve un ID;
  - conservación de pedidos ante 503, PGRST002, PGRST003, timeout o red;
  - corte de la ronda después de un fallo temporal, sin perder los restantes;
  - mensaje correcto y recarga de menú cuando el producto ya no existe;
  - polling de estaciones únicamente como respaldo de Realtime y con backoff.
- `MIGRACION-V91-03-CONTRATO-MULTIESTACION-Y-REALTIME.sql`:
  - agrega `get_my_restaurant_stations(uuid)`;
  - agrega firmas explícitas con estación seleccionada;
  - valida membresía exacta, restaurante activo, pedido y transición;
  - permite productos especiales solo a personal con `create_orders`, validando nombre, precio y estación;
  - mantiene precio y estación de productos normales como datos confiables del menú;
  - garantiza `customer_orders` en Realtime sin duplicarlo.
- `supabase/functions/marketplace-checkout/index.ts`:
  - reutiliza la transacción y clave idempotente cuando existe un intento pendiente sin URL;
  - evita abrir una segunda sesión pagable por un fallo parcial de persistencia.
- `qa-v91.cjs` y `tests/e2e/responsive.spec.js`:
  - regresiones para los contratos corregidos, cola temporal, idempotencia y sondeo;
  - control de desbordamiento en móvil, tableta y escritorio.

## 5. Pagos

La arquitectura existente usa Stripe Connect mediante Edge Functions. La clave secreta y el secreto del webhook se leen del entorno servidor; no aparecen en el frontend. El webhook verifica firma, deduplica eventos, comprueba importe y moneda y llama RPC reservadas a `service_role`. El frontend no es la fuente definitiva del estado pagado.

No fue posible confirmar si el entorno desplegado utiliza claves Stripe TEST o LIVE, ni ejecutar un cobro real, porque esa información depende de secretos y cuentas externas. La corrección del checkout debe desplegarse antes de una prueba financiera en TEST.

## 6. Estaciones

El contrato entregado cubre mesero, caja, encargado, cocina, parrilla, bebidas, comidas rápidas, entradas, ensaladas, empaque y despacho. La migración nueva autoriza la estación seleccionada de forma exacta, evitando que una cuenta con varias membresías opere accidentalmente con otra estación.

Las transiciones continúan siendo controladas por el servidor. La prueba de navegador confirmó que la pantalla de estación carga y escapa contenido no confiable. El recorrido real simultáneo entre todas las estaciones queda sujeto al entorno Supabase TEST.

## 7. Pedidos y carrito

Se conserva el ID del pedido durante reintentos y la inserción del mesero sigue siendo idempotente por clave primaria. Los fallos temporales mantienen el pedido en la cola. El carrito del cliente conserva las validaciones existentes de restaurante, menú, cantidad, total y creación segura mediante RPC. Las pruebas automáticas confirmaron agregar un producto, persistir la selección correcta de restaurante y evitar HTML ejecutable.

## 8. Seguridad

- No se detectaron secretos privados en los archivos públicos.
- Las nuevas RPC usan `security definer` con `search_path` fijo.
- Cada operación multiestación verifica `auth.uid()`, restaurante, membresía activa y estación exacta.
- Los productos normales no aceptan precio ni estación enviados por el navegador.
- Las RPC nuevas se revocan de `public` y `anon` y se conceden a `authenticated`.

Las pruebas de aislamiento RLS incluidas no se ejecutaron contra una base real porque faltan variables `RC_TEST_*`; el comando las reporta como omitidas, no como aprobadas.

## 9. Realtime y rendimiento

La aplicación central conserva single-flight, backoff y sondeo de respaldo. Las estaciones ahora detienen consultas cuando el canal está suscrito. La migración garantiza la publicación de `customer_orders`. No se agregaron nuevos intervalos permanentes.

## 10. UX/UI y responsive

No se rediseñó la interfaz. Se conservaron identidad y flujos. Las cinco entradas principales fueron verificadas sin desbordamiento horizontal a 390×844, 1024×768 y 1440×900.

## 11. Pruebas ejecutadas

- Sintaxis de los ocho JavaScript principales: aprobada.
- `npm run qa`: aprobado.
- i18n: 2028 comprobaciones aprobadas.
- `npm run qa:e2e`: 15/15 aprobadas.
- `npm run android:prepare-web`: 33 archivos preparados; raíz y `www` coinciden.
- `npm run qa:integration`: 0 fallos, pero 7 pruebas omitidas y 2 TODO por falta de Supabase TEST.

## 12. Pendientes externos reales

1. Ejecutar `MIGRACION-V91-03-CONTRATO-MULTIESTACION-Y-REALTIME.sql` en Supabase y comprobar que finaliza sin error.
2. Desplegar `marketplace-checkout` y el frontend actualizado.
3. Ejecutar las pruebas RLS/concurrencia con un proyecto Supabase TEST y fixtures desechables.
4. Probar Stripe en modo TEST con webhook desplegado; confirmar explícitamente TEST/LIVE antes de producción.
5. Hacer una prueba operativa con dispositivos reales: mesero → caja → dos estaciones → empaque → despacho/entrega.

Hasta completar esos pasos externos no es técnicamente correcto declarar toda la plataforma validada de extremo a extremo en producción.
