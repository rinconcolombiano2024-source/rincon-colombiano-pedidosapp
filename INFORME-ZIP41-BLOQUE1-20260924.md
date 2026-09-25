# ZIP 41: primer bloque de correcciones verificadas

Base exclusiva: rincon-colombiano-pedidosapp-main (41).zip.
SHA256: D9D2D712B97B5BA95DC26310EBF13C4E2069A21152E822FC3ABDB609D42F0047.
No es cierre de los 22 hallazgos ni certificacion de produccion.

## Cambios exactos

- MIGRACION-V91-19-ESTACIONES-Y-LIMITE-SERIALIZADO.sql, lineas 10-18: extiende el reinicio de tareas modificadas a preparing. Mantiene el WHERE de V91-15 para no escribir cuando los items no cambian. No reinicia pedidos despachados.
- Misma migracion, lineas 20-36: bloqueo FOR UPDATE del pedido tras validar token, antes de contar/insertar mensajes. Bajo READ COMMITTED, cada llamada cuenta con un snapshot posterior al bloqueo. Otros aislamientos se rechazan con 40001, evitando usar snapshots antiguos. Consulta limitada a 30 coincidencias, conserva el limite de 30 mensajes/minuto y las validaciones de imagen/cuerpo/token. Conserva ACL. No ejecuta backfill ni cambia datos existentes.
- qa-v91.cjs, lineas 70 y 151: reconoce los contratos actuales de errores temporales y guardado con AbortSignal. Pruebas ejecutables adicionales verifican esos contratos; no se desactivaron protecciones ni se altero frontend.
- qa-v91.cjs, linea 231: etiqueta de QA obtenida de package.json, sin cambiar version.
- tests/zip41-sync-contract.test.cjs: clasificador de errores y pedido pendiente ante fallo; confirmacion tras exito y propagacion del signal.
- tests/zip41-supabase.test.cjs: reproduce preparing obsoleto antes del parche; prueba reinicio, cero escrituras sin cambios, cancelacion de packing vacio, pedido despachado, token invalido, mensaje 31, expiracion de ventana, idempotencia y conservacion de ACL.
- tests/zip41-station-chat-contracts.test.cjs: ejecuta V91-14/V91-16 del ZIP; dispatch con variable_conflict=error, autorizacion y estados; chat con ediciones, borrados, imagenes, token invalido y respuestas sin cambios.
- tests/zip41-pos-isolation.test.cjs: ejecuta V91-18; deniega actor anonimo/no restaurante/inactivo y colision de UUID entre restaurantes. Guardado atomico y sincronizador de estaciones sustituidos por fixtures locales: no certifica esos modulos ni RLS productiva.
- tests/e2e/interactions.spec.js, linea 13: prueba restaurante.html, no el portal index.html.
- tests/e2e/smoke.spec.js, lineas 5-6: comprueba tanto portal como restaurante, sin quitar cobertura.
- tests/e2e/support/supabase-mock.cjs, lineas 78-82: simulacion de la libreria local que realmente carga la app; conserva simulacion CDN y bloqueo de red Supabase.

## Pruebas

- npm run qa: 70 pruebas aprobadas, cero fallos/omisiones; i18n 2066 comprobaciones aprobadas.
- npm run qa:e2e: 13 pruebas aprobadas en navegador con Supabase simulado, no produccion.
- Sintaxis de archivos JS modificados/nuevos: aprobada.
- Pares raiz/www: app.js, cliente.js, mesero.js, colaborador.js, auto-translate.js, offline-i18n.js identicos.
- npm run qa:integration: 7 omitidas y 2 TODO. NO se cuentan como aprobadas. El usuario confirma que no tiene proyecto Supabase TEST.
- SQL ejecutado en PostgreSQL local PGlite. Sus llamadas son serializadas: falta prueba de carrera con conexiones PostgreSQL independientes y medicion de CPU real.

## Estado de la lista solicitada

1. Packing sin items: NO reproducido en V91-15 de este ZIP. Ya cancela todas las tareas si el pedido editable queda vacio. Prueba agregada; no se cambio ese comportamiento.
2. Carrera del limite: correccion local en V91-19; pendiente validacion multiconexion real.
3. Escaneo del chat: pendiente. La version md5 de V91-16 sigue leyendo metadatos completos. Se solicito permiso para una marca privada persistente por pedido; no se implemento ni autorizo todavia.
4. Realtime/bandeja completa: pendiente; no se eliminaron suscripciones ni consultas necesarias.
5. Preparing modificado: corregido localmente y probado.
6. QA oficial: verde. E2E actualizado al SDK local y a las rutas existentes; verde.
7. Tests V91-14 a V91-18: incorporados para los contratos descritos, no cobertura exhaustiva de produccion.
8. CI integracion real: pendiente de proyecto TEST/configuracion segura. Workflow no alterado.
9. Dos TODO multi-tenant: permanecen pendientes. Las pruebas SQL locales no sustituyen RLS remota.
10. Configuracion de Edge Functions: pendiente de verificar autenticacion de cada endpoint; no se cambio verify_jwt a ciegas.
11. Token en localStorage: pendiente de resolver conservacion del seguimiento/offline; no se borro ni cambio persistencia.
12. Imagenes base64: pendiente; migrarlas requiere estrategia compatible de almacenamiento/retencion. No se borraron imagenes.
13. Count por mensaje: conteo acotado a 30 coincidencias, no elimina toda consulta ni garantiza 30 filas fisicas examinadas; falta EXPLAIN con datos reales.
14. Numeracion duplicada: conservada para no alterar historial aplicado; pendiente inventario remoto.
15. Esquema final seguro: no certificado; no se sustituyo supabase-schema.sql por una reconstruccion no comprobada.
16. CSP: pendiente; retirar directivas sin inventario y pruebas puede bloquear codigo vigente.
17. Publicaciones Realtime: pendientes de demostrar consumidores; ninguna eliminada.
18. Tracking invitado: sin cambio; no se concedio acceso anonimo directo a tablas privadas.
19. Referencias historicas de version: no se reemplazaron masivamente. No todas son errores funcionales.
20. Etiqueta QA: corregida para usar version del paquete.
21. cache.addAll atomico: conservado. La atomicidad evita activar un cache incompleto; no se considera por si sola un fallo que deba suprimirse.
22. Catch vacios: no se sustituyeron globalmente; requieren revisar cada ruta para no introducir reintentos/errores visibles nuevos.

## Despliegue y limites

Ningun SQL se ejecuto en Supabase ni se desplego el frontend. V91-19 es una migracion nueva pendiente de revisar y probar en TEST despues de V91-15/V91-17. No ejecutar las migraciones historicas otra vez indiscriminadamente.
La migracion aborta de forma transaccional si no reconoce la definicion instalada. Si falla, no eliminar esa comprobacion ni forzar el cambio.
No se modificaron app.js, cliente.js, mesero.js, UI, pagos, tokens, RLS, Edge Functions, service worker ni migraciones historicas.
No se puede afirmar CPU resuelta, cero regresiones absolutas ni produccion lista con las pruebas remotas pendientes.
