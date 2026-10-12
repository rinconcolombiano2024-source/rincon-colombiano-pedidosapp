# RC ORDERA — Fix de captura de navegación de PWA (2026-10-12)

## Hallazgo reproducible de código
Tras aislar `restaurante/cliente/mesero` en el PR #17, **12 manifiestos
restantes** seguían declarando `scope: "."` o `"./"`, es decir, toda la
aplicación. Al instalar Portal, Administrador, Colaborador o la app legacy
en Android, podían capturar enlaces de Cliente/Estaciones y mostrar otra
pantalla en el mismo contexto, dando la impresión de que se cerró el POS.

## Alcance de esta corrección
- Aísla por ruta exacta los 7 tipos de manifiesto × 3 idiomas (21 casos).
- Corrige 12 manifiestos + sus réplicas `www/`. Los otros 9 ya estaban
  corregidos en PR #17.
- No modifica los identificadores `id`, las direcciones `start_url`, los
  nombres, Auth, roles, datos, pedidos, sincronización, IVA o base de datos.
- Conserva enlaces QR, Estaciones y Cocina como `_blank` + `noopener`.
- Las pruebas revisan los **21 manifiestos**, comparan raíz contra `www`
  y verifican que ninguna app capture rutas de otras.

## Verificación de campo (antes de confiar en caja)
1. Comprobar el último deployment Vercel y cache busting en el dispositivo.
2. En el PWA Android instalado, abrir Cliente con QR y Estaciones/Cocina;
   confirmar que **Restaurante** sigue abierto y conectado.
3. Repetir en español, polaco e inglés; revisar que los pedidos pendientes
   se conservan. Probar un pedido real controlado de extremo a extremo.
4. Chrome/Android puede retener un manifiesto anterior durante un tiempo:
   actualizar desde el navegador normal. **No borrar caché ni reinstalar**
   a ciegas si existen pedidos locales sin confirmar.

## CPU y seguridad
Este parche es de navegación PWA; **no altera ni reduce directamente CPU de
PostgreSQL**. Para CPU medir panel Supabase antes/después y tasas temporales
de SQL, conflictos, Realtime y sesiones activas. No desactivar Realtime,
modificar funciones privilegiadas ni encender trabajos Cron sin ensayo.
El botón fiscal es visible en el POS, pero emitir comprobantes POSNET
requiere modelo, protocolo, controlador y validación física.
