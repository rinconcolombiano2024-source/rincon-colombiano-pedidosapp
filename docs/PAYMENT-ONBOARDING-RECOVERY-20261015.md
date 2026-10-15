# Conexión empresarial: recuperación de enlaces Stripe

Base auditada: d1cd9a2 (R26). Se revisaron main, ramas y PR abiertos antes de modificar. Ningún cambio de frontend, pedidos, importes, RLS o activación de cobros.

## Problema y cambio

El backend enviaba `refresh_url` y `return_url` a `payments=return`. Un enlace de alta caducado o reutilizado solo consultaba el estado; no solicitaba otro enlace. Los módulos restaurante y colaborador ya implementan `payments=refresh` con sesión autenticada. Se reutiliza ese flujo, conservando `return` para consulta de estado y sin considerar el retorno como confirmación financiera.

Además se rechazan URLs del proveedor con usuario o contraseña embebidos. HTTPS y el dominio exacto siguen siendo obligatorios.

Referencia primaria: https://docs.stripe.com/connect/express-accounts#refresh_url

## Evidencia

Antes: siete pruebas existentes aprobadas y tres regresiones nuevas fallidas (restaurante, colaborador y URL con credenciales). Después: doce pruebas de ejecución aprobadas, incluidas dos comprobaciones de claves de idempotencia estables y ligadas al propietario. Las llamadas al proveedor son simuladas; no son una certificación de cobro real ni prueba KYC.

CI debe completar la suite y E2E antes de la fusión. El despliegue conserva `verify_jwt=true`. Reversión: redesplegar la versión anterior del endpoint; no requiere migración de datos.

## Conectar MENDEZ OSPINA Sp. z o.o.

1. Configurar privadamente Stripe Connect y los secretos `STRIPE_SECRET_KEY`, `APP_BASE_URL` y los secretos de webhook utilizados por la integración existente. No colocarlos en el repositorio, frontend ni chat.
2. En Restaurante → Configuración → Configurar pagos, iniciar el alta desde la sesión del propietario. Completar la verificación empresarial que solicite Stripe.
3. En modo de prueba, verificar pago aprobado, rechazado, webhook repetido, conciliación y reembolso. Solo después autorizar activación real.

La cuenta SumUp confirmada por el propietario no equivale a una integración desplegada: a la última comprobación faltan sus funciones y registro transaccional en Supabase. No cambiar a SumUp en producción hasta validar esas dependencias y el proveedor. BLIK requiere elegibilidad y una prueba del proveedor; POSNET requiere hardware real.
