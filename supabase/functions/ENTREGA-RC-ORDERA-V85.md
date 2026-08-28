# Entrega RC ORDERA V85

## Estado

V85 es una candidata de preproduccion construida incrementalmente sobre V84.1.
No se modifico el ZIP original y existe una copia inmutable con su SHA-256.

## Cambios principales

- Persistencia separada de menu y ajustes, control por revision y respaldo previo.
- Vaciado de menu solo con propietario, contrasena y frase `VACIAR MENU`.
- Dashboard profesional de restaurante y adaptacion movil de los perfiles.
- Estaciones por producto y flujo cocina/parrilla/bebidas/comidas rapidas/
  entradas/ensaladas/empaque/despacho.
- Turnos de personal y horas de la semana/mes.
- Cierres operativos dia/mes/ano del restaurante y dia/mes del mesero.
- Historial del mesero filtrado por dia, sin borrar pedidos ni cierres anteriores.
- Pago marketplace para Polonia preparado con Stripe Connect.
- Comision 5% sobre venta del restaurante y 0.1% sobre domicilio del colaborador.
- Confirmacion financiera separada: restaurante confirma su parte; cliente y
  colaborador confirman la entrega del domicilio.
- Reintentos de checkout y transferencias idempotentes e independientes.
- PWA V85 y preparacion Android mediante Capacitor 8.5.0.

## Archivos V85

- `MIGRACION-V85-01-PROTEGER-MENU-Y-AJUSTES.sql`
- `MIGRACION-V85-02-ESTACIONES-TURNOS-CIERRES.sql`
- `MIGRACION-V85-03-PAGOS-MARKETPLACE.sql`
- `VALIDACION-V85.sql`
- `qa-v85.cjs`
- `supabase/functions/marketplace-*`
- `MIGRACIONES-V85.md`
- `PAGOS-MARKETPLACE-V85.md`
- `ANDROID-V85.md`
- `GUIA-DESPLIEGUE-V85.md`
- `REPORTE-VALIDACION-V85.md`
- `ROLLBACK-V85.md`

## Orden para instalar

1. Crear staging y respaldo de Supabase.
2. Ejecutar V85.01, V85.02 y V85.03 en ese orden.
3. Ejecutar `VALIDACION-V85.sql`.
4. Desplegar las seis Edge Functions de pagos.
5. Configurar secrets y webhook Stripe de prueba.
6. Desplegar V85 en Vercel staging.
7. Completar la matriz de pruebas.
8. Repetir el procedimiento controlado en produccion.

## Limites que impiden declarar lanzamiento abierto hoy

- No se ejecutaron migraciones en la base productiva desde este entorno.
- No se realizaron pagos, reembolsos, contracargos ni conciliacion live.
- Colombia requiere contrato de proveedor compatible con reparto 1:N.
- No se genero ni firmo un AAB de Google Play.
- La traduccion automatica de descripciones del menu es una ayuda de terceros con
  cache local. Antes del lanzamiento debe contratarse o configurarse un proveedor
  con SLA, privacidad y cuotas adecuadas; el diccionario de la interfaz ES/PL/EN
  no depende de esa traduccion externa.
- La prueba visual automatizada no se pudo iniciar por un fallo del conector de
  navegador de Codex; las resoluciones deben revisarse manualmente en staging.

No ocultes estos puntos. El codigo esta preparado para la validacion real, pero el
lanzamiento comercial exige completar esas pruebas y aprobaciones externas.
