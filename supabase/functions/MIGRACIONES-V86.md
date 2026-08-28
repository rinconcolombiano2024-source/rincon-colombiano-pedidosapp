# RC ORDERA V86.1 - Migraciones

Estas migraciones son incrementales, idempotentes y no contienen `DROP TABLE`, `TRUNCATE` ni desactivacion de RLS. Requieren que la base actual ya tenga aplicadas las migraciones V85.01, V85.02 y V85.03.

## Orden obligatorio

Ejecuta cada archivo por separado en Supabase, en **SQL Editor > New query > Run**. No pegues los ocho archivos en una sola consulta.

1. `MIGRACION-V86-01-INTEGRIDAD-PEDIDOS.sql`
   Evita tickets repetidos, acepta pedidos de manera atomica y entrega la fecha operativa del restaurante.
2. `MIGRACION-V86-02-PAGOS-SEGUROS-Y-LIQUIDACION.sql`
   Fija las comisiones en 5% para restaurante y 0,1% para colaborador, valida pagos y crea una cola durable de liquidaciones.
3. `MIGRACION-V86-03-CATALOGO-PUBLICO-SEGURO.sql`
   Publica solo los datos necesarios del restaurante/menu y habilita su sincronizacion segura.
4. `MIGRACION-V86-04-TRADUCCIONES-SEGURAS.sql`
   Crea cache y limite de uso para traducciones del menu sin exponer la clave privada.
5. `MIGRACION-V86-05-COTIZACION-Y-VALIDACION-PEDIDOS.sql`
   Guarda cotizaciones firmadas del domicilio y recalcula en servidor productos, precios, moneda y total.
6. `MIGRACION-V86-06-ELIMINACION-ATOMICA-RESTAURANTE.sql`
   Retira el restaurante del directorio y revoca sus accesos conservando pedidos/pagos historicos y otros roles del mismo correo.
7. `MIGRACION-V86-07-ARCHIVOS-COLABORADORES-SEGUROS.sql`
   Protege documentos en un bucket privado y limita formatos/tamano/rutas.
8. `MIGRACION-V86-08-AUTORIZACION-ESTACIONES-ESTABLE.sql`
   Consolida invitacion, confirmacion y activacion real de meseros y estaciones.

Cada archivo termina con `notify pgrst, 'reload schema';`. Si un archivo falla, su transaccion se revierte completa y debes detenerte antes de ejecutar el siguiente.

## Comprobacion

Al terminar, abre `VALIDACION-V86.sql` en una consulta nueva y ejecutalo. Los listados titulados “debe devolver cero filas” deben quedar vacios. En permisos, `anon_can_*` debe ser `false` y `authenticated_can_*` debe ser `true`.

No ejecutes migraciones antiguas nuevamente si el proyecto productivo ya las tiene. No cambies manualmente contrasenas, usuarios, IDs ni roles para resolver un error de migracion.
