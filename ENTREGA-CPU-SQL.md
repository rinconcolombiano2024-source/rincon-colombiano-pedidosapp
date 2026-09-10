# Entrega CPU/SQL — protección contra ejecuciones simultáneas

Fecha: 2026-09-10.

Base: carpeta de trabajo del ZIP entregado RC-ORDERA-CONTINUACION-SYNC-CPU.zip.
No se modificó el ZIP aportado por el usuario ni se sustituyeron archivos del frontend.

## Cambio realizado

La cola ya usa SKIP LOCKED para no tomar las mismas filas, pero eso permite que
dos ejecuciones recorran la cola y procesen lotes diferentes al mismo tiempo.
Se añadió pg_try_advisory_xact_lock(9104, 8301) antes de la primera consulta:
si otra transacción tiene esa protección, la llamada devuelve 0 sin recorrer
customer_orders ni actualizar asignaciones.

No se cambió la consulta, el máximo de 20, la ventana de 24 horas, los estados,
el reintento de 2 minutos, las auditorías de error ni SKIP LOCKED.
El bloqueo se libera al terminar la transacción; no espera si ya está ocupado.
Semántica documentada en [PostgreSQL](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS).

Es una protección frente a solapamientos, NO un límite de llamadas por minuto.
No evita llamadas secuenciales, llamadas directas a offer_next_courier,
ni otras consultas costosas. Una transacción larga retiene la protección;
los trabajos deben ejecutarse en transacciones cortas. No se debe reutilizar
la clave (9104, 8301) para otra operación.

## Archivos y líneas

| Archivo | Líneas | Cambio |
| --- | --- | --- |
| MIGRACION-V91-04-CONTROL-CARGA-SINCRONIZACION.sql | 15–19 (20 en blanco) | Única modificación de un archivo existente: protección antes del cursor. El resto del archivo se conserva. |
| PATCH-CPU-DISPATCH-SINGLEFLIGHT.sql | 1–119, nuevo | Instalación transaccional; comprobación de definición en 9–33; protección en 45–49. No ejecuta cron ni cambia permisos. |
| tests/sql-dispatch-singleflight.test.cjs | Archivo nuevo completo | Cuatro pruebas estructurales de equivalencia, alcance y comprobación previa. |
| ENTREGA-CPU-SQL.md | Archivo nuevo completo | Instrucciones, alcance y resultados de esta entrega. |

## Pruebas ejecutadas localmente

- npm run qa: aprobado antes y después del cambio.
- i18n: 2062 comprobaciones aprobadas.
- node --check app.js: aprobado.
- node --test tests/sql-dispatch-singleflight.test.cjs tests/recovery-load.test.cjs tests/timeout-cancellation.test.cjs:
  15 aprobadas, 0 fallidas, 0 omitidas.

La prueba SQL compara el cuerpo previo mediante huella y comprueba que quitar
la protección recupera exactamente la lógica anterior normalizada.
Estas son pruebas estructurales, NO ejecución real del SQL en PostgreSQL.
No se ejecutaron pruebas E2E, integración Supabase ni EXPLAIN (ANALYZE, BUFFERS).
No había conexión disponible a la base para medir la carga real.

## Aplicación en Supabase

Subir el ZIP a GitHub NO instala este cambio en la base de datos.

1. Guardar la definición instalada mediante esta consulta de solo lectura:

```sql
select pg_get_functiondef(
  'public.rc_ordera_process_delivery_queue(integer)'::regprocedure
);
```

2. Probar primero en una base de pruebas con la misma definición.
3. Ejecutar SOLO PATCH-CPU-DISPATCH-SINGLEFLIGHT.sql completo, como propietario
   de la función (por ejemplo postgres), fuera de otras transacciones.
   No ejecutar todas las migraciones ni la V91-04 completa: esa migración
   histórica contiene ajustes de cron que NO forman parte de este parche.
4. Si aparece “la cola instalada difiere”, detenerse. El parche no se aplicó:
   no quitar esa validación ni reemplazar a ciegas la función instalada.
   Comparar primero la definición guardada.
5. Comprobar que la definición contiene la protección, que se siguen asignando
   los pedidos elegibles y medir CPU/llamadas en un intervalo comparable.
   No reactivar cron si estaba desactivado.
6. Si hace falta revertir, restaurar únicamente la definición guardada en el paso 1,
   no toda una migración antigua.

El parche no activa ni reprograma cron, no crea índices, no modifica permisos/RLS,
no borra pedidos y no ejecuta la cola durante la instalación. Conserva propietario
y permisos existentes al usar CREATE OR REPLACE.

## Resultado y límite

La protección queda preparada en el proyecto. Falta aplicarla y comprobarla
en Supabase; no se certifica que resuelva la CPU al 99–100% ni se promete un
porcentaje de reducción sin mediciones. No se tocó frontend, carrito, horarios,
roles, GPS, impresión ni los cambios anteriores de sincronización.
