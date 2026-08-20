# RC ORDERA V85 - Auditoria previa a cambios

Fecha: 2026-08-20  
Fuente: `SOURCE-IMMUTABLE.zip`  
SHA-256: `CB38DE65284DFF55C7682C5FE3ECC36DD88087A6B727C018E8CC9FA57D5EAC64`

## Arquitectura encontrada

- Aplicacion web estatica/PWA con cinco entradas: restaurante (`index.html`), cliente (`cliente.html`), personal/estaciones (`mesero.html`), colaborador (`colaborador.html`) y administracion (`admin.html`).
- Supabase Auth con claves de almacenamiento separadas por entorno.
- Datos operativos en Supabase y continuidad local con `localStorage` para pedidos, borradores y cola sin conexion.
- Realtime para pedidos, menu, directorio de restaurantes, estados y ofertas de entrega.
- Migraciones incrementales hasta V84.1, Edge Functions para despacho, Push y eliminacion de cuenta.
- Precios de pedidos de cliente recalculados en PostgreSQL y guardados como snapshot desde V82.
- Pagos online aun no implementados: las tablas financieras existentes solo preparan el modelo y no crean cobros ni transferencias.

## Hallazgos reales

### CRITICO - menu expuesto a sobrescritura al reconectar

- Archivo: `app.js`, carga de nube y `saveCloudSettings`.
- Causa: una unica bandera `settingsPending` representa menu, perfil, contador y otros ajustes. Si existe, la carga envia a Supabase el menu local completo antes de comparar con el menu remoto.
- Efecto: un menu remoto valido puede ser sustituido por un menu local vacio o antiguo.
- Reparacion: separar revisiones pendientes de menu y ajustes, confirmar revisiones en servidor y bloquear cualquier vaciado implicito.

### CRITICO - vaciado de menu incompleto

- Archivos: `app.js`, `index.html`.
- Causa: la ventana valida la frase, pero no reautentica, no crea respaldo y no llama una RPC transaccional.
- Efecto: la proteccion visible no cumple el flujo seguro solicitado.
- Reparacion: respaldo inmutable + reautenticacion + RPC del propietario + auditoria.

### ALTO - estados de colaborador apuntan a un ID HTML duplicado

- Archivo: `colaborador.html`.
- Causa: existen dos elementos `courierHeaderStatus`.
- Efecto: JavaScript actualiza solo el primero y el panel puede mostrar un estado contradictorio.
- Reparacion: IDs unicos y render sincronizado de ambos indicadores.

### ALTO - pagos solo preparados, no operativos

- Archivos: migracion financiera V84 e interfaz de ajustes.
- Causa: no hay checkout, onboarding de cuentas conectadas, webhooks firmados, libro de distribuciones ni transferencias.
- Efecto: no es posible cobrar ni dividir dinero de forma real.
- Reparacion: arquitectura marketplace en backend. Polonia puede usar Stripe Connect. Colombia requiere habilitacion comercial de split 1:N; no se activara un proveedor ficticio.

### ALTO - estaciones no separan lineas por area

- Archivos: `mesero.js`, migraciones de personal/estaciones.
- Causa: solo existen waiter/cashier/manager/kitchen/packing/dispatch y las estaciones leen el pedido completo.
- Efecto: bebidas, parrilla, entradas, ensaladas y comidas rapidas no tienen cola independiente.
- Reparacion: estacion por producto, tareas por pedido y transiciones independientes.

### MEDIO - historial del mesero no es diario

- Archivo: `mesero.js`.
- Causa: consulta los ultimos 30 pedidos sin limite de fecha.
- Efecto: el turno nuevo conserva pedidos de dias anteriores.
- Reparacion: consulta por fecha de negocio y cierre diario del mesero.

### MEDIO - cierres incompletos

- Archivos: `app.js`, `index.html`.
- Causa: existen cierre diario y mensual, pero no anual; no existe reporte diario del mesero ni asistencia.
- Reparacion: cierre anual del restaurante, cierre diario del mesero y control de entrada/salida con resumen semanal/mensual.

### MEDIO - traduccion dinamica depende de servicios publicos no contractuales

- Archivos: `cliente.js`, `auto-translate.js`.
- Causa: usa endpoints publicos de traduccion como apoyo.
- Efecto: puede fallar por cuota, CORS o disponibilidad.
- Reparacion: conservar traducciones ES/PL/EN guardadas y fallback local; documentar traduccion automatica profesional como servicio backend configurable.

### MEDIO - referencia visual aun incompleta

- Las pantallas ya contienen partes de la jerarquia solicitada, pero restaurante, mesero y colaborador no reproducen aun toda la navegacion de las capturas.
- Reparacion: cambios incrementales sobre HTML/CSS existentes, sin hardcodear restaurantes, productos, pedidos ni ganancias.

## Validaciones iniciales ejecutadas

- Sintaxis JavaScript: `app.js`, `cliente.js`, `mesero.js`, `colaborador.js`, `admin.js` y `auto-translate.js` pasan `node --check`.
- IDs HTML: se encontro un duplicado real en `colaborador.html`; las otras cuatro entradas no tienen IDs duplicados.
- Credenciales: no se encontro `service_role` ni clave privada de pagos en el frontend. La clave web de Maps debe restringirse por dominios en Google Cloud.
- Service Worker: usa estrategia de red para documentos/scripts/estilos y no cachea respuestas de Supabase.

## Limites externos de produccion

- Ningun pago se declarara activo sin cuenta del proveedor, KYC de plataforma/restaurante/colaborador, secretos en Edge Functions y webhook validado.
- Las pruebas remotas de RLS, cobros y transferencias necesitan ejecutar la migracion en el proyecto Supabase y usar cuentas de prueba autorizadas.

