# RC ORDERA — comparación no destructiva de menú
2026-10-13

Nueva opción **Comparar Cliente y Caja** en la sección Restaurante → Editar información → Menú público. El botón se crea en el panel de publicación por el bundle ya existente `restaurant-fiscal-ui.js` y por eso no necesita modificar la estructura ni las rutas protegidas.

Con una acción explícita del propietario, la app toma un snapshot del menú de este dispositivo y **lee una sola vez** su fila en `restaurant_public_catalogs` con el cliente autenticado y el filtro de `restaurant_user_id`; usa las políticas existentes sin saltarse RLS. Cuenta productos, descripciones ES, revisión y diferencias de nombre, precio, disponibilidad, estación y descripciones guardadas ES/PL/EN; expone los primeros cinco nombres discrepantes al propietario, nunca a público.

La comparación no publica, no modifica pedidos, no modifica caché ni `menu_revision`, no elimina textos y no introduce polling o suscripciones. Si existen diferencias, usar desde el dispositivo original el botón **Publicar y verificar menú** (flujo existente con salvaguardas de revisiones). Si no hay sesión/internet no consulta la BD. Siempre evitar vaciar caché local.

Este diagnóstico no reconstruye las 26 descripciones españolas ausentes de la publicación actual ni demuestra que se haya desplegado la app. La última web en Vercel sigue bloqueada por cuota: activar solo después de desplegar una versión verificada.
