# Profile upsert single-flight — RC ORDERA (13 octubre 2026)

## Causa y solución
En PR #32 el POS dejó de escribir `user_profiles` en cada carga
cuando el contenido no cambió. Existía una ventana de carrera:
dos cargas de perfil simultáneas podían leer la caché todavía vacía
y emitir el mismo `upsert()` de PostgreSQL dos veces, o escribir
dos versiones de perfil en paralelo.

Un único upsert en vuelo por sesión de propietario evita duplicados.
Las peticiones idénticas comparten resultado. Las diferentes esperan
el upsert anterior antes de enviar cambios nuevos; se evita pisar
el perfil nuevo con una respuesta obsoleta. Si falla, la caché no se
actualiza y una carga posterior reintenta. El cambio de usuario
impide que continúen escrituras de una sesión anterior. La reparación
de roles sigue ejecutándose cuando se necesita.

## Evidencia y límites
Pruebas en VM sobre el fragmento real: 100 eventos idénticos => 1
upsert, cambios de perfil serializados, fallo compartido/reintento,
logout durante la consulta, mantenimiento de activación de roles,
y archivo raíz = `www/app.js`. Ledger SHA256 reversible actualizado.

El cambio no altera tablas, índices, RLS, pagos, pedidos ni
notificaciones de cocina. No garantiza una CPU del 0% ni prueba
disponibilidad del 99,9%; hace falta monitoreo real del proyecto.
