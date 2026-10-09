
# RC ORDERA
# MAPA MAESTRO DE INTEGRACIONES V1.0

## 1. OBJETIVO GENERAL

Construir una arquitectura profesional, segura, robusta y escalable para integrar:

- Impresoras fiscales POSNET
- Impresoras fiscales NOVITUS
- Impresoras fiscales ELZAB
- Otros fabricantes compatibles
- Uber Eats
- Wolt
- Glovo
- Bolt Food
- Otros proveedores de reparto
- Supabase
- RC ORDERA
- Contabilidad
- POS
- Cocina
- Administración
- Control de ventas y pagos

Todo debe funcionar mediante módulos independientes.

No se deben destruir ni reescribir innecesariamente las funciones existentes.

## 2. PRINCIPIOS DE SEGURIDAD

1. No emitir recibos fiscales duplicados.
2. No importar pedidos externos duplicados.
3. No confiar en información recibida sin validación.
4. No exponer claves privadas al navegador.
5. No permitir impresión fiscal sin autorización.
6. No utilizar reintentos automáticos de impresión cuando el resultado sea desconocido.
7. No activar proveedores sin credenciales oficiales verificadas.
8. No utilizar procesos innecesarios que saturen la CPU.
9. No modificar producción sin pruebas.
10. Mantener separación entre restaurantes y sedes.

## 3. MAPA GENERAL DEL SISTEMA

                    RC ORDERA
                        |
              MOTOR CENTRAL DE PEDIDOS
                        |
          +-------------+-------------+
          |                           |
    INTEGRACION FISCAL         INTEGRACION REPARTO
          |                           |
     FISCAL BRIDGE              DELIVERY BRIDGE
          |                           |
    +-----+-----+               +-----+------+
    |     |     |               |     |      |
 POSNET NOVITUS ELZAB         WOLT  GLOVO  UBER EATS
    |     |     |                      |
    +-----+-----+                  BOLT FOOD
          |                           |
      CONCILIACION                 WEBHOOKS
          |                           |
          +-------------+-------------+
                        |
                   SUPABASE
                        |
                   CONTABILIDAD
                        |
                 PANEL ADMINISTRADOR

## 4. MAPA DE IMPRESION FISCAL

PEDIDO CONFIRMADO
        |
VALIDACION DEL PEDIDO
        |
VALIDACION DE PRODUCTOS
        |
VALIDACION DE CANTIDADES
        |
VALIDACION DE IMPORTES
        |
VALIDACION DE IVA / VAT
        |
OPERACION FISCAL PENDIENTE
        |
COLA FISCAL PERSISTENTE
        |
AUTORIZACION DEL DISPOSITIVO
        |
SERVICIO FISCAL LOCAL
        |
CONTROLADOR DEL FABRICANTE
        |
IMPRESORA FISCAL
        |
RESPUESTA DEL DISPOSITIVO
        |
CONCILIACION
        |
REGISTRO CONTABLE

La confirmacion fiscal requiere evidencia real del dispositivo.

Si el resultado de una transmision es desconocido, la operacion queda bloqueada hasta su conciliacion.

## 5. CONTRATO DE CONTROLADORES FISCALES

Cada controlador debe implementar:

- connect()
- getStatus()
- printReceipt()
- reconcile()
- disconnect()

Cada fabricante puede requerir un protocolo diferente.

La compatibilidad debe comprobarse para:

- Fabricante
- Modelo
- Firmware
- Protocolo
- Puerto de comunicacion
- Configuracion fiscal
- Tabla de tasas VAT
- Capacidades de consulta
- Confirmacion de impresion

Registrar un controlador no significa que el dispositivo este certificado ni listo para imprimir.

## 6. ESTADOS FISCALES

Estados existentes del contrato:

- pending
- claimed
- sending
- confirmed
- unknown
- failed
- cancelled

Transiciones principales:

pending -> claimed
claimed -> sending
sending -> confirmed
sending -> unknown
sending -> failed
unknown -> confirmed
unknown -> failed
pending -> cancelled

Las transiciones deben cumplir el contrato fiscal existente.

El estado unknown nunca debe generar un reintento automatico de impresion.

## 7. BASE DE DATOS FISCAL

Componentes existentes:

- fiscal_devices
- fiscal_operations
- fiscal_events

Funciones existentes de preparacion:

- rc_fiscal_claim_next()
- rc_fiscal_mark_sending()

Funciones o servicios por completar:

- Registrar evidencia del dispositivo
- Confirmar resultado fiscal verificable
- Conciliar operaciones desconocidas
- Registrar fallos de comunicacion
- Administrar autorizaciones de dispositivos
- Consultar estado del agente local
- Asociar configuracion fiscal por sede
- Validar tasas de IVA y letras fiscales
- Generar reportes de auditoria

Las funciones nuevas deben diseñarse sin duplicar las existentes.

## 8. MAPA DE APLICACIONES DE REPARTO

UBER EATS / WOLT / GLOVO / BOLT FOOD
                  |
          API / WEBHOOK OFICIAL
                  |
          AUTENTICACION
                  |
          VALIDACION DE FIRMA
                  |
          IDENTIFICACION DE SEDE
                  |
          NORMALIZACION
                  |
          CONTROL DE DUPLICADOS
                  |
          BANDEJA DE ENTRADA
                  |
          VALIDACION DE CATALOGO
                  |
          VALIDACION DE IMPORTES
                  |
          VALIDACION DE PAGOS
                  |
          REVISION / AUTORIZACION
                  |
          IMPORTACION TRANSACCIONAL
                  |
          PEDIDO RC ORDERA
                  |
           +------+------+
           |             |
         COCINA         POS
           |             |
           +------+------+
                  |
          SINCRONIZACION
                  |
          CONCILIACION
                  |
          CONTABILIDAD

## 9. MODULOS DE DELIVERY BRIDGE

Cada plataforma utilizara su propio adaptador.

Contrato actual:

- verify()
- normalize()

Modulos adicionales necesarios:

- Autenticacion del proveedor
- Administracion de credenciales
- Asociacion de tiendas
- Registro de eventos
- Control de duplicados
- Conversion de productos
- Conversion de modificadores
- Validacion monetaria
- Importacion segura
- Envio de estados
- Control de cancelaciones
- Gestion de errores
- Conciliacion de pagos
- Conciliacion de comisiones
- Control de liquidaciones

Las integraciones oficiales requieren acceso autorizado a las APIs de cada proveedor.

No se deben inventar contratos ni firmas de webhooks.

## 10. BASE DE DATOS DE REPARTO

Componentes existentes:

- rc_external_delivery_inbox
- rc_external_delivery_events
- rc_external_product_mapping

Funciones existentes:

- rc_external_receive_atomic()
- rc_external_ingest_order()
- rc_external_register_event()
- rc_external_check_order_items()
- rc_external_order_readiness()
- rc_external_validate_money()
- rc_external_consolidated_audit()
- rc_external_set_product_mapping()

Componentes futuros:

- Conexiones oficiales por proveedor
- Credenciales cifradas
- Asociaciones de tiendas
- Cola de acciones salientes
- Historial de sincronizacion
- Conciliacion de liquidaciones
- Registro de fallos
- Auditoria de acciones administrativas

No sustituir las tablas existentes si pueden ampliarse de forma compatible.

## 11. IMPORTACION DE PEDIDOS EXTERNOS

Antes de crear un pedido interno:

1. Confirmar autenticidad del evento.
2. Identificar correctamente la sede.
3. Comprobar idempotencia.
4. Validar productos.
5. Validar cantidades.
6. Validar modificadores.
7. Validar precios.
8. Validar descuentos.
9. Validar impuestos.
10. Validar forma de pago.
11. Validar disponibilidad del restaurante.
12. Confirmar autorizacion de importacion.
13. Crear el pedido en una transaccion segura.
14. Guardar la asociacion externa.
15. Notificar a cocina.
16. Registrar el resultado para conciliacion.

La importacion automatica sigue deshabilitada en la implementacion actual.

Solo se activara tras disponer del motor transaccional y superar las pruebas de seguridad.

## 12. PAGOS Y CONTABILIDAD

El sistema debe distinguir:

- Venta bruta
- Venta neta
- IVA / VAT
- Descuentos
- Propinas
- Gastos de entrega
- Comisiones del proveedor
- Pagos recibidos por el restaurante
- Pagos cobrados por la plataforma
- Devoluciones
- Cancelaciones
- Liquidaciones pendientes
- Liquidaciones confirmadas

Los importes monetarios se almacenaran en groszy utilizando enteros.

Los datos de contabilidad y fiscalizacion deben proceder de operaciones verificadas.

## 13. CONTROL DE CPU

Reglas obligatorias:

- Evitar bucles de consulta continua.
- Evitar temporizadores innecesarios.
- Utilizar indices adecuados.
- Limitar resultados de consultas.
- Utilizar procesamiento por lotes controlados.
- Aplicar limites por proveedor.
- Evitar conexiones duplicadas.
- Evitar listeners y suscripciones duplicadas.
- Utilizar idempotencia.
- Medir tiempos de respuesta.
- Medir consumo real de memoria.
- Medir consumo de CPU en pruebas de carga.

La disponibilidad del 99,9 % es un objetivo de servicio.

No se considera garantizada hasta que exista monitorizacion y evidencia operativa.

## 14. SEGURIDAD DE SUPABASE

Toda implementacion debe respetar:

- Autorizacion por restaurante
- Separacion por sede
- Politicas RLS
- Restriccion de service_role
- Validacion del origen de eventos
- Proteccion de secretos
- Validacion de operaciones RPC
- Seguridad transaccional
- Control de concurrencia
- Registro de auditoria
- Proteccion contra duplicados

Las claves de proveedores y los controladores fiscales nunca deben exponerse en el navegador.

## 15. PLAN DE IMPLEMENTACION

FASE 1
Documentacion y contratos de arquitectura.

FASE 2
Validaciones y pruebas de regresion.

FASE 3
Conexiones y credenciales de plataformas.

FASE 4
Recepcion y normalizacion oficial de pedidos.

FASE 5
Importacion transaccional de pedidos.

FASE 6
Sincronizacion de estados y cancelaciones.

FASE 7
Conciliacion financiera y contable.

FASE 8
Agente fiscal local seguro.

FASE 9
Controlador POSNET real.

FASE 10
Controladores de otros fabricantes.

FASE 11
Pruebas de extremo a extremo con hardware.

FASE 12
Pruebas de carga, monitoreo y despliegue gradual.

## 16. CRITERIOS DE ACEPTACION

Ninguna integracion se considera terminada hasta verificar:

- Autenticacion
- Autorizacion
- Integridad
- Idempotencia
- Persistencia
- Recuperacion de errores
- Aislamiento entre restaurantes
- Conciliacion
- Compatibilidad
- Pruebas de regresion
- Rendimiento
- Seguridad
- Auditoria

La comunicacion con equipos fiscales reales y las APIs de proveedores exige verificaciones adicionales.

## 17. ESTADO DEL PROYECTO

Arquitectura fiscal: EN DESARROLLO.

Simulador fiscal: IMPLEMENTADO.

Controladores fiscales reales: PENDIENTES.

Base SQL fiscal: PREPARADA PARA PRUEBAS.

Registro de adaptadores de reparto: IMPLEMENTADO.

Recepcion externa de prueba: IMPLEMENTADA.

Integraciones oficiales de reparto: PENDIENTES.

Importacion automatica externa: BLOQUEADA.

Conciliacion fiscal de hardware: PENDIENTE.

Objetivo final:

Unificar pedidos, reparto, cocina, ventas, pagos, fiscalizacion, contabilidad y administracion en un sistema profesional y escalable.

## 18. REGLA FINAL

AUDITAR
   |
IDENTIFICAR CAUSA RAIZ
   |
CORREGIR
   |
PROBAR
   |
VERIFICAR REGRESIONES
   |
MEDIR RENDIMIENTO
   |
APROBAR
   |
DESPLEGAR CONTROLADAMENTE

No modificar funcionalidades existentes sin una justificacion tecnica y pruebas suficientes.

No activar fiscalizacion real antes de validar hardware, protocolo, normativa y procedimientos operativos.

No habilitar importacion automatica de plataformas sin autorizacion oficial y conciliacion segura.

RC ORDERA — ARQUITECTURA MAESTRA V1.0
