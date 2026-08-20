# Validacion RC ORDERA V85

## Comprobaciones realizadas localmente

- Sintaxis de `app.js`, `cliente.js`, `mesero.js`, `colaborador.js`, `admin.js`,
  traducciones y scripts auxiliares.
- JSON valido en manifiestos, Vercel, npm y Capacitor.
- 67 verificaciones estaticas: IDs, selectores, archivos PWA, migraciones,
  estaciones, cierres, comisiones, doble confirmacion, Edge Functions y secretos.
- Preparacion Android: 21 archivos copiados y validados en `www`.
- Busqueda de datos visuales de ejemplo para evitar nombres, pedidos y cifras
  codificados desde las capturas.
- Confirmacion del calculo del pedido en Supabase: productos, disponibilidad,
  precio, domicilio y total no dependen del total enviado por el navegador.
- Confirmacion de impresion directa ESC/POS con orden de corte `GS V`.

Resultado local:

```text
JavaScript syntax: OK
RC ORDERA V85 static QA: OK (67 checks)
Android web assets prepared: 21 files
```

## No ejecutado desde este entorno

- Las migraciones no se ejecutaron contra la base Supabase productiva.
- No se realizaron cargos Stripe live ni transferencias bancarias.
- No se genero AAB firmado ni se probo en Google Play.
- No se certifico capacidad, privacidad ni disponibilidad del proveedor externo
  usado como respaldo para traducir descripciones del menu.
- La automatizacion visual del navegador no pudo iniciarse por un error interno
  del conector de navegador de Codex.

Por estas razones V85 es una candidata preproduccion, no una certificacion de que
los pagos estan listos para publico general.

## Pruebas obligatorias en staging

1. Guardar menu con datos, refrescar y abrir en cliente.
2. Intentar reemplazar menu valido con `{}` y confirmar bloqueo.
3. Ejecutar vaciado autorizado y confirmar respaldo previo.
4. Autorizar cada estacion y completar un pedido extremo a extremo.
5. Marcar entrada/salida y verificar semana/mes.
6. Cerrar dia/mes/ano del restaurante y dia/mes del mesero.
7. Probar caja, recogida y domicilio con perdida/reconexion de internet.
8. Confirmar que ticket PDF/sistema no agrega pagina en blanco.
9. Probar impresora ESC/POS real y corte.
10. Completar matriz financiera indicada en `PAGOS-MARKETPLACE-V85.md`.
11. Probar RLS con cliente A/B, restaurante A/B, empleado, colaborador y admin.
12. Probar 320, 360, 390, 412, 430, 768, 1024, 1280 y 1440 px.
13. Probar descripciones reales en ES/PL/EN, caida del proveedor de traduccion y
    comportamiento del cache sin exponer datos personales.

## Criterio de lanzamiento

No avanzar a publico general mientras exista un fallo en migraciones, RLS,
conciliacion, reembolso, contracargo, webhook, doble confirmacion, impresion real
o pruebas de dispositivo. Cada resultado debe guardarse con fecha, usuario de
prueba y evidencia, sin usar datos personales reales.
