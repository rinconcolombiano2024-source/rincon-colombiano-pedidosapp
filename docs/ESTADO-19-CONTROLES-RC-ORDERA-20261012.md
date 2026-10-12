# RC ORDERA — Tablero técnico de 19 controles básicos
Fecha: 12 octubre 2026. La lista organiza la exigencia de **19 puntos**; no se recibió un inventario numerado de aceptación anterior.
**Verde** = evidencia automatizada y, cuando aplica, validación física/externa; **amarillo** = código y QA parcial; **rojo** = función faltante o no certificada. Nunca cambiar a verde solo por compilar.

| # | Control | Estado al revisar | Falta para verde |
|---|---|---|---|
| 1 | Pedidos cliente hasta POS | Amarillo | E2E real anon/auth, entregado, reintentos y concurrencia |
| 2 | POS y facturación de venta | Amarillo | 2 dispositivos reales y reconciliación de facturas |
| 3 | Cocina y estaciones | Amarillo | Recetas/tickets, cambios y desconexiones con personal real |
| 4 | QR cliente | Amarillo | PWA Android instalada: pantalla aparte sin cerrar POS |
| 5 | Navegación por módulo PWA | Amarillo | Manifiestos aislados, QA CI; prueba Android PL/EN/ES física |
| 6 | Menú y productos | Amarillo | Cantidades, menú vigente, variaciones y fotos reales |
| 7 | Idiomas ES/PL/EN | Amarillo | QA automatizada; inspección visual completa con dispositivos |
| 8 | Diseño UX/accesibilidad | Amarillo | E2E en 320px, tableta, ordenador y recorrido humano completo |
| 9 | Auth, RLS, permisos | Amarillo | Tests negativos con clientes/meseros/otros restaurantes; advisories |
| 10 | CPU y consultas | Amarillo | Medir CPU real por ventana; optimización RLS en staging |
| 11 | Realtime/offline sin duplicados | Amarillo | Fallos de red reales, restauración, 1000 eventos bajo carga |
| 12 | Historial, arqueo y cierre diario | Amarillo | Cruce con 250+ tickets y cierres reales |
| 13 | IVA/contabilidad y reembolsos | Amarillo | Auditoría de PTU/IVA PL por categoría y devoluciones |
| 14 | Stripe/BLIK | Amarillo | Cobros test, elegibilidad BLIK, conciliación/cancelación |
| 15 | SumUp | Rojo | R19 checkout/webhook/migración **solo en rama, inactivos**; secretos y pruebas bancarias |
| 16 | POSNET fiscal | Rojo | Modelo y protocolo exactos, agente real, PTU y recibo legal probado |
| 17 | Glovo/Wolt/Uber/Bolt/Pyszne | Rojo | APIs y contratos oficiales, mapeo, webhooks y pruebas |
| 18 | Repartidores GPS/avisos | Amarillo | Permisos de ubicación móvil, ciclos de turno y push físico |
| 19 | Despliegue, observabilidad, backup 99,9 % | Amarillo | GitHub CI, backup/restauración, staging, monitor y SLO real |

## Acciones y límites
- **Main R18** ya contiene el cierre del falso indicador de pago confirmado por redirección, con tests y PWA cache r18. Código sin crear ventas ni facturas.
- **R19** está aislado y requiere pruebas de PGlite, CI, staging, claves API, habilitación deliberada y ensayos reales. No se considera dinero conectado hasta que exista recibo de prueba reconciliado.
- **CPU:** el 93 % fue reportado por el operador; en lectura directa de 20:31 UTC había 0 suscriptores `realtime.subscription`, y los acumulados históricos no demuestran consumo instantáneo. No se ejecutaron SQL de producción ni cron automáticos.
- Este tablero no afirma que los 19 puntos estén verdes ni que el código valga 1M USD o alcance 99,9 % de disponibilidad. Se precisa tráfico real y certificación fiscal/externa.
