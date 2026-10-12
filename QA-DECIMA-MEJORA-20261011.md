# Décima mejora — instalación multilingüe verificable

Base fe55d81923b7cbd64f797c6247d4ba2928d1ff22. Ambos CI de esa revisión aprobaron (38134216271 y 38134213996), incluidos escenarios de navegador; esto no sustituye revisión visual humana ni instalación real del sistema operativo.

Defecto encontrado: auto-translate cambia el manifiesto del portal a portal-manifest.pl.webmanifest o portal-manifest.en.webmanifest, pero esos archivos no existían en la novena entrega. Se incluyen ambos, con la misma identidad portal-app y entrada index.html en su idioma. Se distribuyen a www y caché offline; nueva identidad de caché install-r10. No se cambian identidades de cliente/colaborador ni permisos.

El evento appinstalled ya no afirma que la app esté abierta: muestra instalación completada e instrucciones para abrir el icono. Se conserva ese estado al pulsar nuevamente y no se degrada a solicitado si userChoice llega después. El modo standalone tiene su propio mensaje. No se declara instalación por aceptar solamente la solicitud. Las escrituras de texto se realizan solo si cambia su valor; cien notificaciones del mismo idioma producen cero escrituras adicionales en el ensayo automatizado. Sin polling ni dependencias nuevas.

Cuatro nuevas pruebas Node: existencia/identidad de manifiestos PL/EN, estado instalado traducido, orden de eventos y escrituras redundantes. Tres escenarios nuevos Playwright comprueban que el manifiesto seleccionado por idioma realmente se descarga y conserva la ruta del portal. La suite completa prevista suma 420 casos; se ejecuta desde la extracción limpia antes de entregar. CI actual se informa por separado, sin contar resultados anteriores como aprobación de esta revisión.

Revisión localizada de instalación/idiomas; no es una auditoría exhaustiva nueva de todas las pantallas. Se conservan interfaz y módulos anteriores. La evidencia de CPU de la novena revisión pertenece al módulo de traducción con DOM simulado, no al sistema completo. Continúan pendientes CPU/memoria móvil, instalación física, recorrido real de venta, Supabase TEST/RLS, concurrencia PostgreSQL independiente, Stripe sandbox, POSNET físico y plataformas oficiales. No se ejecutan operaciones de producción ni migraciones.

Ver docs/ESTADO-10-PUNTOS.md. Instalar con npm ci --ignore-scripts --no-audit --no-fund; npm run qa; sha256sum -c MANIFEST-SHA256.txt. ZIP y rama deben contener los mismos archivos. Rollback mediante reversión revisada y caché nueva; no eliminar datos ni diarios fiscales.
