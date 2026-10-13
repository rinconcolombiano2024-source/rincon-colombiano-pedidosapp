# RC ORDERA — sincronización del menú en Cliente (13-10-2026)

## Inspección
- `cliente.js` escucha `restaurant_public_catalogs` y `restaurant_profiles` por Supabase Realtime con filtro del restaurante.
- Los eventos se agrupan en una única recarga cada 1200 ms; al cambiar de restaurante se descartan solicitudes programadas obsoletas.
- `customerRenderMenu` representa nombre, descripción, precio y disponibilidad desde el catálogo normalizado.
- `customerMenuTextDisplay`, `customerQueueMenuTextTranslation` y `translate-public-content` permiten mostrar traducciones ES/PL/EN, con caché local. La traducción puede llegar después de la actualización del catálogo.
- La disponibilidad de eventos depende de publicación Realtime, permisos y conectividad. Esta inspección de código no certifica la entrega de eventos en un dispositivo real.

## Problema corregido
Antes, `customerLoadMenu` restablecía siempre `customerActiveCategory` a la primera categoría. Un nuevo evento Realtime interrumpía la navegación del usuario aunque la categoría todavía existiera.

Ahora se conserva la selección si sigue presente; si desaparece, se selecciona la primera disponible. Se actualiza tanto `cliente.js` como su copia publicada `www/cliente.js`.

## Evidencia y verificaciones pendientes
- Prueba agregada: `tests/customer-menu-category-realtime.test.cjs` para persistencia y desaparición de categoría, junto con la verificación de ambos archivos.
- Verificar con CI `npm run qa`, `npm run qa:i18n` y el test específico de Node.
- Probar con dos sesiones reales: desde Restaurante editar nombre, descripción, precio y disponibilidad; desde Cliente en cada idioma comprobar que se actualizan sin refrescar la página y que no se muestra traducción anterior para texto cambiado.
- Verificar funcionamiento en pestaña oculta, tras desconexión y reconexión, y en PWA con Service Worker actualizado.
- No se alteraron migraciones, políticas RLS, pagos, transacciones, ni producción.

**Estado:** corrección preparada en rama para revisión; no se declara probado el flujo Realtime extremo a extremo en producción.
