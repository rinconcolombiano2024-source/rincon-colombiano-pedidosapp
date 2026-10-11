# Decimotercera mejora — respuesta remota de idiomas

Base remota: 9d68e840e479d7148ee8efa649ee98b617dcb862. PR #1, rama codex/rc-ordera-fusion-v6.

## Defectos reproducidos y corrección

Una respuesta HTTP exitosa con translatedText de tipo objeto se convertía en [object Object] y podía mostrarse y almacenarse. Una respuesta vacía no activaba la pausa de recuperación; por ello el siguiente texto generaba otra solicitud inmediatamente. Dos pruebas reprodujeron ambos fallos antes de corregirlos.

El cliente ahora admite únicamente cadenas no vacías de hasta 2000 caracteres. Frente a una respuesta inválida conserva el texto original, no persiste la respuesta y pausa nuevas solicitudes durante 20 segundos. Reutiliza el mecanismo de recuperación existente, sin polling ni nuevo motor. Se mantienen la normalización, el diccionario local y las solicitudes compartidas para el mismo texto.

Cinco pruebas nuevas cubren tipos incorrectos, respuestas vacías/excesivas, reutilización de traducciones válidas, solicitudes simultáneas y recuperación al terminar la pausa. Son pruebas de la función real con transporte simulado, no certificación del proveedor externo.

## QA

Primera ejecución completa: 429 pruebas aprobadas; después se añadió y aprobó una quinta prueba de recuperación (total esperado 430 para la verificación limpia del paquete). Cero fallos finales en estas ejecuciones. Sintaxis: 172 archivos; distribución: 50 copias idénticas a sus fuentes; migraciones V5: 10 identificadores.

Supabase: nueve pruebas omitidas por falta de proyecto TEST y cuentas; no se contabilizan como aprobadas. Ambos CI del commit base terminaron correctamente. Los resultados del nuevo commit se consultan aparte en GitHub.

Benchmark del diagnóstico: 200 nodos estáticos, 100 consultas, 2000 traducciones, 0 escrituras de texto redundantes, 100 peticiones, muestra CPU Node 13848 microsegundos. Contadores equivalentes a la revisión anterior; no hay afirmación de mejora de CPU global. La pausa se prueba con reloj controlado, no esperando 20 segundos reales.

## Alcance y pendientes

Cambio localizado en idiomas y recuperación. No se modificó el diseño visual; las pruebas previas de interfaz no sustituyen una revisión manual de todas las pantallas. Se conserva instalación PWA ES/PL/EN y el resto de módulos. Consultar docs/ESTADO-10-PUNTOS.md. Hardware fiscal, contratos oficiales de reparto, Stripe test y pruebas de aislamiento/concurrencia con Supabase real siguen pendientes. No se modificó main, no se desplegó ni se ejecutó SQL de producción.
