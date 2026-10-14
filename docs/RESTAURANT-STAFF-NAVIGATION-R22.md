# R22 — acceso de personal dentro del restaurante

Solicitud: retirar «Personal y estaciones» de la portada y situarlo dentro del restaurante. La captura también muestra el selector fijo de idioma cubriendo una tarjeta al desplazarse.

Cambios mínimos:
- La portada conserva Cliente, Restaurante y Colaborador. El selector ES/PL/EN permanece en el flujo de la página y deja de tapar tarjetas.
- El botón del propietario se identifica como «Personal y estaciones» y conserva la gestión de permisos existente.
- La entrada del restaurante permite al empleado abrir su estación sin iniciar sesión como propietario. El enlace sigue requiriendo autenticación y autorización en el módulo de estaciones.
- En Android se utiliza el mismo puente Browser y dominio permitido que los módulos existentes; no se sustituye el WebView del restaurante.
- Los enlaces de regreso dicen «Inicio» porque la portada ya no contiene estaciones.
- Release R22 y copias web/Android iguales; conserva R21 y sus protecciones del guardado del menú. No cambia pagos, base de datos, productos ni pedidos.

Validación: baseline de los tests afectados aprobado; QA completa aprobada antes del ajuste final del enlace nativo; pruebas dirigidas posteriores aprobadas, incluyendo el nuevo enlace en Android y preservación de código. GitHub debe verificar nuevamente QA e interfaz antes de fusionar. Las pruebas de navegador local no pudieron arrancar por la descarga incompleta de Chromium; no se presentan como aprobadas.
