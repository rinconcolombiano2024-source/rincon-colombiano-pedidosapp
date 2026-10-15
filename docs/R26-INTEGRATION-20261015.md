# R26 — integración comprobable, 2026-10-15

Base: `7cbe054`, después de revisar ramas y PR #62 y #76. Se conservan las correcciones recientes de navegación nativa, notas de reparto y autorización fiscal/pagos.

## Cambios mínimos

- Integra la corrección de #76: cada adición crea una línea independiente. Los controles de cantidad y separación existentes permanecen disponibles. La prueba reforzada añade el mismo producto dos veces ANTES de escribir notas: fallaba en main (una línea en vez de dos).
- Integra la corrección validada de #62: confirmar una edición antigua no anuncia sincronización completa si hay ajustes posteriores pendientes. Dos confirmaciones de la misma edición no inventan pendientes. Dos de seis casos fallaban en main.
- Traducción ES/PL/EN del estado pendiente. Marcador/cache R26 para distribuir los archivos nuevos sin borrar datos locales.
- E2E de notas: dos productos iguales, edición individual, cambio ES/PL/EN, refresco de menú, payload con options_snapshot y conservación tras envío fallido. Usa backend simulado, no certifica entrega real a cocina.
- Siete pruebas de ejecución del endpoint de conexión empresarial existente: configuración, autenticación, límites, país, aislamiento y conciliación sin cobros.

## Validación

- Baseline: `npm run qa`: 805/805, cero fallos y omitidas.
- Después: `npm run qa`: 813/813, cero fallos y omitidas. Las siete pruebas de onboarding se añadieron después y pasan separadamente.
- Browser local no disponible: Playwright no encuentra Chromium. CI debe ejecutar E2E antes de fusionar; no se considera aprobada por esta limitación.
- Sin dependencias nuevas, migraciones, activación de cobros ni cambios de RLS.

## Estado real observado (2026-10-15 06:55 UTC)

Supabase: 13 conexiones, una activa (incluye diagnóstico). Esto no mide CPU y no demuestra reducción del 93% reportado. Faltan tabla `rc_sumup_payment_attempts` y RPC `rc_sumup_reserve_checkout`. En la lista desplegada no aparecen `marketplace-onboarding`, `sumup-checkout` ni `sumup-webhook`.

Stripe dispone de interfaz y endpoint de onboarding en código. La conexión de la empresa requiere desplegar ese endpoint, configuración privada del proveedor, alta/KYC de la empresa y validación de prueba. SumUp requiere además migraciones auditadas y despliegue de sus funciones. No introducir credenciales en frontend ni repositorio. BLIK, reembolsos y liquidación requieren prueba de proveedor. La impresora fiscal requiere hardware y verificación autorizada.

## Reversión

Revertir este PR y redesplegar su padre; no hay cambios de esquema o datos que revertir. Conservar el carrito y borradores. La actualización del service worker sigue siendo explícita durante operación.

No se acredita porcentaje de disponibilidad, capacidad masiva ni certificación fiscal mediante estas pruebas.
