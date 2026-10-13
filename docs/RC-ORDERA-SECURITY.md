# RC ORDERA — seguridad del paquete
## Controles preservados
No se desactiva RLS ni se publican claves. RPC privados de reserva, asociación y recuperación solo para service_role; PUBLIC, anon y authenticated sin EXECUTE. El cliente recibe URL de checkout verificada, no credenciales.
Las migraciones verifican prerrequisitos y huellas del cuerpo existente. La modificación de RPC de pedidos conserva contratos y ACL; permite SumUp solo dentro de configuración de Polonia. Las reservas usan precios del servidor. Bloqueos en orden pedido → intento, transacciones cortas y sin llamadas de proveedor dentro.

La recuperación financiera verifica datos contra SumUp antes de cambios de estado. No se reintenta POST de creación automáticamente. La URL no acepta dominio ajeno, credenciales, query, fragmento ni identificador arbitrario.

## Entorno local
Las ejecuciones históricas mostraron puertos publicados en 0.0.0.0 y ::. La opción de red host_binding_ipv4=127.0.0.1 no había cambiado el resultado observado de Supabase. No declarar aislamiento resuelto por esa opción. No iniciar con datos reales ni abrir router/puerto Docker 2375. Verificar enlaces efectivos, firewall y alcance de red antes de usar el entorno.
Docker fue inspeccionado sin iniciar ni eliminar contenedores.

## Producción observada previamente en esta ejecución
Proyecto ouulrehcgmfbettseibn: existía customer_orders, pero no rc_sumup_payment_attempts ni RPC de reserva/aplicación SumUp. No aparecían funciones desplegadas sumup-checkout/sumup-webhook. Historial de migraciones no equivale al esquema real cuando existen cambios manuales. No se aplicó DDL ni se modificaron secretos/finanzas.
La observación es una fotografía, no garantía de estado futuro.

## Límites de evidencia
PGlite comprueba SQL y ACL localmente; no demuestra aislamiento de dos usuarios ni concurrencia de conexiones reales. E2E usa servicios controlados, no pagos de proveedor. Diario fiscal Windows sigue bloqueado por sincronización de directorio: no se elimina la protección para ocultar el fallo.
