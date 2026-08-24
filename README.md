# RC ORDERA V86.1

RC ORDERA es una plataforma multi-restaurante para clientes, restaurantes,
personal, estaciones de preparacion, colaboradores de entrega y administracion.
La misma plataforma soporta Polonia y Colombia con configuracion independiente
por restaurante, moneda, zona horaria, pais e idioma.

## Modulos

- `index.html`: restaurante, caja, pedidos, menu, personal, estaciones y cierres.
- `cliente.html`: restaurantes, menu, carrito, seguimiento y pagos.
- `mesero.html`: toma de pedidos, estaciones, jornada y cierres del mesero.
- `colaborador.html`: disponibilidad, ofertas, entregas, ubicacion y ganancias.
- `admin.html`: administracion protegida de la plataforma.
- Supabase: autenticacion, RLS, Realtime, RPC, Storage y Edge Functions.
- PWA: instalacion web y continuidad con conexion inestable.
- Android: proyecto preparado para Capacitor mediante `package.json`.

## Cambios V86.1

- El servidor vuelve a calcular productos, precios historicos, domicilio y total.
- La aceptacion del pedido y el numero de ticket son atomicos.
- Catalogo publico seguro con sincronizacion por restaurante.
- Pagos Stripe Connect preparados con 5% para la plataforma sobre restaurante y
  0,1% sobre colaborador, conciliacion, reintentos, reembolsos y disputas.
- Eliminacion logica y atomica del restaurante sin borrar otras funciones de la
  misma cuenta.
- Documentos de colaboradores privados y validados.
- Autorizacion estable de personal y estaciones.
- Cierres diario, mensual y anual paginados por fecha operativa del restaurante.
- Traducciones mas estables y PWA versionada para evitar archivos antiguos.
- Impresion termica de altura dinamica y corte ESC/POS cuando el equipo lo admite.

## Instalacion segura

1. Conserva una copia del proyecto y de la base de datos.
2. Ejecuta las ocho migraciones indicadas en `MIGRACIONES-V86.md`.
3. Ejecuta `VALIDACION-V86.sql` y confirma que no produce excepciones.
4. Configura secretos y despliega las Edge Functions de `DESPLIEGUE-V86.md`.
5. Ejecuta `npm run qa`.
6. Despliega los archivos publicos en Vercel.
7. Completa las pruebas reales descritas en `PRUEBAS-V86.md`.

No habilites pagos reales solo por desplegar el codigo. Se requieren credenciales
live, webhook firmado, cuentas Connect verificadas, conciliacion, reembolsos,
disputas y revision legal/operativa en cada pais.

Documentos principales:

- `REPORTE-AUDITORIA-Y-REPARACION-V86.md`
- `MIGRACIONES-V86.md`
- `DESPLIEGUE-V86.md`
- `VALIDACION-V86.sql`
- `PRUEBAS-V86.md`
