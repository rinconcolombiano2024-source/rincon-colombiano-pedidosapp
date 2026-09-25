# Cierre solicitado: CPU, sobre ZIP41/BLOQUE1

Este informe actualiza exclusivamente los tres puntos CPU del informe anterior. No afirma que la aplicacion completa este lista para produccion.

## Archivos de este bloque

- MIGRACION-V91-20-CHAT-MARCA-PRIVADA.sql: columna chat_revision en la tabla privada existente customer_order_access_secrets; trigger de invalidacion por cambio real de mensaje. No modifica valores de tokens ni amplia permisos. La firma condicional del chat consulta por clave primaria antes de leer mensajes. Si no cambio, devuelve messages=null. Cambios, borrados e imagenes mantienen el contrato anterior. Pedidos legados/internos sin fila privada conservan la lectura V91-16 para no bloquear su chat: en esos casos sigue existiendo el escaneo anterior.
- MIGRACION-V91-21-ESTACIONES-LECTURA-POR-ID.sql: firma adicional list_my_station_orders(uuid,text,uuid[]) derivada de la funcion instalada; conserva filtros, membresias, columnas y limite. La firma original sigue intacta. Solo authenticated puede ejecutar la nueva firma.
- mesero.js y www/mesero.js: acumulan IDs de eventos, consultan esos pedidos y fusionan tarjetas. Mantienen inFlight, backoff y un solo temporizador existente. Conservan descarga completa en carga inicial, refresco manual, reconexion, cache llena, contexto desconocido y reconciliacion temporal de 15 segundos cuando hay actividad. No se agrega un timer periodico. El 503 conserva cache sin lanzar descarga alternativa; solo PGRST202 usa compatibilidad con la firma anterior. Las respuestas de otro contexto se descartan y los eventos recibidos durante una consulta se conservan.
- MIGRACION-V91-22-MENU-VALIDACION-UNA-PASADA.sql: sustituye exclusivamente la busqueda repetida en el JSON del menu por un mapa local de los productos solicitados. Mantiene validacion server-side, cantidades, disponibilidad, precios, snapshots, tokens, idempotencia y la logica posterior de cotizacion/guardado. No cambia el menu almacenado ni el frontend del cliente.
- tests/cpu-chat-revision.test.cjs: lectura condicional, imagenes, edicion, borrado, rollback, truncado, permisos privados y compatibilidad sin boveda.
- tests/cpu-station-delta.test.cjs: consulta por ID, conservacion de otras tarjetas, retirada de tarea, 503, fallback, eventos concurrentes, respuesta tardia, reconciliacion completa y autorizacion SQL.
- tests/cpu-menu-lookup.test.cjs: compara resultados/errores originales con parche; prueba instrumentada de 60 productos solicitados reduce recorridos del menu de 60 a 1. No equivale a medir CPU productiva.

## Pruebas y limitaciones

- npm run qa: 76 pruebas aprobadas, 0 fallos; 2066 comprobaciones i18n aprobadas.
- npm run qa:e2e: 13 pruebas aprobadas, con Supabase simulado.
- Sintaxis de mesero.js, www/mesero.js y los tres tests nuevos comprobada.
- mesero.js y www/mesero.js identicos.
- Pruebas SQL locales en PGlite; no se midio CPU real ni concurrencia multiconexion en Supabase. No existe proyecto TEST disponible segun confirmacion del usuario.
- Ninguna migracion se ha aplicado a Supabase. Subir el ZIP al frontend NO aplica SQL.

## Pendiente importante

No se implemento el bloqueo de creacion anonima masiva con IDs nuevos: el contrato actual no ofrece una identidad invitada verificable para limitar por sesion. Se solicito autorizacion para ese cambio; no se aplico un limite global por restaurante/IP que pudiera bloquear clientes legitimos. La validacion de menu si fue optimizada. No declarar resuelta toda la prioridad 1.

## Aplicacion segura

Las migraciones V91-20, V91-21 y V91-22 son nuevas y deben revisarse/probarse primero sobre un proyecto TEST con el contrato correspondiente del ZIP41. Son transaccionales y las que transforman funciones abortan si no reconocen el contrato. No quitar esas comprobaciones ni volver a ejecutar indiscriminadamente migraciones historicas. V91-19 y las correcciones del bloque anterior se conservan.

No se modificaron app.js, cliente.js, UI, idiomas, cobros, Edge Functions, service worker ni migraciones historicas en este bloque. No se eliminaron archivos originales. No se puede garantizar ausencia absoluta de regresiones fuera de lo probado ni CPU productiva resuelta.
