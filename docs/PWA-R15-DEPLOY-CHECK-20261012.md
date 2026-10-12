# RC ORDERA — control verificable de publicación, PWA Android (2026-10-12)

Después de aislar ventanas de Cliente/Estaciones y de reducir operaciones
en Supabase, era necesario forzar la actualización del **caché estático**
de las PWA instaladas. La versión anterior `pwa-safe-r14` podía persistir
para acceso sin internet aunque los módulos de GitHub ya estuvieran
actualizados.

## Solución
- Incrementar únicamente la versión de CacheStorage PWA a `pwa-safe-r15`
  (sin borrar `localStorage`, IndexedDB ni pedidos pendientes).
- Añadir `rc-ordera-release.json` tanto en raíz como en `www/`,
  que identifica la publicación `2026-10-12-r15`.
- Comprobación de despliegue verificable, de **solo lectura**:
  `SITE_URL=https://rincon-colombiano-pedidosapp.vercel.app node scripts/verify-production-release.mjs`.
  Fallar si Vercel no devuelve exactamente el marcador esperado.
- QA de coincidencia `www/`, versión PWA y ausencia de borrado de
  datos locales. Al reencontrar internet, el navegador puede comprobar
  la versión nueva; el comportamiento concreto de la PWA Android requiere
  validación física.
- El marcador NO revela información personal, secretos ni credenciales.
- La comprobación no crea pedidos ni realiza escrituras a Supabase.

## Operación en restaurante
1. Confirmar que el endpoint `/rc-ordera-release.json` devuelve R15.
2. Abrir PWA con internet; verificar QR→Cliente y Estaciones→Mesero en
   navegador separado manteniendo la sesión del restaurante.
3. Inspeccionar el botón fiscal dentro de la cabecera del POS.
4. Realizar un único pedido de prueba; comprobar recepción en cocina.
5. No limpiar datos de aplicación ni reinstalar sin confirmar si hay
   pedidos locales pendientes de sincronizar.

La reducción de CPU se debe medir en Supabase Metrics con carga real,
no inferirse de una versión del Service Worker. No se han alterado
ventas, fiscales, roles, RLS ni tablas en este parche.
