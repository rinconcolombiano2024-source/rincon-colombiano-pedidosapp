# Compatibilidad de las funciones instaladas — 2026-10-11

Estado: preparado y probado localmente; NO aplicado a Supabase. Incluido en esta entrega; el ZIP V6 anterior no lo contiene.

La migración V6-20261011-01 compara huellas exactas de las tres funciones exportadas por el propietario. Conserva permisos y controles de empaque; añade el mismo advisory lock transaccional por pedido a las dos rutas, corrige referencias ambiguas de delivery_quotes.id y customer_orders.station_status, y exige restaurante activo/no eliminado para estaciones. No reemplaza la política de cuotas del wrapper.

Validación: cuatro pruebas nuevas aprobadas con PostgreSQL embebido PGlite; npm run qa terminó con código 0. La primera ejecución detectó un error 42702 al completar empaque, corregido y vuelto a probar. Las fixtures contienen solo definiciones de funciones, sin datos de clientes ni credenciales.

Limitaciones: PGlite serializa solicitudes; no demuestra concurrencia entre conexiones independientes. Falta comprobarla en PostgreSQL con varias conexiones, además de RLS/roles reales, triggers de entrega y estructura completa de producción. No existe validación de impresora física ni plataformas comerciales. Esta migración no completa IVA, fiscal result RPC, traducción v2 ni outbox.

Antes de producción: verificar esquema/huellas, copia recuperable y permisos efectivos; probar rutas de pedido, entrega y estaciones con datos ficticios; revisar diff y desplegar con autorización específica. No ejecutar las migraciones históricas 02/07 después de esta modificación: sus precondiciones difieren y necesitan una ruta incremental compatible.

Recuperación: antes de aplicar, exportar pg_get_functiondef y ACL de las tres funciones. Una ejecución fallida revierte por transacción. Para revertir una ejecución confirmada, restaurar esas definiciones verificadas sin eliminar pedidos; hacerlo con trabajadores detenidos y en ventana controlada.
