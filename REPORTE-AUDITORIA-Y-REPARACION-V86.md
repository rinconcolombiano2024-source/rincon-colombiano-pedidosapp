# RC ORDERA V86.1 - Auditoria y reparacion

## Alcance

Se trabajo sobre una copia del ZIP recibido. El ZIP original no fue modificado. Se revisaron las cinco superficies activas (restaurante, cliente, mesero/estaciones, colaborador y administracion), PWA, sincronizacion, migraciones V85/V86 y Edge Functions.

## Problemas importantes encontrados

1. El cliente podia enviar precios, domicilio y total calculados en el navegador.
2. La aceptacion de pedidos y la asignacion de ticket no estaban unidas en una unica operacion atomica.
3. El catalogo publico dependia de una estructura que tambien contiene ajustes privados.
4. Las liquidaciones de Stripe necesitaban idempotencia durable, control de disputas y reintentos separados.
5. La eliminacion del restaurante podia dejar datos publicos o roles activos si un paso fallaba.
6. La autorizacion de estaciones arrastraba contratos RPC antiguos y el error de columnas ambiguas.
7. Los documentos del colaborador necesitaban un bucket privado y restricciones consistentes.
8. Los cierres dependian de la fecha del dispositivo y solo cargaban hasta 5.000 pedidos.
9. La traduccion remota podia generar cientos de avisos durante una caida y algunos textos locales quedaban mezclados.
10. La PWA podia mezclar HTML nuevo con JavaScript almacenado de una version anterior.
11. Google Maps se cargaba sin el modo asincrono recomendado.
12. Las notificaciones del colaborador aun abrian una ruta marcada como V84.1.

## Reparaciones realizadas

- Tickets unicos por restaurante/fecha y aceptacion atomica de pedidos.
- Fecha operativa del restaurante usada por caja, mesero, historial y cierres.
- Cotizacion de domicilio con Google en Edge Function, token temporal y validacion de pais/ruta.
- Creacion del pedido en servidor con nombre/precio historico, cantidad, notas, subtotal, domicilio y total confirmados.
- Catalogo publico separado, filtrado por restaurante y preparado para Realtime.
- Comisiones configuradas en 5% restaurante y 0,1% colaborador.
- Webhook Stripe con firma, proteccion contra duplicados, conciliacion de importe/moneda, reembolsos y disputas.
- Cola de liquidaciones con reintentos e idempotencia independiente para restaurante y colaborador.
- Cierre/eliminacion logica del restaurante en una transaccion; conserva Auth si el correo tambien es cliente o colaborador.
- Documentos del colaborador privados, maximo 8 MB y formatos PDF/JPEG/PNG/WebP.
- Autorizacion consolidada de personal y estaciones, con propietario autenticado y acceso `authenticated` solamente.
- Cierres diario, mensual y anual cargan todo el periodo desde Supabase en paginas de 1.000 pedidos.
- Traduccion prioritaria del diccionario local, pausa automatica ante caida remota e idiomas completos en la navegacion visible.
- Portada del cliente, busqueda y 55 categorias de descubrimiento traducidas localmente en espanol, polaco e ingles, incluso si el servicio remoto no responde.
- Versionado V86.1 de scripts/estilos, cache PWA renovada y `www` sincronizado para Capacitor.
- Google Maps con carga asincrona y notificaciones del colaborador actualizadas a V86.1.
- Impresion termica conserva ancho configurable, PDF de altura dinamica y comando ESC/POS de corte cuando la impresora/Web Serial lo admite.

## Validacion realizada

- 163 comprobaciones automaticas: sintaxis JavaScript, IDs, selectores, manifests, PWA, migraciones no destructivas, pagos, pedidos, traducciones, impresion y paridad entre web/Android.
- Prueba visual a 390 x 844 de las cinco pantallas: sin desbordamiento horizontal ni dialogos abiertos por error.
- Cambio real de idioma a polaco e ingles en colaborador y cliente.
- Consola: cero errores durante la navegacion publica. Los avisos restantes corresponden a servicios externos no disponibles en el entorno local y a sesiones no iniciadas.
- Revision estatica del contrato frontend/RPC para pedidos, estaciones, cierres, eliminacion, pagos y documentos.

## Validacion que todavia requiere el proyecto real

No es honesto declarar produccion al 100% solo con pruebas locales. Deben probarse en el Supabase/Stripe/Google reales:

- Ejecucion de las ocho migraciones y `VALIDACION-V86.sql`.
- RLS con usuarios reales de dos clientes, dos restaurantes, dos colaboradores y administrador.
- Webhook Stripe en modo prueba, onboarding Connect, pago, doble confirmacion, transferencia, reembolso y disputa.
- Google Routes/Geocoding con direcciones reales de Polonia y Colombia.
- Realtime en dos o mas dispositivos simultaneos.
- Push con dispositivo bloqueado y tarea de despacho activa.
- Corte automatico en cada modelo de impresora compatible; los navegadores normales no pueden obligar a cortar si el controlador no expone ESC/POS.

## Resultado

El paquete queda considerablemente mas seguro y verificable, pero su aprobacion comercial final depende de completar las pruebas reales anteriores y de la revision legal/contractual de pagos, privacidad y operacion en cada pais.
