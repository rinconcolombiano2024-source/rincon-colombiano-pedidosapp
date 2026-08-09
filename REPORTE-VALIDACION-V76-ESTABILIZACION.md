# RC ORDERA V76 - reporte de estabilizacion

## Problemas corregidos

- Estado abierto/cerrado visible en la pantalla principal y modo automatico segun horario.
- Datos regionales completos para restaurante, cliente y colaborador.
- Directorio de clientes filtrado por pais y ordenado por ciudad.
- Rechazo en Supabase de pedidos a domicilio enviados a otro pais.
- Error ambiguo `member_user_id` en la confirmacion de personal.
- Confirmacion real de membresia y rol del empleado.
- Cola administrativa, aprobacion y verificacion real de colaboradores.
- Sesion del colaborador sin mostrar de nuevo el formulario de acceso.
- Aumento del 30 por ciento en la tarifa de domicilio.
- Impresion aislada sin la pagina completa ni espacio sobrante de la interfaz.
- Corte ESC/POS para impresora termica conectada directamente.
- Historial de tickets con busqueda, reimpresion y control de cobro.
- Menu inicial vacio: no se programan restaurantes, categorias ni platos en el codigo.

## Archivos principales modificados

- `index.html`
- `app.js`
- `styles.css`
- `cliente.html`
- `cliente.js`
- `colaborador.html`
- `colaborador.js`
- `admin.js`
- `mesero.js`
- manifiestos PWA y `service-worker.js`
- `MIGRACION-FASE1-V76-REGION-AUTORIZACIONES-IMPRESION.sql`
- `VALIDACION-V76.sql`

## Seguridad y persistencia

- La migracion no contiene `DROP TABLE` ni desactiva RLS.
- Las RPC privadas exigen usuario autenticado y validan el rol dentro de Supabase.
- La cola y aprobacion de colaboradores exigen `platform_admin` activo.
- El colaborador necesita perfil aprobado y rol activo para publicar ubicacion.
- La asignacion automatica exige ubicacion reciente, disponibilidad y el mismo pais del restaurante.
- Los restaurantes eliminados quedan inactivos y con `deleted_at` antes de eliminar Auth.
- La eliminacion definitiva requiere la Edge Function y una confirmacion de identidad.
- No hay `service_role`, `sb_secret` ni una clave privada de Google en HTML o JavaScript publico.

## Pruebas ejecutadas

Se ejecuto `qa-v76.cjs` en navegadores automatizados de escritorio y movil. Resultado: todas las afirmaciones aprobadas y cero errores JavaScript inesperados.

Comprobaciones aprobadas:

- traduccion de categoria, producto y descripcion;
- aumento del domicilio a `1.3`;
- conservacion de pais y provincia en el directorio del cliente;
- estado manual y automatico;
- control manual bloqueado en modo automatico;
- menu vacio sin categorias inventadas;
- historial y reimpresion;
- control de impresora directa e impresion aislada;
- cierre diario con desplazamiento interno;
- botones para confirmar y cancelar autorizacion;
- colaborador autenticado sin formulario duplicado;
- provincia y codigo postal del colaborador;
- pantallas Cliente, Restaurante, Colaborador, Estacion y Administracion sin desbordamiento horizontal.

Tambien se validaron la sintaxis de los seis archivos JavaScript principales, los identificadores de interfaz y la estructura estatica de la migracion.

## Limite de la validacion local

La migracion no fue ejecutada contra la base productiva desde este entorno. Debe ejecutarse en el SQL Editor de Supabase y luego correr `VALIDACION-V76.sql`. La impresion fisica y el corte deben probarse con la impresora real porque dependen del modelo, el puerto y el controlador.

## Resultado esperado en produccion

1. Ejecutar V76 en Supabase.
2. Ejecutar la validacion y comprobar cero inconsistencias.
3. Desplegar la Edge Function de eliminacion.
4. Desplegar V76 en Vercel.
5. Probar con cuentas reales de propietario, mesero, administrador, colaborador y cliente.
