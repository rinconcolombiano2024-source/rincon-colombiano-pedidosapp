# RC ORDERA — Auditoría incremental de integraciones y publicación (14-10-2026)

## Alcance y precauciones

Rama aislada `audit/integration-gates-fiscal-delivery-payments-20261014`; creada desde
`8db4045124314c64c31d9f1c83c3573bc9b9aa05`. No modifica `main`, datos,
migraciones SQL, credenciales, pantallas del POS, ventas, checkout ni agentes físicos.
Esta revisión cubre rutas críticas inspeccionadas, no equivale a una auditoría
manual exhaustiva de todos los archivos de la aplicación ni a certificación operativa.

## Hallazgos verificables

| Área | Evidencia de código | Estado real | Para cerrar |
|---|---|---|---|
| Portada | `index.html` de base muestra Cliente/Restaurante/Colaborador; `restaurante.html` contiene acceso a Personal y estaciones; R23 incluye verificador manual de release | La ventana instalada todavía puede mostrar contenido anterior; el estado GitHub del último deploy Vercel es **failure: build-rate-limit** | Resolver despliegue y comprobar URL /, index.html y release marker sin borrar datos locales |
| Menú | Guardado publicado mediante flujos de nube; advertencia de menú no publicado; pruebas existentes | Persistencia real entre dos dispositivos/sesiones no comprobada aquí | Ensayar alta/edición/borrado, fallos de red, carreras y valor en pedido |
| Horario | `sync_current_restaurant_operational_status`, modo automático, validación de horario en servidor | No verificado con base y zona Europe/Warsaw real | Probar apertura/cierre, cambio de hora DST, cierre sin sesión y bloqueo al crear pedidos |
| Stripe | Motor de checkout, webhook y pruebas aisladas | No hay confirmación aquí de capture/refunds/payouts reales con cuenta operativa | Staging y credenciales test; webhooks firmados, replay, refund, comisiones, liquidación |
| SumUp | Ruta compartida de checkout limitada por feature flag; PR de pagos anterior en revisión | No autorizado certificar cobro y liquidación real | Revisar PR, credenciales merchant, checkout y webhook oficiales e idempotencia sin fallback al otro procesador |
| Fiscal | Registros universales, agente, claims, journal y drivers; POSNET/ELZAB lanzan DRIVER_NOT_IMPLEMENTED; Novitus es simulación | **No existe impresión fiscal POSNET verificada** | Modelo, firmware, protocolo oficial, mapeo PTU/VAT por dispositivo, puerto, laboratorio físico, recuperación UNKNOWN y conciliación persistente |
| Reparto externo | `delivery-bridge` con adaptadores Glovo, Wolt, Uber Eats, Pyszne y Bolt; `meta.provisional: true`; outbox impide transmisión provisional en producción | No hay conectores oficiales certificados; Pyszne exige contrato y mapping | Autorizaciones y documentación oficial por proveedor, sandbox real, firma, catálogo, entrada y ACK bidireccional, eventos duplicados, cancelación/conciliación |
| Colaborador / GPS / pagos | Módulos existentes | No validados en un recorrido real E2E en esta revisión | Roles, asignación y ubicación consentida, entrega con evidencia, saldo, comisiones y transferencias |
| Reseñas | Solicitud de negocio | No verificado E2E aquí | Autorización por pedido entregado, una opinión por pedido, privacidad y moderación |

## Corrección de esta rama

1. `delivery-bridge/src/canonical.mjs` limita la creación de solicitudes salientes
   a HTTPS, mismo origen, sin credenciales embebidas, sin query/hash y **origen
   expresamente aprobado**. Rechaza destinos no aprobados antes de enviar tokens.
2. Los adaptadores provisionales Wolt, Glovo y Uber Eats señalan expresamente
   los orígenes oficiales de código que se podrán utilizar una vez revisado el
   contrato real. Cambiar de host en el futuro exige modificar y revisar el código;
   no puede hacerlo un payload entrante.
3. El `resource_href` de Uber Eats deja de aceptar cualquier dirección HTTPS.
   Sólo acepta la ruta revisada de `api.uber.com` y comprueba que el ID coincida
   con el pedido firmado. Sigue sin hacer peticiones a la API: esto es prevención,
   no una conexión oficial.
4. Tests de regresión cubren URL hostil, SSRF, URL con token, orden equivocada,
   estado provisional de todos los proveedores y bloqueo de drivers fiscales;
   las pruebas de autorización impiden confundir «configurado» con «autorizado».

No se añadieron timers, sondeos, reintentos, consultas SQL ni tareas en segundo plano.
Los adaptadores continúan **bloqueados para producción**. Un cambio seguro de
la URL no sustituye un contrato, una firma oficial ni las pruebas de hardware.

## Orden de liberación para 99,9 % como objetivo medible

**P0 Publicación**: resolver `Vercel build-rate-limit`, obtener deploy success,
verificar byte a byte portada publicada y `R23`; confirmar funcionamiento de
la aplicación instalada y de la versión web, con rollback de assets y sin borrado de
pedidos locales.

**P0 Cobro y pedidos**: fixtures desechables en Supabase staging aislado; guardar
menú y horarios, hacer checkout y validar webhooks únicos, recepción en restaurante,
cocina, pago confirmado desde proveedor (no redirección), devolución y cierre;
doble clic, caída de red, sesión vencida, cambios de menú y recibos duplicados.

**P1 Impresión**: verificar marca/modelo, protocolo oficial y autorización fiscal,
ejecutar operaciones en dispositivo físico; ante UNKNOWN jamás repetir a ciegas.
No activar fiscalización con driver mock ni con permiso USB solo.

**P1 Reparto**: proveedor por proveedor, homologación oficial, entornos sandbox,
mapeo de restaurante/producto, firma, webhook e idempotencia, cola transaccional,
ACK/estado sin pérdidas, verificación de no duplicados y conciliación.

**P1 Colaborador, GPS y reseñas**: permisos y consentimiento de localización,
asignación segura, entrega, pagos/ganancias verificadas y opinión vinculada a pedido.

**P2 SLO / rendimiento**: medir p95/p99 de checkout y guardado, tasa de errores,
latencia webhook y CPU/memoria con observabilidad y alertas. Sólo afirmar
99,9 % de disponibilidad con telemetría longitudinal y recuperación probada.

## Condiciones de aceptación antes de fusionar

- `npm run qa` y E2E GitHub Actions en verde.
- Sin cambios a `main`, base de datos, producción, drivers físicos ni credenciales.
- Para marcar alguna conexión «activa» se necesitan registros oficiales, credenciales
  de servidor, contrato y al menos una prueba de extremo a extremo con proveedor/
  dispositivo real. Estas pruebas **no** se han efectuado en esta rama.
