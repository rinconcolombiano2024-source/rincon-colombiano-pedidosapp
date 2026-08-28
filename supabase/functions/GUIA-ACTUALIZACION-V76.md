# RC ORDERA V76 - guia de actualizacion

V76 es incremental e idempotente. No borra tablas, usuarios, restaurantes, pedidos, menus, documentos ni configuraciones existentes.

## Orden obligatorio

1. Conserva el respaldo `RESPALDO-RC-ORDERA-V75-ANTES-V76-2026-08-09.zip`.
2. En Supabase abre **SQL Editor** y pulsa **New query**.
3. Copia completo `MIGRACION-FASE1-V76-REGION-AUTORIZACIONES-IMPRESION.sql`.
4. Pulsa **Run** y espera el mensaje `Success`.
5. Abre otra consulta y ejecuta `VALIDACION-V76.sql`.
6. Despliega nuevamente la Edge Function `delete-own-restaurant-account`.
7. Despliega los archivos de RC ORDERA V76 en Vercel.
8. En cada dispositivo abre la app publicada y pulsa **Actualizar**. Si conserva una version anterior, cierre la PWA y vuelvala a abrir.

No ejecute V76 parcialmente. Si la consulta se interrumpe, la transaccion hace rollback y puede ejecutar el archivo completo otra vez.

## Supabase correcto

En `supabase-config.js` la URL debe terminar en `.supabase.co`, sin `/rest/v1/`. La clave debe ser la `publishable` o `anon`; nunca use `secret` ni `service_role` en el navegador.

La Edge Function usa los secretos internos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` que Supabase entrega en su entorno. Esa clave no se copia a Vercel ni al JavaScript publico.

Para que la eliminacion sea definitiva, despliegue desde una terminal vinculada al proyecto:

```powershell
supabase functions deploy delete-own-restaurant-account --project-ref ouulrehcgmfbettseibn
```

## Estado abierto o cerrado

El restaurante puede trabajar en dos modos:

- **Manual:** el cajero usa **Abrir atencion** o **Cerrar atencion**.
- **Automatico:** Supabase calcula el estado con el horario y la zona horaria del restaurante.

Para el modo automatico, complete primero horario, pais, ciudad, provincia, direccion y zona horaria. El cliente recibe los cambios mediante Realtime y la creacion del pedido vuelve a comprobar el estado en Supabase.

## Region y ubicacion

Cliente, restaurante y colaborador guardan pais, ciudad, provincia, codigo postal y coordenadas cuando el dispositivo y el permiso lo permiten. El cliente consulta restaurantes de su pais; los de la misma ciudad aparecen primero. Supabase rechaza pedidos a domicilio si el pais del destino no coincide con el restaurante.

Si el usuario niega el permiso GPS, puede escribir la direccion manualmente. No se borra una direccion valida cuando falla Google Maps.

## Autorizar personal y meseros

1. El propietario abre **Estaciones**.
2. Escribe el correo real del empleado y selecciona la estacion.
3. Pulsa **Autorizar personal**.
4. Si la cuenta ya existe, queda activa inmediatamente.
5. Si todavia no existe, queda pendiente. El empleado crea su cuenta con ese correo desde el enlace de estacion.
6. El propietario pulsa **Confirmar autorizacion**.

No se envia correo automaticamente. La aplicacion genera un enlace para compartir. V76 elimina la ambiguedad de `member_user_id` y solo confirma cuando existen una membresia y un rol activos para el restaurante correcto.

## Aprobar colaboradores de entrega

El administrador entra a `admin.html`, revisa los documentos y pulsa **Aprobar para trabajar**. La operacion correcta deja:

- `courier_profiles.status = approved`
- `user_roles.status = active` para `platform_courier`

V76 incluye la cola administrativa completa, la aprobacion atomica y una lectura de confirmacion. Un colaborador no aprobado no puede publicar ubicacion ni recibir entregas.

## Domicilio

La tarifa calculada para el cliente tiene un aumento operativo del 30 por ciento. La app conserva el desglose y guarda el precio del domicilio dentro del pedido confirmado.

## Tickets y corte

La impresion del sistema usa un documento aislado del ancho configurado; esto evita imprimir la pagina completa y reduce el papel en blanco. El ancho se puede cambiar y no esta limitado a 80 mm.

Para corte automatico directo:

1. Use Chrome o Edge desde la direccion HTTPS de Vercel.
2. Conecte la impresora por USB o serial.
3. Pulse **Conectar impresora** una vez.
4. RC ORDERA enviara el comando ESC/POS de corte despues de cada ticket.

En iPhone, iPad o navegadores sin Web Serial, el corte depende del controlador o de la aplicacion del fabricante. Active **Cut after job** o **Cortar despues de cada trabajo** en la configuracion de la impresora.

El boton **Historial** permite buscar, abrir, reimprimir y marcar tickets como cobrados o por cobrar.

## Resultado esperado

- Las pruebas de horario muestran `passed = true`.
- Los tres permisos `anon_can_*` muestran `false`.
- Las consultas de inconsistencias de personal y colaboradores devuelven cero filas.
- Los restaurantes eliminados no aparecen en el directorio.
- La app de cliente muestra solamente restaurantes reales cargados desde Supabase.
