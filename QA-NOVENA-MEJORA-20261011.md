# Novena mejora — instalación, idiomas e interfaz

Base: 4bce209b9c5666f83971a411dc61db8c2eb1ac06. Borrador codex/rc-ordera-fusion-v6; no main ni despliegue de producción.

## Cambios

Botón visible «Descargar app» en index.html, cliente.html y colaborador.html, con textos ES/PL/EN y tamaño táctil mínimo de 48 px. Un controlador compartido usa el evento nativo de instalación cuando existe; en otros navegadores abre una guía accesible con instrucciones Android, Safari iOS y escritorio. No descarga un APK, no inventa disponibilidad y conserva el botón tras cancelación/error. El portal tiene identidad y manifiesto propios; cliente y colaborador conservan sus manifiestos existentes. Se reutiliza el service worker; caché versionada y distribución www sincronizada. Sin polling ni dependencias nuevas.

Centro de integraciones: traducción conserva espacios entre etiquetas y valores; las consultas traducen únicamente el diagnóstico. Se evitan escrituras de texto idéntico. Tarjetas permiten envolver estados largos; botones deshabilitados tienen colores explícitos más legibles y mantienen su bloqueo.

## Evidencia

QA local: 416 casos aprobados, cero fallidos. Ocho pruebas nuevas cubren idiomas/espaciado, trabajo de traducción acotado, ausencia de escrituras redundantes, ayuda de instalación, doble clic, cancelación, error, modo standalone y entradas de las tres páginas. Se añadieron cuatro escenarios Playwright que CI ejecuta en móvil/tableta/escritorio. Las nueve pruebas Supabase se ejecutaron pero quedaron omitidas sin entorno TEST.

Medición reproducible: scripts/benchmark-dashboard.mjs compara 100 consultas sobre 200 nodos estáticos simulados. Antes: 42.000 traducciones, 1.700 asignaciones de texto, 100 solicitudes; después: 1.800 traducciones, cero asignaciones redundantes en español, 100 solicitudes. CPU de una muestra Node: 119.861 µs frente a 12.488 µs. Es una medición del módulo en un DOM simulado; NO es CPU global de RC ORDERA, latencia de Supabase ni rendimiento de un teléfono. El contador de trabajo es reproducible; los tiempos dependen del entorno. Presupuesto automatizado: menos de 30 traducciones por consulta, una solicitud por clic, cero escrituras al repetir idioma.

Instalación real del sistema operativo y revisión visual humana siguen pendientes. La descarga de Chromium local falló; no se presenta como prueba visual aprobada. CI actual se verifica por separado. No se certifican todas las pantallas ni todas las traducciones del producto mediante esta revisión localizada.

## Entrega y pendientes

Se verifica ZIP limpio con npm ci, npm run qa y manifiesto SHA-256; contenido idéntico al borrador. Estado de diez objetivos: docs/ESTADO-10-PUNTOS.md. Siguen pendientes staging/RLS, concurrencia real, recorrido completo de venta, Stripe test, POSNET físico, proveedores oficiales y pruebas móvil/CPU/memoria globales. No hay migraciones nuevas. Para recuperar interfaz anterior, revertir commit y desplegar caché nueva; no borrar datos ni diarios fiscales.
