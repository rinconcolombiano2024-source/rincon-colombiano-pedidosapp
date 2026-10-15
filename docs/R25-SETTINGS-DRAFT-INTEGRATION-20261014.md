# R25 — integración verificada del borrador de ajustes #62

Base: R24, `71d65b300441a27ae48ed047e5e1f7475dc2237c`, con 771 pruebas aprobadas.
Se conserva íntegra la protección de sesiones y consultas del menú de #63.

Se reprodujeron los dos casos del borrador: guardar ajustes mientras aparece una
edición posterior, incluida una petición iniciada sin token pendiente, devolvía
`synced: true` aunque quedaban cambios locales por publicar.

La revisión detectó además una regresión en el borrador original: dos confirmaciones
de la misma edición podían dejar un falso aviso pendiente porque la primera ya
había limpiado el token. Una nueva prueba pasa contra R24, falla contra el borrador
original y pasa con la integración corregida.

Cambio mínimo: limpiar exclusivamente el token de la edición confirmada y comprobar
si aún existe un pendiente antes de mostrar «Sincronizado». Se conserva la edición
nueva sin añadir consultas, bucles ni reintentos. Mensaje disponible en ES/PL/EN.

Validación local: `npm run qa`, **777/777**, sin fallos ni omitidos; distribución web
y Android idéntica, sintaxis, traducciones y deltas reversibles correctos. CI debe
validar dependencias y navegador sobre el nuevo commit antes de fusionar #62.
R25 identifica este conjunto y renueva solo archivos estáticos, sin borrar datos.

Esto verifica la confirmación del guardado de ajustes; no acredita que borradores
de una tableta ausente estén en Supabase, ni habilita SumUp, impresoras o reparto.
Para el diagnóstico de producción y sus límites, ver el informe R24 de esta fecha.
