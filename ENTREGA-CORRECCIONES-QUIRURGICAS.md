# Entrega quirurgica sobre ZIP20 CPU-SYNC

Este documento actualiza los resultados de ENTREGA-CPU-SYNC-ZIP20.md.

## Cambios de esta entrega

- Checkout: restaurada la reutilizacion de intentos pendientes sin URL; conserva identificador y clave de idempotencia. Los errores ambiguos 503/5xx, 429 y 409 no convierten el intento en fallido para crear otro.
- Auth/logout: se cierra tambien el canal Realtime central y sus temporizadores tanto en salida explicita como al desaparecer la sesion. No se cambio la proteccion que exige confirmar pendientes antes de salir.
- i18n: agregadas traducciones ES/PL/EN del portal y carga de los traductores existentes en index.html, sin cambiar enlaces ni diseño.
- Se conserva la mejora incremental de orders de la entrega anterior.
- cliente.js y www/cliente.js NO se modificaron: carrito intacto por instruccion expresa.

## Verificacion

- npm run qa: aprobado, incluido i18n (2062 comprobaciones).
- node --test tests/checkout-recovery.test.cjs tests/central-order-incremental.test.cjs: 9 aprobadas.
- Las pruebas de checkout ejecutan el manejador con Stripe y Supabase simulados. No realizan pagos reales.
- QA Supabase: 0 aprobadas, 7 omitidas por falta de configuracion TEST y 2 TODO. NO certifica RLS ni concurrencia real.
- No se modificaron las politicas RLS ni se ejecutaron migraciones o despliegues remotos.

## Migraciones V91-04

Los dos nombres existentes se conservan para no romper instalaciones previas:

1. MIGRACION-V91-04-GUARDADO-ATOMICO-PEDIDOS.sql
2. MIGRACION-V91-04-CONTROL-CARGA-SINCRONIZACION.sql

Son archivos con responsabilidades diferentes; no elegir uno excluyendo el otro. El orden completo figura en ENTREGA-RC-ORDERA-V91.md. No se renumeraron ni se aplicaron automaticamente.

## Pendiente fuera de esta entrega

- Desplegar marketplace-checkout en Supabase; publicar frontend solamente no actualiza la Edge Function.
- Probar pagos en Stripe TEST, incluidas concurrencia y recuperacion con fallos.
- Configurar un Supabase TEST separado con las cuentas previstas por tests/integration/support/supabase-rest.cjs. No enviar contraseñas o claves secretas por chat.
- Certificar aislamiento RLS, flujos entre dispositivos, restauracion tras desconexion y CPU bajo carga real.
- La CPU al 100% no puede darse por resuelta solo con pruebas locales.

No se garantiza ausencia absoluta de regresiones: se documentan las pruebas y limites. No se modificaron menu, horarios, carrito ni logica de preparacion de estaciones.
