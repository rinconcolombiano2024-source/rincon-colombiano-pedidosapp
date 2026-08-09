# RC ORDERA V75 - reporte de validacion

## Problemas encontrados

1. El estado abierto/cerrado solo podía controlarse dentro de **Editar menu**.
2. El horario semanal se guardaba, pero no gobernaba realmente la recepción de pedidos.
3. La función antigua de pedidos comprobaba únicamente el interruptor almacenado. Podía rechazar una apertura automática si la app del restaurante no estaba abierta para actualizar ese valor.
4. La migración V73 conservaba un `ORDER BY pending` ambiguo dentro de una unión.
5. Administración confirmaba al colaborador recargando la cola, pero no consultaba de forma independiente la concordancia entre perfil y rol.

## Cambios realizados

- Estado operativo visible en la pantalla principal.
- Control manual de apertura y cierre.
- Modo automático por horario y zona horaria.
- Soporte para horarios que cruzan medianoche.
- Cálculo en vivo en directorio y menú del cliente.
- Comprobación de horario antes de crear cada pedido y mediante trigger de defensa adicional.
- Sincronización periódica del estado almacenado mientras el panel del restaurante está abierto.
- Consulta de estaciones corregida mediante CTE y alias explícitos.
- Nueva RPC administrativa `get_courier_review_result(uuid)`.
- Confirmación administrativa de perfil y rol después de aprobar o rechazar.
- Caché PWA actualizado a V75.

## Archivos principales modificados

- `index.html`
- `styles.css`
- `app.js`
- `cliente.js`
- `admin.js`
- `service-worker.js`
- Manifiestos PWA

## Archivos nuevos

- `MIGRACION-FASE1-V75-ESTADO-HORARIO-AUTORIZACIONES.sql`
- `VALIDACION-V75.sql`
- `GUIA-ACTUALIZACION-V75.md`
- `REPORTE-VALIDACION-V75-ESTADO-AUTORIZACIONES.md`
- `qa-v75.cjs`

## Seguridad

- No se usó `service_role` en el frontend.
- No se desactivó RLS.
- No se eliminaron tablas, usuarios, pedidos, menús ni documentos.
- Las funciones privadas requieren sesión `authenticated` y validan el propietario o `platform_admin` dentro de Supabase.
- El usuario anónimo no puede cambiar el modo operativo ni consultar la verificación administrativa.
- Los pedidos nuevos se rechazan en base de datos cuando el restaurante está cerrado.

## Pruebas ejecutadas localmente

- Sintaxis de los seis archivos JavaScript principales: correcta.
- Playwright: 28 comprobaciones aprobadas.
- Cliente móvil: sin desbordamiento horizontal.
- Restaurante móvil: barra de estado, modo automático y cierres desplazables.
- Restaurante escritorio: estado principal visible y sin desbordamiento.
- Estaciones: botones de confirmar y cancelar visibles en móvil y escritorio.
- Colaborador y administración: controles principales cargan en móvil.
- Traducción de categoría, producto y descripción al polaco: correcta.
- Errores JavaScript inesperados durante las pruebas: cero.

## Validacion pendiente en Supabase productivo

No se afirma que la migración esté aplicada en la base productiva. El propietario debe ejecutar primero la migración V75 y después `VALIDACION-V75.sql`. Finalmente debe probar con cuentas reales:

1. Activar modo automático y comprobar un horario abierto y uno cerrado.
2. Autorizar una cuenta de estación con el mismo correo exacto.
3. Aprobar un colaborador y confirmar perfil `approved` más rol `active`.
4. Enviar un pedido abierto y comprobar que un pedido cerrado sea rechazado.

