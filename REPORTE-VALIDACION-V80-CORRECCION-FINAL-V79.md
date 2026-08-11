# RC ORDERA V79 - Correccion final limitada

## Resultado

La correccion se realizo sobre una copia separada de RC ORDERA V79. No se reconstruyeron modulos y no se modificaron Cliente, Restaurante, Mesero, PWA, Service Worker, configuracion de Supabase ni el esquema base historico.

## Hallazgos y correcciones

1. Colaborador conservaba pais, region y localidad manual, pero no inicializaba Google Places. Se agrego Places al campo `courierCityInput`, restringido a CO o PL y validado contra la region seleccionada. Sigue siendo posible escribir manualmente cuando no hay clave, conexion o respuesta de Maps.
2. `get_courier_review_queue()` conservaba 25 columnas pero no devolvia `country_code`, `region` ni `postal_code`. La nueva migracion conserva las 25 columnas previas y anexa esas tres.
3. El bucket real ya era `courier-documents`, privado, con rutas iniciadas por el UUID del colaborador y politicas RLS compatibles. No se creo ni modifico ningun bucket o politica.
4. `review_courier_profile()` ya confirma en Supabase `courier_profiles.status = approved` y `user_roles.status = active`. No se reconstruyo. La interfaz ahora muestra `Verificado / Aprobado`, `Zweryfikowany / Zatwierdzony` o `Verified / Approved` segun el idioma.
5. `submit_waiter_order()` historico usaba el conflicto ambiguo. La migracion nueva reproduce exactamente su firma y cuerpo y cambia unicamente a `ON CONFLICT ON CONSTRAINT customer_orders_pkey DO NOTHING`.

## Archivos modificados

- `colaborador.js`: Places, interpretacion de localidades y etiqueta de aprobacion.
- `auto-translate.js`: traducciones nuevas ES/PL/EN.
- `qa-v79-location-i18n.cjs`: expectativa actualizada para la etiqueta aprobada.
- `qa-v79-colaborador-idiomas.png`: evidencia visual renovada.

## Archivos nuevos

- `MIGRACION-FASE1-V80-CORRECCION-FINAL-V79.sql`
- `VALIDACION-V80.sql`
- `qa-v80-correccion-final-v79.cjs`
- `REPORTE-VALIDACION-V80-CORRECCION-FINAL-V79.md`
- `GUIA-ACTUALIZACION-V80.md`

## Migracion nueva

La unica migracion nueva es `MIGRACION-FASE1-V80-CORRECCION-FINAL-V79.sql`.

- Es incremental e idempotente.
- No ejecuta `DROP TABLE`.
- No elimina ni actualiza datos.
- No desactiva RLS.
- Reemplaza transaccionalmente solo `get_courier_review_queue()` porque PostgreSQL no permite ampliar columnas OUT mediante `CREATE OR REPLACE`.
- Recrea `submit_waiter_order()` con el conflicto corregido.
- Revoca acceso de `public` y `anon`; concede ejecucion a `authenticated`.
- Conserva la comprobacion real de `platform_admin` dentro de la cola.
- Finaliza con `notify pgrst, 'reload schema';`.

## Verificacion realizada

### Verificado estaticamente

- Sintaxis de todos los archivos JS/CJS: correcta.
- Funciones duplicadas en los JS revisados: ninguna.
- IDs usados por Colaborador: todos existen.
- Contrato de 25 columnas previo de la cola: conservado; se anexan tres columnas.
- `submit_waiter_order`: cuerpo identico al anterior salvo la linea `ON CONFLICT`.
- Bucket, rutas y politicas existentes: compatibles y privados.
- No hay `service_role` ni claves secretas en el frontend.
- 21 migraciones historicas: SHA-256 identico al V79 de origen.
- Cliente, Restaurante, Mesero, PWA, configuracion y `supabase-schema.sql`: SHA-256 identico.

### Verificado con navegador local

- Bateria V79: 34/34 comprobaciones aprobadas.
- Bateria de correccion: 25/25 comprobaciones aprobadas.
- Localidad rural `Playa Rica`: interpretada mediante `sublocality_level_1`.
- Fallback `administrative_area_level_3`: comprobado.
- Restriccion de Places a Colombia: comprobada con API simulada.
- Rechazo de una localidad perteneciente a otra region: comprobado.
- Pais legible, codigo, region, localidad, postal, coordenadas y zona horaria: comprobados en el payload.
- Etiqueta aprobada ES/PL/EN: comprobada.
- Ubicacion completa en Administrador: comprobada.
- Sin errores de pagina ni desbordamiento a 390 px.

### Requiere prueba real contra Supabase/Google

- Ejecutar la migracion V80 en el proyecto real.
- Invocar la cola con un administrador real y confirmar denegacion con un usuario normal y anonimo.
- Aprobar/rechazar un colaborador real y confirmar estados de perfil y rol.
- Abrir documentos reales mediante URL firmada.
- Enviar un pedido real desde Mesero.
- Probar Google Places real con la clave web habilitada, restringida al dominio de Vercel y con Places API activa.

No se afirma que estas operaciones remotas hayan sido ejecutadas: las credenciales administrativas y una base PostgreSQL local no estaban disponibles durante esta revision.

## Google Maps

Colaborador reutiliza la clave web existente guardada en `rincon_colombiano_google_maps_api_key`. Tambien admite una clave web suministrada por `window.RINCON_GOOGLE_MAPS_API_KEY` o `window.RINCON_SUPABASE.googleMapsApiKey`, sin modificar `supabase-config.js`. Si ninguna fuente esta disponible, el registro continua manualmente y no se bloquea.

La clave web debe restringirse en Google Cloud a los dominios autorizados y solo a las API necesarias. No se incluyo ninguna clave privada nueva en el ZIP.

## Confirmacion de integridad

Ninguna migracion historica fue modificada. No se borraron tablas, usuarios, roles, restaurantes, colaboradores, pedidos, menus ni documentos.
