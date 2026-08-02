# RC ORDERA V73 - validacion de sesiones y personal

## Errores corregidos

- Cerrar sesion dejaba al usuario dentro de la misma pantalla.
- El perfil del cliente podia seguir mostrando los botones de acceso durante una sesion activa.
- El restaurante no podia autorizar un correo si la cuenta del empleado aun no existia.
- Las pulsaciones repetidas podian enviar mas de una solicitud de revocacion.
- La PWA podia conservar archivos de la version V72.

## Cambios

- Cliente, Restaurante, Colaborador y Estacion regresan al inicio al cerrar sesion.
- El estado autenticado del cliente se aplica inmediatamente despues de iniciar sesion.
- Se fuerza el comportamiento visual de los controles con atributo `hidden`.
- Se agregan invitaciones pendientes de personal sin crear cuentas Auth duplicadas.
- La estacion reclama automaticamente una invitacion vinculada al correo autenticado.
- El propietario puede cancelar invitaciones y activar o desactivar membresias.
- Las acciones de revocacion solicitan confirmacion y bloquean pulsaciones dobles.
- Manifest y service worker quedan identificados como V73.

## Seguridad

- Solo el propietario autenticado del restaurante puede crear o listar invitaciones de su restaurante.
- La invitacion solo puede ser reclamada por una cuenta cuyo correo coincide exactamente.
- La membresia se vincula mediante UUID de Supabase Auth, no solo por correo.
- No se incluye `service_role` ni una contrasena en el navegador.
- La migracion no contiene `DROP TABLE` ni elimina pedidos, restaurantes o usuarios.

## Validaciones locales realizadas

- Sintaxis de todos los archivos JavaScript: correcta.
- JSON de los cuatro manifest y `vercel.json`: correcto.
- Identificadores HTML duplicados: ninguno.
- Selectores de cada JavaScript presentes en su pantalla: correctos; `receiptPrintStyle` es creado dinamicamente.
- Servidor local: `cliente.html?app=v73` responde HTTP 200.
- Enlace de regreso a la pantalla principal presente en el perfil del cliente.

## Validacion pendiente en Supabase

La escritura real de invitaciones, la reclamacion desde otro telefono y la aplicacion de RLS solo pueden declararse verificadas despues de ejecutar V73 en el proyecto Supabase y probar con las cuentas reales de propietario y empleado.

