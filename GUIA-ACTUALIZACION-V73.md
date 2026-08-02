# RC ORDERA V73 - sesiones y autorizacion de personal

Esta actualizacion no borra usuarios, restaurantes, menus, pedidos ni permisos existentes.

## 1. Ejecutar la migracion

1. Abre el proyecto correcto en Supabase.
2. Entra en `SQL Editor`.
3. Pulsa `New query` o `Nueva consulta`.
4. Abre el archivo `MIGRACION-FASE1-V73-AUTORIZACION-PERSONAL.sql`.
5. Copia todo su contenido en la consulta.
6. Pulsa `Run`.
7. El resultado correcto es `Success. No rows returned`.

La migracion V71 debe existir primero. La V73 es repetible y conserva las autorizaciones actuales.

## 2. Publicar los archivos

Publica en Vercel todos los archivos de esta carpeta. El cache PWA cambia a `rc-ordera-v73`, por lo que la aplicacion instalada descargara la version nueva al volver a abrirse con internet.

## 3. Probar el cierre de sesion

Repite esta prueba en Cliente, Restaurante, Colaborador y Estacion:

1. Inicia sesion.
2. Confirma que aparece el perfil o panel correcto.
3. Pulsa `Cerrar sesion`.
4. Confirma que la aplicacion regresa a la pantalla principal de RC ORDERA.
5. En Cliente, confirma que los botones `Iniciar sesion` y `Crear cuenta cliente` no aparecen dentro del perfil mientras la sesion esta activa.

## 4. Probar personal del restaurante

1. Inicia sesion como propietario del restaurante.
2. Abre `Estaciones`.
3. Escribe nombre, correo y estacion del empleado.
4. Pulsa `Autorizar personal`.
5. Si el empleado aun no tiene cuenta, debe aparecer `Invitacion pendiente`.
6. Copia el enlace del personal y abrelo en el telefono del empleado.
7. El empleado crea o confirma su cuenta con el mismo correo autorizado.
8. El propietario pulsa `Confirmar autorizacion` en la invitacion pendiente.
9. La tarjeta debe cambiar a `Activo` y mostrar la confirmacion de Supabase.
10. En el telefono, el empleado pulsa `Activar autorizacion` y entra a su estacion.
11. El propietario puede desactivar el acceso o cancelar una invitacion pendiente.

## 5. Comprobacion en la nube

En `Table Editor` pueden revisarse, sin editar manualmente:

- `restaurant_staff_invitations`: invitaciones pendientes, reclamadas o revocadas.
- `restaurant_staff_memberships`: personal ya vinculado a una estacion.
- `user_roles`: rol `restaurant_employee` activo para el restaurante correcto.

No es necesario usar Codespace para esta migracion. Se ejecuta en el SQL Editor de Supabase.
