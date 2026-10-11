# Undécima mejora — accesibilidad multilingüe

Base f1bae92c4c5297990d961edba3989a1ef8e6c0f0. Ambos CI aprobaron (38134606651 y 38134603222). Rama de borrador, sin merge ni producción.

Defecto: el centro traducía nodos de texto pero no aria-label. Un lector de pantalla recibía «Categorías», «Resumen de preparación» y «Diagnóstico de integraciones» en español aun usando PL/EN. Se añaden tres entradas al catálogo compartido y traducción de esos atributos conservando su fuente original. Incluye el atributo del propio diagnóstico, no solo sus descendientes. Solo escribe cuando cambia el valor y mantiene el recorrido limitado al diagnóstico al consultar.

Regresión Node nueva: ES→PL→EN→ES conserva nombres accesibles después de una consulta. Playwright nuevo: tablist y región se identifican por nombres PL/EN. Suite local completa: 421 casos aprobados, cero fallidos. Se repite desde ZIP limpio antes de entregar. Una ejecución intermedia detectó el hash de preservación pendiente de actualizar; se registraron diferencias reversibles de los archivos modificados sin desactivar la prueba que reconstruye los originales.

Ensayo del módulo actualizado: 100 consultas, 200 nodos estáticos, 2.000 llamadas de traducción, cero asignaciones de texto redundantes en español y 100 solicitudes. La novena mejora registró 1.800 llamadas sin traducir estos atributos; el coste adicional es acotado y el presupuesto sigue siendo menos de 30 por consulta. Muestra CPU Node 14.120 µs; no certifica CPU global, memoria de navegador ni velocidad móvil. Sin polling o dependencias nuevas.

No se realizó rediseño global ni auditoría exhaustiva nueva. Se conservan botones de descarga, colores y comportamiento anterior. Navegador local sigue no disponible; CI nuevo se verifica aparte, sin atribuirle el éxito anterior. Siguen pendientes nueve pruebas Supabase TEST, hardware, servicios externos oficiales, instalación real, revisión visual humana y recorrido completo de venta.

Ver docs/ESTADO-10-PUNTOS.md. Sin migraciones nuevas. Instalar: npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt. Revertir esta revisión restaura textos anteriores sin cambios de datos.
