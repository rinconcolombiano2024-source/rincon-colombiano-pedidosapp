# Duodécima mejora — caché de traducciones

Base remota: 80d589a10a17412b1fdaee178fd22c6783f24862, borrador PR #1.

## Cambio y evidencia

La caché local aceptaba objetos, números, claves ajenas y textos vacíos. Además aplicaba el límite antes de validar, de modo que entradas inválidas podían desplazar traducciones válidas. Se filtran las entradas antes de conservar las últimas 900: idiomas remotos PL/EN, texto fuente de hasta 500 caracteres y traducción no vacía de hasta 2000 caracteres. Las entradas descartadas pueden obtenerse de nuevo por el mecanismo existente. ES usa el original/diccionario, sin caché remota. Se preservan el diccionario, el control de concurrencia y los plazos de persistencia.

Cuatro pruebas unitarias ejecutan la función real extraída del archivo: todas fallaron antes del cambio y aprobaron después. Cubren tipos, tamaños, claves, raíces inválidas y desplazamiento de entradas válidas. No se retiraron pruebas ni se relajaron condiciones.

## Verificación

- npm run qa: 425 pruebas aprobadas, 0 fallidas; 171 archivos de sintaxis, 50 fuentes/distribuciones idénticas y 10 identificadores V5 verificados.
- npm run qa:integration: 9 omitidas por ausencia de proyecto Supabase TEST y cuentas; 0 aprobadas en esta ejecución.
- Preparación web Android: 50 archivos sincronizados.
- Benchmark DOM de diagnóstico: 100 consultas, 200 nodos estáticos, 2000 traducciones, 0 escrituras de texto, 100 peticiones; muestra Node de CPU 11766 microsegundos. Los contadores no empeoran frente a la revisión anterior. No se atribuye una mejora de CPU a este cambio de caché ni se extrapola a toda la app.
- Ambos CI de la revisión anterior concluyeron correctamente. El CI de este nuevo commit debe comprobarse por separado; navegador local no disponible en esta sesión.

## Límites

Esta es una corrección localizada, no una certificación integral de producción ni una revisión visual manual de todas las pantallas. Se conserva el diseño y la instalación PWA ES/PL/EN de las mejoras anteriores. Ver docs/ESTADO-10-PUNTOS.md para los diez objetivos. Hardware POSNET, contratos de reparto, Stripe test, RLS y concurrencia de Supabase con sesiones reales permanecen pendientes. No se modificó main, no se desplegó ni se aplicó SQL en producción.
