# RC ORDERA — pagos
## Cambios de este paquete
Se reutiliza la arquitectura existente. El cliente enruta SumUp a sumup-checkout y Stripe a marketplace-checkout, sin enviar importes ni comercio. Una operación en curso comparte una única solicitud; cambios de usuario/restaurante/proveedor invalidan la redirección tardía. La vuelta del checkout nunca marca un pedido pagado.
El importe recibido de SumUp se convierte desde representación decimal a grosz exactos sin tolerancia de fracciones. El identificador de página hospedada puede ser diferente del checkout: [documentación oficial](https://developer.sumup.com/online-payments/checkouts/hosted-checkout). La URL sigue limitada a HTTPS, checkout.sumup.com y ruta UUID válida.

Ante respuesta de creación perdida, se consulta checkout_reference y luego el checkout exacto. Cero resultados o varios resultados requieren revisión; nunca disparan otro POST. Se verifican comercio, referencia, importe, moneda e identidad antes de enlazar y aplicar el pago en una transacción privada. [API oficial](https://developer.sumup.com/api/checkouts/create).

El webhook no confía en su estado declarado: consulta la API oficial y una reserva conocida. [Contrato oficial](https://developer.sumup.com/online-payments/webhooks). Un pago confirmado con cancelación o deriva del pedido queda para revisión, no para preparación automática.

La reserva contraria Stripe tras reserva SumUp se bloquea antes del POST. Evidencias reales de pago no se descartan por el bloqueo. Se mantiene orden de bloqueo pedido → intento, sin HTTP dentro de transacciones.

## Configuración exclusivamente del servidor
- SUMUP_API_KEY: credencial privada, alcance autorizado.
- SUMUP_MERCHANT_CODE: comercio autorizado.
- RC_SUMUP_RESTAURANT_USER_ID: UUID del único restaurante autorizado.
- RC_SUMUP_PAYMENTS_ENABLED: habilitación explícita con valor 1; ausente mantiene desactivación.
- APP_BASE_URL: origen confiable para retorno y webhook.
No activar otro restaurante con esta cuenta. La opción SumUp administrativa queda visible pero deshabilitada para habilitación del operador.
Stripe conserva sus credenciales privadas/webhook existentes; no se altera el modelo marketplace. No prometer BLIK, wallets o P24 hasta comprobar capacidades de la cuenta.

## Matriz de aceptación
Todos los escenarios requieren evidencia de proveedor de prueba real antes de GO. Las pruebas locales son evidencia adicional, no sustitución.

| Escenario | Resultado exigido | Evidencia de este paquete |
|---|---|---|
| 1 SumUp aprobado | Un pago, importe exacto, pedido asociado | SQL PGlite y API simulada; falta sandbox |
| 2 Stripe aprobado | Firma válida y una confirmación | No validado con proveedor en esta ejecución |
| 3 Rechazo | No preparar como pagado | Estados locales; falta sandbox |
| 4 Abandono | Pendiente/expirado, sin ingreso inventado | Falta recorrido de proveedor |
| 5 Corte de internet | Referencia conservada, sin segundo cobro | Recuperación GET simulada |
| 6 Webhook duplicado | Un asiento | Idempotencia SQL local |
| 7 Webhook atrasado | No regresión financiera | Verificación y revisión locales; falta sandbox |
| 8 Webhook no autorizado | No efecto financiero | Pruebas de webhook local |
| 9 Precio alterado | Precio calculado por servidor | Ambos RPC probados localmente |
| 10 Doble pulsación | Un checkout | 100 pulsaciones, una invocación local |
| 11 Simultaneidad | Reserva única entre conexiones | Falta PostgreSQL concurrente real |
| 12 Cambio de restaurante | Sin redirección obsoleta | Prueba cliente local |
| 13 Restaurante cerrado | Rechazo operativo | RPC local; falta recorrido staging |
| 14 Permisos proveedor | Error sin pago falso | API simulada; falta cuenta test |
| 15 Pago sin actualización | Conciliación sin recrear checkout | Recuperación PAID e idempotencia locales |
| 16 Reembolso | Importe y libro conciliados | Pendiente con proveedor |
| 17 Cancelación | Revisión ante pago válido tardío | Reserva/SQL local; falta sandbox |
| 18 Transferencia fallida | Sin duplicación ni cierre prematuro | Bloqueo Stripe pendiente |
| 19 Reconexión | Recuperar estado del servidor | Pruebas locales de polling; falta recorrido sandbox |
| 20 Reinicio | Recuperar pago por referencia | Parte servidor local; falta recorrido completo |

## Pendientes financieros
Liquidación Stripe: cerrar el intervalo entre elegibilidad y envío, resultado incierto y fencing de trabajos antes de GO. No se declara resuelto por estas modificaciones. Reembolsos SumUp y estados unificados completos requieren validación adicional. Reglas históricas de comisión 5% productos y 0,1% entrega no modificadas; su aprobación empresarial actual no se ha confirmado.
