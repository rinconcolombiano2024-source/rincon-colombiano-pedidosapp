# SumUp: estado ausente y preparación segura

Base revisada: 6d061b2. Las migraciones V91-73 y V91-74 siguen pendientes de validación con el esquema completo de staging. No se ejecutaron sobre producción.

## Fallo reproducido

En PostgreSQL, `NULL NOT IN (...)` no es verdadero. La función privada `rc_sumup_apply_verified_checkout` continuaba hasta la rama de pago si recibía un estado NULL. La ruta web valida estados, pero el registro financiero no debe depender únicamente de esa protección externa.

La corrección mínima añade `p_provider_status IS NULL` al rechazo inicial. No cambia estados válidos, precios, reservas ni permisos. Prueba de regresión en PostgreSQL local: se crea una venta pendiente y su reserva, se envían NULL, vacío, UNKNOWN y paid en minúsculas y se comprueba que no exista transacción y que la venta permanezca pendiente. Antes, la prueba falla; las once anteriores pasan.

## Preparación de las funciones

Las rutas existentes `sumup-checkout` y `sumup-webhook` requieren activación explícita, secretos privados y restaurante autorizado. Checkout verifica identidad o token de pedido; webhook consulta SumUp y compara la reserva persistente. Sin configuración válida deben responder 503 y no llamar al proveedor ni reservar una venta. Desplegar estas rutas no activa los pagos ni suple el registro transaccional.

No aplicar V91-73/V91-74 en producción solo porque pasen pruebas locales: verificar staging con triggers y permisos equivalentes, confirmación del proveedor, devolución y conciliación. No activar `RC_SUMUP_PAYMENTS_ENABLED=1` ni seleccionar SumUp para clientes hasta superar esos pasos.

La reversión del código consiste en revertir este commit. No hay datos de producción que revertir. Si V91-73 ya fue aplicada en otro entorno, no asumir que editar este archivo actualiza su función: preparar una migración de actualización validada para ese entorno.

Fuentes del proveedor revisadas: https://developer.sumup.com/online-payments/webhooks y https://developer.sumup.com/api/checkouts/create . El webhook no se considera comprobante de pago por sí solo.
