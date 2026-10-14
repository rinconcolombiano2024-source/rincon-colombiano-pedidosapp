# R19: conectar el recorrido del cliente con SumUp

El cliente antes invocaba exclusivamente marketplace-checkout y solo aceptaba direcciones de Stripe. Las funciones SumUp aisladas no permitían completar ese recorrido.

Ahora, tras autenticar al comprador o verificar su token, marketplace-checkout consulta el proveedor persistido únicamente si SumUp está habilitado y el pedido pertenece al restaurante autorizado. Un pedido reservado en Stripe continúa en Stripe. Un pedido reservado en SumUp nunca cambia a Stripe cuando hay errores o cambia la configuración. La llamada a sumup-checkout transmite solo ID y prueba del pedido, no importes o comercio elegidos por el navegador. El cliente valida el proveedor y el dominio exacto de la dirección de pago.

Piloto: PLN, consumo en local o recogida, sin propinas ni coste de reparto. Ambos endpoints rechazan otras modalidades de SumUp. La migración de reservas y la verificación del proveedor siguen siendo obligatorias; la nueva ruta no marca pagos desde la redirección.

Activación pendiente: estructura de datos probada en staging, secretos de cuenta empresarial, RC_SUMUP_PAYMENTS_ENABLED=1, RC_SUMUP_RESTAURANT_USER_ID y onlinePaymentProvider=sumup en configuración del restaurante; despliegue de marketplace-checkout, sumup-checkout y sumup-webhook con sus dependencias; pruebas de cobro/devolución conciliadas. No pegar credenciales en chats ni guardar claves en GitHub. Esta entrega no activa esos valores ni cobra dinero.

La versión PWA cambia a 2026-10-13-r19 para renovar archivos sin borrar pedidos ni almacenamiento local. Vercel mantiene un bloqueo de cuota observado; la fusión no acredita publicación.

Se conserva `sumup` al cargar el menú público y al guardar ajustes. El cliente solo ofrece SumUp para consumo local/recogida en Polonia; cambiar a domicilio retira la opción online. El selector de restaurante muestra una configuración SumUp ya provisionada, pero no permite activarla accidentalmente desde el navegador. La activación inicial continúa controlada hasta completar las pruebas de cuenta.

También se requiere V91-74: el RPC de creación de pedidos anterior aceptaba exclusivamente Stripe. La migración cambia solo esa condición de la función desplegada, exige V91-73 y aborta si no reconoce exactamente el bloque esperado. Conserva precios, validación del menú, idempotencia y permisos. No se ha aplicado a producción.
