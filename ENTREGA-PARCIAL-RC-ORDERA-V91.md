# RC ORDERA V91 - Entrega parcial de optimizacion

Fecha: 28 de agosto de 2026.

Esta entrega conserva el ZIP original y contiene solamente los cambios alcanzados y comprobados localmente.

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

## Migracion incluida

`MIGRACION-V91-01-RENDIMIENTO-INTEGRIDAD-Y-CIERRES.sql`

La aplicacion modificada requiere ejecutar esa migracion en Supabase antes de desplegarla. La migracion es incremental: no borra tablas, usuarios ni pedidos. No fue ejecutada contra la base de datos productiva desde este entorno.

## Comprobaciones realizadas

- Sintaxis de todos los archivos JavaScript principales: correcta.
- Archivos modificados de raiz y carpeta `www`: sincronizados por hash.
- ZIP original del usuario: no modificado.

## Pendiente

- Ejecutar y validar la migracion V91 en una copia o entorno de prueba de Supabase.
- Completar traducciones nuevas V91 y pruebas visuales de los tres idiomas.
- Completar pruebas reales con varias cuentas, Realtime, perdida de conexion, Storage e impresion.
- Finalizar la estrategia de cache del service worker y actualizar el numero final de version despues de esas pruebas.

Esta entrega no debe considerarse certificada para produccion hasta completar las pruebas pendientes.
