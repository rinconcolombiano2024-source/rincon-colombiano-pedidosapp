# RC ORDERA V84.1 - auditoria y validacion

## Arquitectura revisada

V84 sigue siendo una PWA estatica con cinco entradas que comparten Supabase:

- index.html y app.js: restaurante/caja.
- cliente.html y cliente.js: cliente e invitado.
- colaborador.html y colaborador.js: colaborador de plataforma.
- mesero.html y mesero.js: estacion autorizada.
- admin.html y admin.js: administracion protegida.

Las sesiones usan claves separadas:

- restaurante: rc-ordera-restaurant-auth
- cliente: rc-ordera-customer-auth
- colaborador: rc-ordera-courier-auth
- mesero: rc-ordera-waiter-auth
- administracion: rc_ordera_platform_admin_auth

## Errores encontrados

1. El cierre del restaurante no limpiaba todos los datos operativos locales.
2. Al reanudar colaborador se podian reiniciar canales equivalentes.
3. Los enlaces Push no siempre identificaban la asignacion exacta.
4. courier-push no revalidaba la oferta real antes de enviar.
5. delivery-dispatch aceptaba cualquier secreto no vacio.
6. Cliente y restaurante no tenian seguimiento completo y restringido.
7. El frontend llamaba get_my_courier_delivery_history(), pero no existia en el SQL entregado.
8. Faltaba una proteccion final de asignacion activa unica por pedido.
9. Dos manifiestos y varios enlaces todavia apuntaban a V84.
10. La configuracion Edge no declaraba el modo JWT de Push/despacho.
11. Supabase, cron, Push y concurrencia real no pueden validarse solo localmente.

## Correcciones aplicadas

- Sincronizacion obligatoria antes de cerrar restaurante y limpieza posterior.
- Guardias idempotentes para Realtime, polling, GPS y alarma.
- Disponibilidad separada de GPS y estados de entrega.
- Validacion de destinatario, estado y vencimiento antes de Push.
- Secreto de despacho minimo de 24 caracteres.
- Seguimiento autorizado para cliente y restaurante.
- Historial propio del colaborador.
- Indice parcial de una asignacion activa por pedido.
- Preflight que se detiene ante duplicados sin corregirlos ni borrarlos.
- Politica RLS de ubicacion para participantes activos.
- URLs, manifiestos y service worker V84.1.
- Preflight y post-verificacion reproducibles.

## Resultado local

Aprobado:

- Sintaxis de app.js, cliente.js, colaborador.js, mesero.js y service-worker.js.
- Sintaxis de las tres Edge Functions TypeScript incluidas.
- JSON de cuatro manifiestos y vercel.json.
- 46 RPC llamados por el frontend con definicion SQL incluida.
- Sin DROP TABLE ni desactivacion RLS en V84.1.
- Sin service_role ni VAPID privada incrustadas en los cinco frontends.
- Una recarga del esquema PostgREST en la migracion.
- Cache y rutas V84.1.
- Alarma con un solo temporizador.
- Canales de aprobacion, entrega y seguimiento con guardias.
- Inicio, cliente, colaborador y mesero en 390x844.
- Restaurante en 1024x768.
- Administracion en 1440x900.
- Sin errores JavaScript de pagina, IDs duplicados, pantallas vacias o desbordamiento horizontal.

La primera ejecucion de QA detecto correctamente el RPC de historial ausente. Tras agregarlo a V84.1, la segunda termino con RC ORDERA V84.1 QA LOCAL: OK.

## No validado localmente

Requiere el Supabase/Vercel reales:

- Aplicacion y rollback transaccional real de PostgreSQL.
- RLS con cliente A/B, restaurante A/B, colaborador A/B y admin.
- Aceptacion simultanea desde dos colaboradores.
- Database Webhook y Push Web real.
- Vencimiento/reasignacion con pg_cron o scheduler.
- GPS real con pantalla bloqueada.
- Eliminacion de cuenta/restaurante con datos reales.
- Correo de recuperacion mediante SMTP real.
- Storage privado con documentos reales.
- Pagos online, que permanecen desactivados.

## Seguridad

- El navegador no contiene service_role.
- Edge recibe secrets desde su entorno.
- El invitado necesita el token secreto del pedido.
- Un cliente autenticado no consulta con su sesion pedidos ajenos.
- Restaurante requiere propiedad, admin de plataforma o membresia con permiso.
- Colaborador modifica disponibilidad/ubicacion mediante RPC propio.
- Historial usa auth.uid() y devuelve entregas propias.
- Ubicacion deja de exponerse al terminar/cancelar.
- La base protege una asignacion activa por pedido.

## Riesgos pendientes

- Rotar cualquier clave privada mostrada antes en capturas o conversaciones.
- Confirmar un solo proceso de despacho: pg_cron o scheduler externo.
- Push depende de permisos y limites del sistema operativo.
- La PWA conserva disponibilidad, pero no es un servicio GPS nativo permanente.
- Contratos de V84 sin interfaz completa no deben anunciarse como terminados.

## Conclusion

V84.1 queda como candidata para despliegue controlado. El codigo local y los contratos estaticos pasan. La declaracion final de produccion depende de preflight, migracion, post-verificacion y recorrido critico en los servicios reales.

