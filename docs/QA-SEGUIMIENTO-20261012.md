# RC ORDERA V6 — recuperación de seguimiento y GPS, 2026-10-12

Base revisada: `0efaef39749ea8fe237fca5f87c3215c3f53d058`, rama `codex/rc-ordera-fusion-v6`, PR #1. Se conserva main.

## Defectos reproducidos y corregidos

- Los callbacks de polling de estado y chat perdían su siguiente ejecución si una lectura rechazaba la promesa. Ahora el rechazo entra en el backoff existente; se conservan las comprobaciones de pedido, generación, visibilidad, conexión y estado terminal. No se añaden intervalos ni consultas adicionales.
- Las coordenadas null, vacías o booleanas se convertían en cero. Ahora solo se admiten números o cadenas numéricas no vacías dentro de los límites geográficos. Cero real sigue siendo válido.
- La ausencia de marcas de tiempo mostraba antigüedad desde 1970 y una hora estimada ficticia. Se omiten estos campos cuando falta una fecha válida.
- El estado de espera de GPS es preciso aun cuando el repartidor ya aceptó el pedido. Textos ES/PL/EN revisados en esta tarjeta. El enlace del mapa tiene altura mínima de 44px, espaciado, ajuste de texto y foco de teclado visible.

## Evidencia

- 14 pruebas nuevas de comportamiento: 12 fallaban antes; 14 pasan después. Incluyen recuperación, backoff acotado, transiciones durante un rechazo, ausencia de GPS, coordenadas legítimas y escape del nombre.
- `npm run qa`: 476 pruebas Node aprobadas; comprobaciones de idiomas, sintaxis, seguridad y correspondencia de 50 fuentes/www incluidas. La prueba de preservación reversible conserva los bytes originales fuera de los cambios registrados.
- Tres nuevos escenarios Playwright ES/PL/EN a 320px, ejecutados en la matriz de CI. El resultado de GitHub Actions del commit final es la autoridad para las pruebas de navegador.
- La descarga local de Chromium devolvió un archivo inválido; no se declara inspección visual manual ni E2E local aprobado.
- La evidencia de temporizadores es determinista y local; no equivale a una medición de CPU o memoria en producción.

## Alcance y pendientes

Avance concreto en objetivos 1 (seguimiento), 7 (GPS), 8 (recursos) y 9 (interfaz e idiomas). No es una auditoría línea por línea de toda la app ni certificación al 100%.

Se mantienen los pendientes de `ESTADO-10-PUNTOS.md`: staging multiusuario/RLS, Stripe test/BLIK, POSNET físico, APIs oficiales de reparto, conciliación contable y plan de despliegue/rollback. No se ejecuta SQL ni se activan cobros o fiscalización reales.
