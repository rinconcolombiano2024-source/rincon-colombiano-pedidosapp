# RC ORDERA V74 - estabilizacion de aprobaciones, ubicacion y eliminacion

V74 es incremental. No elimina tablas, usuarios, restaurantes, menus, pedidos ni archivos durante la migracion.

## Orden obligatorio

1. Confirma que ya ejecutaste V72 y las dos migraciones V73.
2. En Supabase abre SQL Editor y pulsa New query.
3. Copia completo MIGRACION-FASE1-V74-ESTABILIZACION-APROBACIONES-UBICACION-ELIMINACION.sql.
4. Pulsa Run. El resultado esperado es Success. No rows returned.
5. Opcionalmente ejecuta las consultas de solo lectura de VALIDACION-V74.sql.
6. Vuelve a desplegar la Edge Function delete-own-restaurant-account con el archivo actualizado.
7. Despliega despues los archivos V74 en Vercel.
8. Abre la app con internet, pulsa Actualizar y cierrala/abrela una vez para renovar la PWA.

No se usa Codespace para ejecutar esta migracion.

## Prueba de colaborador

1. El colaborador guarda su perfil y documentos.
2. En /admin.html, el administrador pulsa Aprobar.
3. El panel solo confirma el exito despues de volver a leer el estado desde Supabase.
4. El colaborador abre su perfil o espera la actualizacion Realtime.
5. Debe mostrar Aprobado y permitir disponibilidad.

Un colaborador no puede cambiar por si mismo status, reviewed_at ni reviewed_by_user_id.

## Prueba de personal y estaciones

1. El propietario abre Estaciones.
2. Escribe el correo, nombre y estacion, y pulsa Autorizar personal.
3. El empleado crea/confirma su cuenta con exactamente ese correo.
4. El propietario pulsa Confirmar autorizacion.
5. La tarjeta debe cambiar de Invitacion pendiente a Activo.
6. El empleado abre el enlace y pulsa Activar autorizacion.

La estacion solo abre cuando Supabase confirma rol, membresia y estacion activa.

## Prueba de eliminacion

1. El propietario abre la eliminacion del restaurante.
2. Confirma contrasena y escribe ELIMINAR.
3. V74 retira primero el restaurante del directorio publico.
4. La Edge Function elimina despues la cuenta de acceso y sus relaciones.
5. En Cliente pulsa actualizar o espera la sincronizacion. El restaurante no debe reaparecer.

Si la Edge Function no esta desplegada, el restaurante queda oculto de clientes, pero la app informa que falta terminar la eliminacion de la cuenta.

## Ubicacion e idioma

- Cliente, restaurante y colaborador solicitan ubicacion durante el registro sin bloquear el proceso si se rechaza.
- Polonia se guarda con PL y Europe/Warsaw; Colombia con CO y America/Bogota.
- El idioma inicial usa el navegador y puede cambiarse manualmente.
- El cliente traduce categorias, nombres y descripciones del menu al idioma elegido. Conserva en pedidos los nombres y precios originales.

La traduccion nueva necesita internet la primera vez; luego queda en cache local. Si no hay traduccion disponible, se muestra el texto original.

