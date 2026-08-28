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
check(sw.includes("event.waitUntil(updateCache"), "actualizacion PWA en segundo plano");
check(app.includes("requestIdleCallback(persistMenuCatalogCache"), "cache del menu fuera del hilo principal");
check(app.includes("menuSearchTimer = window.setTimeout"), "busqueda del restaurante con debounce");
check(courier.includes('courierDeliveryRealtimeStatus === "SUBSCRIBED"'), "seguimiento de colaborador sin sondeo duplicado");

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}
console.log("RC ORDERA V91 QA: 22 comprobaciones aprobadas.");
