# Controles de seguridad V5

- Los clientes conservan solo URL/anon key públicos; service_role, claves Stripe, tokens fiscales y credenciales de partner permanecen en backend/PC privado.
- La configuración Google Maps pública requiere restricciones de dominio/API; se mantiene la clave existente y no se cambió ningún secreto.
- CORS permitido se configura por entorno. Un Origin no autorizado se rechaza antes de ejecutar handlers. No sustituye autenticación ni autorización.
- Los webhooks y permisos Stripe existentes se conservaron; sus pruebas locales no certifican una cuenta Stripe live.
- El gateway fiscal está deshabilitado por defecto. Solo permite dispositivos mock de staging, con token hash y restaurante coincidente. Una confirmación mock no es recibo fiscal.
- UNKNOWN requiere conciliación: no borrar journal, no reimprimir ni reenviar automáticamente. SQL y tokens exclusivos son autoridad; locks locales solo complementan persistencia.
- La cola saliente usa reclamación atómica, fencing y almacenamiento por tenant. Anon/authenticated no tienen lectura ni escritura directa sobre tablas de cola/eventos.
- Proveedores provisionales están fuera del registro productivo. Revisión de contrato/autenticación/rutas y pruebas oficiales preceden a cualquier habilitación.
- Capacitor Android/core/CLI se actualizaron de8.5.0 a8.5.3 tras confirmar GHSA-rvm3-566m-v7fv. npm audit productivo reportó0 vulnerabilidades al terminar; reconstruir APK para recibir el parche.
- .vercelignore excluye SQL, scripts, bridges, contabilidad, tests y reportes. Verificar403/404 en el preview desplegado antes de producción.
- El escáner local no detectó secretos privados en la entrega. No certifica el historial entero de Git ni la configuración actual de servicios desplegados.

Se mantienen la CSP activa y una política Report-Only para evaluación posterior. Endurecerla requiere navegador y pruebas con mapas/pagos/móvil. Consultar QA-REPORT.md para E2E y RLS remotos bloqueados; nunca presentar los skips como evidencia de seguridad desplegada.

Referencia oficial revisada: https://github.com/advisories/GHSA-rvm3-566m-v7fv
