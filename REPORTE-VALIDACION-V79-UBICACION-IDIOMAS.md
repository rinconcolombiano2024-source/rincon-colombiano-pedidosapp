# RC ORDERA V79 - ubicacion e idiomas

## Alcance

V79 parte exclusivamente del ZIP entregado y conserva los archivos, IDs, RPC, migraciones y flujos existentes. La actualizacion se limita a la ubicacion uniforme de Cliente, Restaurante y Colaborador, la visualizacion administrativa disponible y la traduccion del entorno Colaborador.

## Problemas encontrados

- Cliente no registraba pais, region, localidad y codigo postal mediante campos separados.
- Colaborador tenia la localidad como un selector deshabilitado sin opciones, por lo que no aceptaba pueblos, corregimientos o veredas.
- Colaborador podia guardar `PL` o `CO` dentro de `country` en vez del nombre legible.
- Google Maps no cargaba Places en Cliente y no conservaba todas las alternativas de localidad pequena.
- La deteccion automatica podia sustituir una ubicacion elegida manualmente.
- Faltaban traducciones estaticas y dinamicas del Colaborador en polaco e ingles.
- La PWA seguia identificando la cache como V76.

## Cambios realizados

- Jerarquia uniforme: pais, region administrativa, localidad libre, direccion, codigo postal y coordenadas.
- Paises iniciales: Colombia (`CO`) y Polonia (`PL`).
- Regiones: departamentos colombianos y voivodatos polacos.
- Localidad libre: no existe una lista fija de ciudades.
- Google Places acepta `locality`, `postal_town`, `sublocality`, `administrative_area_level_2` y `administrative_area_level_3`.
- La busqueda de Places se restringe al pais seleccionado cuando existe clave web configurada.
- Se normalizan nombres como `Wojewodztwo Mazowieckie` a `Mazowieckie`.
- La seleccion manual tiene prioridad sobre la deteccion automatica.
- Se evita conservar coordenadas detectadas en un pais distinto al pais seleccionado.
- Colaborador guarda `country = Polonia/Colombia` y `country_code = PL/CO`.
- Los perfiles antiguos que tengan `country = PL/CO` siguen cargando correctamente.
- El administrador muestra la ubicacion disponible en la cola de revision.
- Se completo el diccionario visible del Colaborador en espanol, polaco e ingles.
- Se actualizo la cache y los enlaces de instalacion a V79.

## Archivos modificados

- `app.js`
- `cliente.js`
- `colaborador.js`
- `auto-translate.js`
- `admin.js`
- `cliente.html`
- `colaborador.html`
- `index.html`
- `styles.css`
- `manifest.webmanifest`
- `cliente-manifest.webmanifest`
- `colaborador-manifest.webmanifest`
- `admin-manifest.webmanifest`
- `service-worker.js`
- `mesero.js` (solo enlace de retorno V79)

## Funciones principales ajustadas

- Restaurante: `renderRestaurantRegionSuggestions`, `normalizedRestaurantRegion`, `restaurantPlaceLocality`, `applyRestaurantPlace`, `prepareRestaurantPlaceAutocomplete`, `reverseGeocodeRestaurantLocation`, `signUpWithEmail`.
- Cliente: `customerRenderRegistrationRegions`, `customerSyncRegistrationRegionFromInputs`, `customerNormalizedRegion`, `customerPlaceLocality`, `customerApplyPlace`, `customerPreparePlaceAutocomplete`, `customerReverseGeocodeLocation`, `customerSignUpWithEmail`.
- Colaborador: `courierCountryName`, `courierRenderRegionOptions`, `courierGeneralProfilePayload`, `courierProfilePayload`, `courierApplyProfileFields`, `courierProfilePayloadForMetadata`, `courierSignUp`.
- Traduccion: `dictionaryTranslation` y diccionarios `pl`/`en`.
- Administracion: `adminRenderCourierList`.

## Migracion Supabase

No se creo migracion. El esquema actual ya contiene `country`, `country_code`, `region`, `city`, `postal_code`, coordenadas y zona horaria. No se modificaron tablas, datos, RPC, funciones, triggers ni politicas RLS.

## Pruebas realizadas

- `qa-v79-location-i18n.cjs`: 34 verificaciones aprobadas.
- `qa-v76.cjs`: 36 verificaciones de regresion aprobadas.
- Total: 70 verificaciones aprobadas y cero errores JavaScript inesperados.
- Sintaxis validada en `app.js`, `cliente.js`, `colaborador.js`, `auto-translate.js`, `admin.js`, `mesero.js` y `service-worker.js`.
- Vistas comprobadas en 390 x 844 y 1280/1440 px.

Las pruebas automatizadas no escribieron datos en Supabase. La consulta real de Google Places depende de que la clave web tenga habilitadas Maps JavaScript API, Places API y las restricciones correctas. El registro, la subida real al bucket y la aprobacion administrativa deben probarse en el despliegue con cuentas de prueba autorizadas.

## Prueba manual recomendada

1. Cliente: selecciona Colombia, Tolima y escribe una localidad pequena como Playa Rica. Confirma que el perfil conserva los datos despues de cerrar y volver a entrar.
2. Restaurante: selecciona pais y region; busca una localidad o direccion con Google. Guarda y abre Cliente para confirmar que aparece en la region correcta.
3. Colaborador: selecciona pais, region y escribe la localidad. Sube documentos, envia la solicitud y confirma `pending_review`.
4. Administrador: abre la cola, revisa ubicacion y documentos, aprueba la solicitud.
5. Colaborador: actualiza o vuelve a iniciar sesion. Debe ver Aprobado/Verificado y poder activar disponibilidad.
6. Cambia el idioma del Colaborador entre Espanol, Polski y English y revisa etiquetas, estados y mensajes de error.

## Riesgos pendientes

- No se ejecuto una prueba de escritura contra la base productiva ni una aprobacion real, para no alterar datos existentes.
- Google Places requiere una clave web valida y autorizada para el dominio de Vercel.
- La cola RPC actual devuelve `country` y `city`; `admin.js` tambien puede mostrar `region` y `postal_code` si una version futura de la RPC los devuelve, sin romper la version actual.

