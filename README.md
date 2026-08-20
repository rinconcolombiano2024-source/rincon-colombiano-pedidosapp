# RC ORDERA V85

RC ORDERA es una plataforma multi-restaurante para clientes, restaurantes,
personal, estaciones de preparacion, colaboradores de entrega y administracion.
La misma aplicacion soporta Polonia y Colombia con configuracion separada por
restaurante.

## Modulos

- `index.html`: restaurante, caja, pedidos, menu, personal, estaciones y cierres.
- `cliente.html`: restaurantes, menu, carrito, seguimiento y pagos.
- `mesero.html`: toma de pedidos, estaciones, jornada y cierres del mesero.
- `colaborador.html`: disponibilidad, ofertas, entregas, ubicacion y ganancias.
- `admin.html`: administracion protegida de la plataforma.
- Supabase: autenticacion, RLS, Realtime, RPC, Storage y Edge Functions.
- PWA: instalacion web y funcionamiento con conexion inestable.
- Android: proyecto preparado para Capacitor 8 mediante `package.json`.

## V85

- Protege un menu valido frente a sobrescrituras vacias y crea respaldos.
- Agrega estaciones: cocina, parrilla, bebidas, comidas rapidas, entradas,
  ensaladas, empaque, despacho, caja, mesero y administracion.
- Agrega registro de jornada y reportes semanales/mensuales de personal.
- Agrega cierres internos diarios, mensuales y anuales del restaurante.
- Agrega cierre diario y mensual del mesero sin borrar el historial contable.
- Prepara pagos reales en Polonia con Stripe Connect: 5% al restaurante y 0.1%
  al colaborador. Los fondos se liberan solamente bajo las reglas documentadas.
- Mantiene Colombia desactivada para pagos divididos hasta contratar un proveedor
  que autorice legal y tecnicamente el reparto de fondos requerido.

## Inicio seguro

1. Conserva una copia del proyecto y de la base de datos.
2. Ejecuta las migraciones indicadas en `MIGRACIONES-V85.md`.
3. Ejecuta `VALIDACION-V85.sql` y confirma que no produce excepciones.
4. Configura y despliega las Edge Functions de pagos.
5. Ejecuta `npm run qa`.
6. Despliega los archivos publicos en Vercel.
7. Completa las pruebas reales de `REPORTE-VALIDACION-V85.md`.

No habilites pagos reales solo por haber desplegado el codigo. Antes se requieren
credenciales live, webhook firmado, cuentas Connect verificadas, conciliacion,
pruebas de reembolso y aprobacion operativa/legal.

Documentos principales:

- `AUDITORIA-V85-PREPRODUCCION.md`
- `MIGRACIONES-V85.md`
- `GUIA-DESPLIEGUE-V85.md`
- `PAGOS-MARKETPLACE-V85.md`
- `ANDROID-V85.md`
- `REPORTE-VALIDACION-V85.md`
- `ROLLBACK-V85.md`
