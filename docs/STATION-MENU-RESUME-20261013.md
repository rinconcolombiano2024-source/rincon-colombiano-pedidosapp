# Estaciones RC ORDERA — recuperación de menú sin polling
**Fecha: 2026-10-13**

Cuando Caja/Mesero recupera una ventana que estuvo oculta, Realtime puede haber perdido un evento. Se añade `station-menu-resume.js` como respaldo **exclusivamente al volver al primer plano** con el mismo usuario y restaurante autorizado. No agrega timers, intervalos, escrituras, tablas ni RPC nuevas: llama a la lectura existente `waiterLoadMenu()` como máximo una vez por 20 segundos, únicamente si el proceso de autorización no está actualizando ya y no existe otra lectura de menú en curso. No modifica el carrito ni el borrador de pedido.

El operador sigue pudiendo usar el botón existente `Actualizar` para recuperar productos de inmediato. El menú público de Rincón Colombiano en Supabase contiene 42 productos (revisión 40), pero solo 16 tienen descripción principal; los otros 26 requieren recuperación desde el dispositivo original con `Publicar y verificar menú`. No escribir descripciones inventadas ni borrar la caché del dispositivo con ediciones pendientes.

Regresión: `node --test tests/station-menu-resume.test.cjs`; la suite completa de `npm run qa` y E2E de estaciones deben estar verdes. Rutas `www` y fuente idénticas.
