# Actualizacion RC ORDERA V79 corregida

## Orden obligatorio

1. Conserva una copia del despliegue actual de V79.
2. En Supabase abre **SQL Editor** y crea una consulta nueva.
3. Copia todo el contenido de `MIGRACION-FASE1-V80-CORRECCION-FINAL-V79.sql`.
4. Ejecuta la consulta una sola vez y confirma que finalice sin error.
5. En otra consulta ejecuta `VALIDACION-V80.sql`. Este archivo es de solo lectura.
6. Despliega en Vercel el contenido completo de la carpeta del proyecto incluida en el ZIP.
7. Abre Colaborador, actualiza la aplicacion y prueba registro, localidad, documentos y estado.
8. Abre Administrador y prueba cola, ubicacion, aprobar y rechazar.
9. Prueba un pedido real desde Mesero para confirmar la funcion corregida.

## Resultado esperado en Supabase

- `get_courier_review_queue()` aparece en Database > Functions.
- Su resultado incluye `country_code`, `region` y `postal_code` al final.
- `anon_puede_ver_cola` devuelve `false`.
- `autenticado_puede_invocar_cola` devuelve `true`; la funcion internamente solo entrega datos al `platform_admin` activo.
- El bucket `courier-documents` muestra `public = false`.
- Un colaborador aprobado tiene `profile_status = approved` y `role_status = active`.
- `conflicto_mesero_corregido` devuelve `true`.

## Prueba de Google Places

- En Google Cloud debe estar activa **Places API** para la clave web existente.
- La clave debe aceptar el dominio publicado de RC ORDERA.
- Selecciona primero pais y region; despues escribe la localidad.
- Si Places no carga, el campo sigue aceptando texto manual y el registro no se bloquea.

No pegues una `service_role` ni una clave privada en ningun archivo del frontend.
