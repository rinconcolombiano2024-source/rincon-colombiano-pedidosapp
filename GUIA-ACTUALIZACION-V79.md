# RC ORDERA V79 - guia de actualizacion

## Antes de desplegar

1. Conserva el ZIP original como respaldo.
2. No ejecutes SQL para V79. Esta version no incluye migracion.
3. No cambies `supabase-config.js` si la conexion actual funciona.
4. En Google Cloud confirma que la clave web permite el dominio publicado en Vercel y tiene activadas Maps JavaScript API y Places API.

## Despliegue en Vercel

1. Sube el contenido completo de la carpeta V79 al mismo repositorio.
2. Conserva la raiz del proyecto donde estan `index.html`, `cliente.html` y `colaborador.html`.
3. Publica el nuevo commit o realiza el despliegue desde Vercel.
4. Abre la URL publicada con `?app=v79`.
5. En dispositivos instalados, cierra y vuelve a abrir la PWA. Si todavia aparece V76, elimina la instalacion anterior y vuelve a instalarla.

## Orden de prueba

1. Abre `index.html?app=v79` y comprueba los tres accesos.
2. Registra o edita un restaurante con pais, region, localidad, direccion y codigo postal.
3. Abre Cliente y confirma que el restaurante aparece en el pais y region correctos.
4. Prueba una localidad grande y una pequena en Colombia o Polonia.
5. Registra un Colaborador y revisa que el pais se guarde como nombre legible y el codigo como `PL` o `CO`.
6. Cambia el idioma del Colaborador a polaco e ingles.
7. Revisa la solicitud en Administracion y realiza la aprobacion con una cuenta de prueba.

## Restauracion

Si necesitas regresar, vuelve a desplegar el ZIP original. Como V79 no cambia la base de datos, no requiere rollback SQL.

