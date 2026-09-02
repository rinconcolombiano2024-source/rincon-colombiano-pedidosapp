const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const customer = read("cliente.js");
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
check(app.includes("withCloudTimeout(cloudState.client.auth.getSession())"), "sesion de nube con tiempo maximo");
check(app.includes("await withCloudTimeout(ensureMinimumDatabaseVersion())"), "version de nube con tiempo maximo");
check(/await withCloudTimeout\(\s*Promise\.all\(\[\s*settingsRequest,/s.test(app), "carga inicial de nube con tiempo maximo");
check(customer.includes("const requestedStoreId = customerStoreId;"), "menu conserva el restaurante solicitado");
check(customer.includes("if (requestedStoreId !== customerStoreId) return;"), "respuesta tardia no reemplaza otro menu");
check(/function saveMenuCatalog\(\)\s*\{[\s\S]*?markMenuPending\(\);[\s\S]*?saveMenuCache\(\{ immediate: true \}\);/.test(app), "menu local protegido antes de sincronizar");
check(app.includes("remoteMenuHasNewerRevision") && app.includes("protectLocalMenuFromEmptyCloud"), "menu vacio confirmado conserva su revision de nube");
check(customer.includes("customerReadMenuCache(requestedStoreId)"), "cliente recupera el menu publico cuando falla la nube");
check(app.includes("anulacion(es) antigua(s)") && app.includes("order not found"), "cola antigua no queda pendiente para siempre");

const settingsReadGuardStart = app.indexOf("if (!settingsError) {");
const ordersReadGuardStart = app.indexOf("if (!ordersError) {");
const postOrdersReadStart = app.indexOf("    try {", ordersReadGuardStart);
const settingsReadGuard = settingsReadGuardStart >= 0 && ordersReadGuardStart > settingsReadGuardStart
  ? app.slice(settingsReadGuardStart, ordersReadGuardStart)
  : "";
const ordersReadGuard = ordersReadGuardStart >= 0 && postOrdersReadStart > ordersReadGuardStart
  ? app.slice(ordersReadGuardStart, postOrdersReadStart)
  : "";
const pendingSyncStart = app.indexOf("function syncPendingData(options = {})");
const pendingSyncEnd = app.indexOf("async function signInWithEmail()", pendingSyncStart);
const pendingSyncBlock = pendingSyncStart >= 0 && pendingSyncEnd > pendingSyncStart
  ? app.slice(pendingSyncStart, pendingSyncEnd)
  : "";
const pendingOrderLoopStart = pendingSyncBlock.indexOf("for (const order of pendingOrders)");
const pendingOrderLoopEnd = pendingSyncBlock.indexOf("if (pendingOrderSyncError)", pendingOrderLoopStart);
const pendingOrderLoop = pendingOrderLoopStart >= 0 && pendingOrderLoopEnd > pendingOrderLoopStart
  ? pendingSyncBlock.slice(pendingOrderLoopStart, pendingOrderLoopEnd)
  : "";

const publicProfileActiveStart = app.indexOf('typeof publicProfileRow?.active === "boolean"');
const profileFallbackStart = app.indexOf("applyRestaurantProfile(", settingsReadGuardStart);
const settingsWritesGuardStart = app.indexOf("if (!settingsError) {", settingsReadGuardStart + 1);
check(
  publicProfileActiveStart >= 0
    && publicProfileActiveStart < settingsReadGuardStart
    && profileFallbackStart > settingsReadGuardStart
    && profileFallbackStart < settingsWritesGuardStart
    && /storeConfirmedCloudSettings\([\s\S]*?settingsRow\.settings \|\| \{\}\s*\);\s*}\s*}\s*\/\*\s*\* Si existen ajustes locales pendientes/.test(settingsReadGuard)
    && settingsReadGuard.includes("Boolean(!settingsError && settingsRow)"),
  "settings 503 conserva perfiles publicos validos sin confirmar settingsRow"
);

check(
  ordersReadGuard.includes("savedOrders = mergeOrders(normalizedCloudOrders, localPendingOrders)")
    && ordersReadGuard.includes("saveOrders()"),
  "orders 503 conserva savedOrders locales"
);
check(
  settingsReadGuard.includes("await saveCloudSettings()"),
  "settings 503 no ejecuta saveCloudSettings automaticamente"
);
check(
  settingsReadGuard.includes("await saveCloudMenu()"),
  "settings 503 no ejecuta saveCloudMenu automaticamente"
);
check(
  /await saveCloudMenu\(\);\s*clearMenuPending\(menuPendingToken\);/s.test(pendingSyncBlock),
  "menuPending solo se limpia tras confirmacion"
);
check(
  /await saveCloudSettings\(\);\s*clearSettingsPending\(settingsPendingToken\);/s.test(pendingSyncBlock),
  "settingsPending solo se limpia tras confirmacion"
);
check(
  /await setCloudNextTicket\(shouldSyncTicketCounter\);\s*clearPendingTicketCounter\(shouldSyncTicketCounter\);/s.test(pendingSyncBlock)
    && app.includes("pendingTicketCounter() !== expectedValue"),
  "ticketCounterPending solo se limpia tras confirmacion"
);
check(
  /const expectedUpdatedAt = order\.updatedAt;\s*await saveCloudOrder\(order\);\s*confirmOrderSyncedIfUnchanged\(order\.id, expectedUpdatedAt\);/s.test(pendingOrderLoop),
  "pedido pendiente conserva estado si falla saveCloudOrder"
);
check(
  app.includes('setOrderSyncStatus(orderId, "synced")')
    && app.includes("currentSavedOrder.updatedAt !== expectedUpdatedAt"),
  "pedido confirmado pasa a synced"
);
check(
  /if \(pendingDataSyncInFlight\)[\s\S]*?return pendingDataSyncInFlight;/.test(pendingSyncBlock),
  "syncPendingData es single-flight"
);
check(
  pendingSyncBlock.includes("pendingDataSyncRequested &&")
    && pendingSyncBlock.includes("hasPendingDataToSync() &&"),
  "llamada simultanea no programa otra ronda vacia"
);
check(
  pendingOrderLoop.includes("if (isTemporarySyncInfrastructureError(error)) break;")
    && pendingSyncBlock.includes("SYNC_INFRASTRUCTURE_BACKOFF_MS"),
  "error general 503 corta la ronda y aplica backoff"
);
check(
  pendingOrderLoop.includes("if (!pendingOrderSyncError) pendingOrderSyncError = error;")
    && pendingOrderLoop.includes("if (isTemporarySyncInfrastructureError(error)) break;"),
  "fallo logico aislado no borra otros pendientes"
);
check(
  ordersReadGuard.startsWith("if (!ordersError) {")
    && !ordersReadGuard.includes("if (ordersError)"),
  "lectura fallida no se interpreta como lista vacia confirmada"
);

const temporaryErrorClassifierStart = app.indexOf("function isTemporarySyncInfrastructureError(error)");
const temporaryErrorClassifierEnd = app.indexOf("function needsCloudSync", temporaryErrorClassifierStart);
const temporaryErrorClassifierSource = temporaryErrorClassifierStart >= 0 && temporaryErrorClassifierEnd > temporaryErrorClassifierStart
  ? app.slice(temporaryErrorClassifierStart, temporaryErrorClassifierEnd)
  : "";
try {
  const classifyTemporaryError = Function(`${temporaryErrorClassifierSource}; return isTemporarySyncInfrastructureError;`)();
  check(classifyTemporaryError({ status: 503 }), "clasifica HTTP 503 como infraestructura temporal");
  check(classifyTemporaryError({ code: "PGRST002" }), "clasifica PGRST002 como infraestructura temporal");
  check(classifyTemporaryError({ code: "PGRST003" }), "clasifica PGRST003 como infraestructura temporal");
  check(classifyTemporaryError(new Error("schema cache unavailable")), "clasifica schema cache como infraestructura temporal");
  check(classifyTemporaryError(new Error("connection pool timeout")), "clasifica timeout de pool como infraestructura temporal");
  check(classifyTemporaryError(new Error("Failed to fetch")), "clasifica fallo de red como infraestructura temporal");
  check(!classifyTemporaryError({ code: "42501", message: "permission denied" }), "no oculta error logico o de permisos");
} catch {
  check(false, "clasificador de errores temporales ejecutable");
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}
console.log("RC ORDERA V91.0.3 QA: comprobaciones aprobadas.");
