# RC ORDERA — aislamiento PWA por módulo e idioma (2026-10-12)

## Incidente
La app de restaurante ES declara scope `./restaurante.html`,
pero sus manifiestos **PL/EN** usaban `scope: "."` (todo el origen).
En Android, una PWA con scope amplio puede capturar enlaces a cliente o
estaciones, dando la impresión de que la ventana original del POS se cerró.
También los manifiestos ES/PL/EN de cliente/estación cubrían todo el origen.

## Corrección
- Scope aislado: `./restaurante.html`, `./cliente.html`, `./mesero.html`
  según el módulo, en los tres idiomas.
- No se alteran ID ni start_url, Auth, datos de pedidos, RPC, Supabase,
  caché de pedidos ni configuraciones fiscales.
- Los enlaces QR/estaciones/cocina conservan `target=_blank` y
  `rel=noopener noreferrer`.
- Los archivos raíz y `www/` permanecen idénticos. QA valida 9 casos.

## Despliegue seguro
Confirmar CI completo antes de fusionar. Probar físicamente PWA instalada
en Android en PL/EN/ES: QR→cliente, estaciones→mesero, volver al POS,
comprobar sesión y pedidos. Algunos Android/Chrome tardan en actualizar
un manifiesto instalado. No borrar datos locales si hay pedidos por
sincronizar ni reinstalar a ciegas. Esta corrección limita el scope,
pero no garantiza el comportamiento de todas las versiones de Android.
El botón fiscal dentro del POS solo autoriza puerto: no certifica POSNET.
