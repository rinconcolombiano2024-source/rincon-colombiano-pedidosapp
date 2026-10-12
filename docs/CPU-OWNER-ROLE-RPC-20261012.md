# RC ORDERA — evitar RPC de activación redundante · 2026-10-12

## Prueba en producción
`pg_stat_user_tables` registró 783 actualizaciones acumuladas en
`user_roles` (19 filas visibles aproximadas) y 809 en `user_profiles`
(10 filas visibles aproximadas). Son contadores acumulados, NO tasas ni
un porcentaje de CPU.

El POS lee ya `user_roles` en el arranque, filtrando por
`restaurant_owner` y `active`, pero luego vuelve a llamar
`activate_user_role('restaurant_owner')` sin importar si el rol estaba
correctamente activo. La función PL/pgSQL de producción ejecuta un
`INSERT ... ON CONFLICT DO UPDATE SET updated_at=now()` incluso
cuando no cambia ninguna autorización; ello escribe WAL y puede activar
más trabajo SQL innecesario.

## Solución limitada
- Asegurar que la consulta de rol se limita al ámbito exacto
  `platform` + identificador de ámbito esperado.
- Si el servidor confirmó que ese rol ya está **activo**, no volver a
  invocar `activate_user_role` solo para tocar `updated_at`.
- Si falta el rol, hubo error de lectura o no está activo, conservar la
  activación existente y sus controles de seguridad en Postgres.
- Mantener la escritura del perfil `user_profiles` como antes para no
  alterar la sincronización de datos de registro.
- Sin modificación de roles, RLS, JWT, SQL, tablas o migraciones;
  solo se elimina un RPC redundante cuando hay confirmación del servidor.
- Guardar una delta reversible de `app.js` y comparar `www/app.js`.

## QA y medición
Pruebas para rol activo, rol ausente y error del perfil, además de CI
completa. Para evaluar CPU comparar tasas reales de actualización de
`user_roles` y llamadas a `activate_user_role` con ventanas de uso
similares. No prometer la reducción del 93 % sin acceso a métricas
de CPU de Supabase durante servicio real.
