# RC ORDERA V91 - Entrega cerrada de optimizacion

Fecha: 28 de agosto de 2026.

Esta entrega conserva el ZIP original y contiene los cambios de rendimiento e integridad comprobados localmente.

## Reparaciones incluidas

- Se reparo el error de sintaxis que impedia cargar `auto-translate.js`.
- Se redujo la carga inicial de pedidos locales y de nube de 5.000 a 250 registros recientes.
- El cache local de pedidos se guarda de forma diferida para no bloquear botones y pantallas.
- Realtime pasa a ser el mecanismo principal para pedidos y entregas; el sondeo queda como respaldo cuando el canal no esta conectado.
- Se elimino la suscripcion global de ubicaciones de colaboradores en el panel del restaurante.
- Los cambios de pedidos actualizan la tarjeta afectada sin reconstruir toda la lista.
- El chat de cada pedido se carga al abrirlo, evitando una consulta adicional por cada pedido.
- Se agrego control de solicitudes simultaneas para evitar recargas y consultas duplicadas.
- El cliente abre inmediatamente el restaurante seleccionado y actualiza los datos en segundo plano.
- Se redujeron renderizados repetidos al tocar productos y categorias.
- El guardado de pedidos muestra respuesta visual inmediata y bloquea envios dobles.
- Los cierres diario, mensual y anual quedan preparados para calcularse en Supabase sin descargar historiales masivos.
- Cancelar un pedido guardado deja de borrarlo fisicamente y conserva su historial como cancelado.
- La lectura de ofertas de colaboradores deja de modificar o reasignar pedidos como efecto secundario.
- La actualizacion de estados de entrega queda preparada para ser atomica.
- Se retiro el guardado del menu mediante rutas antiguas que podian sobrescribir revisiones nuevas.
- Se agregaron respuestas tactiles inmediatas a los botones.

## Migraciones requeridas (actualizado 8 de septiembre de 2026)

`MIGRACION-V91-01-RENDIMIENTO-INTEGRIDAD-Y-CIERRES.sql`

V91-01 sola NO basta. El frontend requiere schema_version 91 y contrato 7 compatible. Aplicar las migraciones pendientes en el orden indicado abajo; no se han ejecutado en produccion desde este entorno.

## Comprobaciones realizadas

- Sintaxis de todos los archivos JavaScript principales: correcta.
- Archivos modificados de raiz y carpeta `www`: sincronizados por hash.
- QA V91 de rendimiento e integridad: 22 comprobaciones aprobadas.
- QA de idiomas ES/PL/EN: 2.018 comprobaciones aprobadas.
- Arranque HTTP local de restaurante, cliente, colaborador, mesero y administracion: respuesta correcta.
- ZIP original del usuario: no modificado.

## Optimizacion final de respuesta

- La busqueda de productos espera una pausa breve al escribir y evita reconstruir el menu en cada tecla.
- El cache local del menu se serializa cuando el navegador queda libre; sin internet se guarda inmediatamente.
- El directorio del cliente deja de consultar cada 15 segundos mientras Realtime permanece conectado.
- El seguimiento del pedido deja de consultar cada 8 segundos mientras Realtime permanece conectado.

## Orden de instalacion

1. Respaldar la base y probar en un entorno de ensayo con el esquema previo instalado.
2. Aplicar las migraciones pendientes, en este orden:
   - `MIGRACION-V91-01-RENDIMIENTO-INTEGRIDAD-Y-CIERRES.sql`
   - `MIGRACION-V91-02-SINCRONIZACION-CANCELACION-PEDIDOS.sql`
   - `MIGRACION-V91-03-CONTRATO-MULTIESTACION-Y-REALTIME.sql`
   - `MIGRACION-V91-04-GUARDADO-ATOMICO-PEDIDOS.sql`
   - `MIGRACION-V91-04-CONTROL-CARGA-SINCRONIZACION.sql` (es distinta de la anterior).
   - `MIGRACION-V91-05-POS-SINCRONIZA-CERRADO.sql`
   - `MIGRACION-V91-06-CORREGIR-SYNC-ESTACIONES.sql`
   - `MIGRACION-V91-07-CONTRATO-COMPATIBILIDAD-SINCRONIZACION.sql`
3. Volver a ejecutar V91-07 de ESTE paquete aunque ya se hubiera aplicado la version anterior: agrega de forma idempotente orders y customer_order_messages a Realtime. No requiere V91-08 ni desactiva RLS.
4. En SQL Editor con rol postgres ejecutar `select * from public.get_rc_ordera_sync_contract();`. Exigir schema_version=91, contract_version=7, compatible=true y missing_components vacio. Si falla, no desplegar: resolver los componentes indicados.
5. Desplegar la funcion Supabase `marketplace-checkout` de este paquete; subir solo Vercel no actualiza las Edge Functions.
6. Desplegar el frontend y comprobar con dos dispositivos pedidos, estaciones y chat. No borrar almacenamiento local con pendientes.

## Validacion externa pendiente

- Ejecutar y validar la migracion V91 en una copia o entorno de prueba de Supabase.
- Completar pruebas reales con varias cuentas, Realtime, perdida de conexion, Storage e impresion.

La revision local queda cerrada. La certificacion de produccion requiere ejecutar la migracion y las pruebas externas contra el proyecto real de Supabase.
