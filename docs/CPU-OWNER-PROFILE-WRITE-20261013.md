# Optimización sin escrituras repetidas: user_profiles (2026-10-13)

Causa auditada: `ensureRestaurantOwnerIdentity` escribía siempre
`user_profiles` con `upsert()` y `updated_at: now()` después de cargar
Supabase, incluso cuando nombre, domicilio, teléfono, país, zona horaria
y demás datos de registro eran idénticos. Las estadísticas acumuladas
mostraban 816 UPDATE sobre aproximadamente 10 usuarios.

Solución: recordar **solo en la memoria de esta pestaña** el último
payload de perfil confirmado en Supabase, excluyendo `updated_at` del
fingerprint. Un perfil distinto, cambio de cuenta, cambio de cliente
Supabase o fallo de escritura dispara el upsert normal. La reparación de
rol de propietario sigue independiente: nunca se salta por esta caché.

Seguridad: no se persisten datos adicionales en localStorage, no se
modifican tablas, reglas de permisos, claves ni pedidos. La caché
de una pestaña no es una garantía de sincronización externa en otros
dispositivos; las páginas recargadas volverán a verificar mediante el
upsert original. No indica una reducción absoluta de CPU ni su 93%
anterior, pues se requieren métricas reales del dashboard.

Pruebas VM sobre el bloque de código real: 3 cargas iguales → 1
escritura, cambios de perfil, fallo/reintento, usuario nuevo,
cliente nuevo y respuesta de una sesión cerrada. `app.js` y espejo
`www/app.js` permanecen idénticos; ledger SHA256 reversible.
