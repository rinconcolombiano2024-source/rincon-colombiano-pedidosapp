# RC ORDERA — puerta de lanzamiento
Fecha: 2026-10-13. Decisión: **NO-GO para dinero real**. Este paquete es una propuesta de código, no un despliegue.
## Secuencia obligatoria
1. Mantener desactivado RC_SUMUP_PAYMENTS_ENABLED; no modificar producción.
2. Preparar staging separado y autorizado. Docker Desktop está disponible, pero RC-ORDERA-TEST no está iniciado. El contenedor rc-ordera-bind-probe es una prueba, no la base de datos.
3. Comprobar copias recuperables, esquema, firmas, cuerpos y ACL de funciones. Las migraciones nuevas NO constituyen un bootstrap completo. No ejecutar db push ni todas las migraciones históricas indiscriminadamente.
4. Revisar y aplicar en staging los prerrequisitos de MIGRACION-V91-73-SUMUP-SINGLE-MERCHANT-LEDGER.sql y MIGRACION-V6-20261011-01-DEPLOYED-RPC-COMPAT.sql. Ejecutar después, por orden, las tres migraciones 20261013 de esta propuesta. Sus verificaciones deben detener el despliegue ante deriva.
5. Desplegar sumup-checkout y sumup-webhook en staging, configurar credenciales de prueba mediante el almacén seguro del servidor. Configurar el webhook oficial. Nunca pegar claves en GitHub ni chat.
6. Probar los 20 escenarios de RC-ORDERA-PAYMENTS.md con proveedores de prueba reales y sesiones independientes de PostgreSQL. PGlite serializa llamadas y no demuestra concurrencia real.
7. Corregir bloqueos del diario fiscal en Windows y liquidación Stripe. Probar hardware fiscal concreto; compatibilidad universal y validez legal NO demostradas.
8. Aprobar PR únicamente después de controles de calidad completos, conciliación y revisión.
9. Obtener autorización empresarial separada para credenciales live, activación y operaciones reales controladas; verificar recepción del pedido y el pago antes de abrir al público.

## Bloqueos que requieren al propietario
- Proyecto staging separado y credenciales sandbox/test de los proveedores, configuradas de forma segura.
- Identidad del comercio SumUp y UUID del único restaurante autorizado.
- Modelo de caja/impresora, protocolo y acceso al dispositivo para pruebas.
- Autorización empresarial live solo después de superar las puertas anteriores.

## Recuperación
No eliminar pedidos, transacciones ni volúmenes. Desactivar nuevas creaciones ante incidentes, conservar referencias y conciliar contra el proveedor. Un resultado incierto jamás autoriza otro cobro automático. No revertir a código que pierda controles de reserva o autorización.
