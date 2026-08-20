# Rollback RC ORDERA V85

## Aplicacion

Vuelve a desplegar el ZIP inmutable de la version anterior. El service worker V85
elimina caches antiguas al activarse; al volver a publicar una version anterior,
esa version debe usar un nombre de cache nuevo para evitar mezcla de archivos.

## Base de datos

No borres tablas V85 mientras existan escrituras o pagos. El rollback seguro es:

1. Desactivar `onlinePaymentProvider` en los restaurantes.
2. Detener nuevos checkouts y conservar webhook/settlement para pagos iniciados.
3. Esperar o conciliar todas las asignaciones pendientes.
4. Volver a desplegar el frontend anterior.
5. Mantener tablas y columnas V85 sin uso hasta una ventana de mantenimiento.

Las tablas nuevas son compatibles hacia atras. Eliminarlas no forma parte del
rollback automatico porque podria destruir respaldos, cierres, jornadas o dinero.
Para un incidente grave usa el respaldo de Supabase creado antes de migrar.
