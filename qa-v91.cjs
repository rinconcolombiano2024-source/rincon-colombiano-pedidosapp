const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const courier = read("colaborador.js");
const migration = read("MIGRACION-V91-01-RENDIMIENTO-INTEGRIDAD-Y-CIERRES.sql");
const sw = read("service-worker.js");
const failures = [];
const check = (condition, label) => { if (!condition) failures.push(label); };

check(/LOCAL_ORDER_CACHE_LIMIT\s*=\s*250/.test(app), "cache de pedidos limitado");
check(!app.includes(".limit(5000)"), "sin descarga inicial de 5.000 pedidos");
check(app.includes('clientOrdersRealtimeStatus === "SUBSCRIBED"'), "polling suspendido con Realtime");
check(app.includes("handleClientOrderRealtimePayload"), "actualizacion incremental de pedidos");
check(app.includes("renderClientOrderPatch"), "render incremental de una tarjeta");
check(app.includes('data-action="load-client-chat"'), "chat bajo demanda");
check(app.includes('rpc("get_restaurant_closure_report"'), "cierres calculados en servidor");
check(app.includes('rpc("void_restaurant_order"'), "cancelacion historica por RPC");
check(!app.includes("deleteCloudOrder"), "sin borrado fisico de pedidos guardados");
check(courier.includes('courierDeliveryRealtimeStatus === "SUBSCRIBED"'), "colaborador usa polling solo como respaldo");
check(migration.includes("get_rc_ordera_schema_version"), "control de version de esquema");
check(migration.includes("get_restaurant_closure_report"), "RPC de cierres");
check(migration.includes("void_restaurant_order"), "RPC de anulacion");
check(migration.includes("process_expired_delivery_offers"), "mantenimiento de ofertas separado");
check(migration.includes("update_delivery_assignment_status"), "estado de entrega atomico");
check(!/drop\s+table/i.test(migration), "migracion sin DROP TABLE");
check(!/disable\s+row\s+level\s+security/i.test(migration), "migracion no desactiva RLS");
check(migration.includes("notify pgrst, 'reload schema'"), "recarga de esquema PostgREST");
const criticalCodeStart = sw.indexOf("if (isCriticalCode)");
const criticalCodeEnd = sw.indexOf("const updateCache", criticalCodeStart);
const criticalCodeBlock = criticalCodeStart >= 0 && criticalCodeEnd > criticalCodeStart
  ? sw.slice(criticalCodeStart, criticalCodeEnd)
  : "";
check(criticalCodeBlock.includes("fetch(event.request)"), "PWA intenta primero la red para codigo critico");
check(criticalCodeBlock.includes("cache.put(event.request, responseClone)"), "PWA actualiza cache con respuesta valida");
check(criticalCodeBlock.includes("caches.match(event.request)"), "PWA usa cache cuando falla la red");
check(criticalCodeBlock.includes('status: 503'), "PWA responde 503 sin red ni cache");
check(app.includes("requestIdleCallback(persistMenuCatalogCache"), "cache del menu fuera del hilo principal");
check(app.includes("menuSearchTimer = window.setTimeout"), "busqueda del restaurante con debounce");
check(courier.includes('courierDeliveryRealtimeStatus === "SUBSCRIBED"'), "seguimiento de colaborador sin sondeo duplicado");
check(/finally\s*\{\s*cloudState\.loading\s*=\s*false;\s*updateCloudStatus\(\);\s*\}/s.test(app), "estado de nube siempre finaliza");
check(app.includes("anulacion(es) antigua(s)") && app.includes("order not found"), "cola antigua no queda pendiente para siempre");

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}
console.log("RC ORDERA V91.0.3 QA: comprobaciones aprobadas.");
