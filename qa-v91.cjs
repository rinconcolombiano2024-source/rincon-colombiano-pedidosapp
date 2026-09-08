const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const customer = read("cliente.js");
const courier = read("colaborador.js");
const waiter = read("mesero.js");
const migration = read("MIGRACION-V91-01-RENDIMIENTO-INTEGRIDAD-Y-CIERRES.sql");
const stationContractMigration = read("MIGRACION-V91-03-CONTRATO-MULTIESTACION-Y-REALTIME.sql");
const syncLoadMigration = read("MIGRACION-V91-04-CONTROL-CARGA-SINCRONIZACION.sql");
const syncContractMigration = read("MIGRACION-V91-07-CONTRATO-COMPATIBILIDAD-SINCRONIZACION.sql");
const marketplaceCheckout = read("supabase/functions/marketplace-checkout/index.ts");
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
check(/rpc\(\s*"get_rc_ordera_sync_contract"/.test(app), "frontend verifica contrato de sincronizacion");
check(/MINIMUM_SYNC_CONTRACT_VERSION\s*=\s*7\b/.test(app), "frontend exige contrato 7");
check(!syncContractMigration.includes("V91-08") && syncContractMigration.includes("array['orders', 'customer_order_messages']") && syncContractMigration.includes("alter publication supabase_realtime add table public.%I"), "contrato 7 instala publicaciones sin V91-08");
check(app.includes('"RC_ORDERA_SCHEMA_OUTDATED", "RC_ORDERA_SCHEMA_INCOMPLETE"'), "carga inicial bloquea esquema incompleto");
check(syncContractMigration.includes("get_rc_ordera_sync_contract"), "RPC de contrato de sincronizacion disponible");
check(syncContractMigration.includes("missing_components"), "contrato informa componentes faltantes");
check(syncContractMigration.includes("jsonb_object_length") && syncContractMigration.includes("v_groups <> ''{}''::jsonb"), "contrato distingue correccion V91-06");
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
check(/finally\s*\{[\s\S]*?cloudState\.loading\s*=\s*false;[\s\S]*?updateCloudStatus\(\);[\s\S]*?\}/s.test(app), "estado de nube siempre finaliza");
check(app.includes("withCloudTimeout(cloudState.client.auth.getSession())"), "sesion de nube con tiempo maximo");
check(app.includes("await withCloudTimeout(ensureMinimumDatabaseVersion())"), "version de nube con tiempo maximo");
check(
  /const settingsResponse\s*=\s*await withCloudTimeout\([\s\S]*?settingsRequest[\s\S]*?8000[\s\S]*?\.catch/s.test(app)
    && /Promise\.all\(\[[\s\S]*?withCloudTimeout\([\s\S]*?profileRequest[\s\S]*?withCloudTimeout\([\s\S]*?ordersRequest/s.test(app),
  "carga inicial de nube con tiempo maximo"
);
check(customer.includes("const requestedStoreId = customerStoreId;"), "menu conserva el restaurante solicitado");
check(customer.includes("if (requestedStoreId !== customerStoreId) return;"), "respuesta tardia no reemplaza otro menu");
check(/function saveMenuCatalog\(\)\s*\{[\s\S]*?markMenuPending\(\);[\s\S]*?saveMenuCache\(\{ immediate: true \}\);/.test(app), "menu local protegido antes de sincronizar");
check(app.includes("remoteMenuHasNewerRevision") && app.includes("protectLocalMenuFromEmptyCloud"), "menu vacio confirmado conserva su revision de nube");
check(customer.includes("customerReadMenuCache(requestedStoreId)"), "cliente recupera el menu publico cuando falla la nube");
check(app.includes("anulacion(es) antigua(s)") && app.includes("order not found"), "cola antigua no queda pendiente para siempre");
check(waiter.includes('code === "PGRST002"') && waiter.includes('code === "PGRST003"') && waiter.includes("status === 503"), "mesero conserva pedidos ante fallos temporales de Supabase");
check(waiter.includes("remaining.push(...queue.slice(index + 1))"), "mesero corta la ronda de cola tras un fallo temporal");
check(waiter.includes('if (!confirmedOrder?.id)'), "mesero solo confirma pedidos con respuesta real del servidor");
check(waiter.includes('waiterOrdersRealtimeStatus === "SUBSCRIBED"') && waiter.includes("WAITER_STATION_POLL_MAX_MS"), "estaciones sondean solo como respaldo de Realtime");
check(!waiter.includes("window.setInterval(() => waiterLoadStationOrders"), "estaciones no mantienen sondeo fijo con Realtime activo");
check(waiter.includes("waiterMenuLoadInFlight") && waiter.includes("waiterStationLoadInFlight") && waiter.includes("waiterSentOrdersLoadInFlight"), "mesero evita lecturas simultaneas duplicadas");
check(app.includes('centralSyncChannel &&') && app.includes('clientOrdersChannel &&'), "recuperacion no reinicia canales Realtime sanos");
check(app.includes('.from("customer_orders")') && app.includes("publicationByRestaurantOrderId") && app.includes("publicationRow?.id"), "pedido pendiente exige publicacion confirmada para estaciones");
check(courier.includes("courierDeliveryRealtimeRetryDelay") && courier.includes("courierScheduleDeliveryRealtimeReconnect"), "colaborador reconecta Realtime con backoff");
check(!/courierLoadDeliveryOffers\(\{ silent: true \}\);\s*if \(courierAvailable && courierLastLocation\)/s.test(courier), "polling de ofertas no duplica escritura GPS");
check(syncLoadMigration.includes("created_at >= now() - interval '24 hours'") && syncLoadMigration.includes("interval '2 minutes'"), "cola de domicilios limita antiguedad y frecuencia");
check(syncLoadMigration.includes("cron.alter_job") && !syncLoadMigration.includes("active => true"), "ajuste cron conserva su estado activo o inactivo");
check(stationContractMigration.includes("get_my_restaurant_stations"), "contrato multiestacion disponible en SQL");
check(stationContractMigration.includes("list_my_station_orders(uuid, text)"), "lectura de estacion acepta la estacion seleccionada");
check(stationContractMigration.includes("update_my_station_order(uuid, uuid, text, text)"), "avance de estacion acepta la estacion seleccionada");
check(stationContractMigration.includes("alter publication supabase_realtime add table public.customer_orders"), "pedidos de cliente publicados en Realtime");
check(stationContractMigration.includes("v_is_custom") && stationContractMigration.includes("'custom', v_is_custom"), "producto especial de mesero validado en servidor");
check(stationContractMigration.includes("v_product->>'price'") && stationContractMigration.includes("v_product->>'station'"), "producto normal conserva precio y estacion del menu confiable");
check(marketplaceCheckout.includes("const unfinishedAttempt") && marketplaceCheckout.includes("unfinishedAttempt?.idempotency_key"), "checkout reutiliza intentos pendientes sin crear otra sesion pagable");
check(marketplaceCheckout.includes('attempt.status === "pending" && !attempt.checkout_url'), "checkout recupera una sesion no persistida");

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
const pendingOrderLoopStart = pendingSyncBlock.indexOf("for (const order of pendingOrdersToUpload)");
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
  /await saveCloudMenu\(\);[\s\S]*?clearMenuPending\(\s*menuPendingToken\s*\)/s.test(pendingSyncBlock),
  "menuPending solo se limpia tras confirmacion"
);
check(
  /await saveCloudSettings\(\);[\s\S]*?clearSettingsPending\(\s*settingsPendingToken\s*\)/s.test(pendingSyncBlock),
  "settingsPending solo se limpia tras confirmacion"
);
check(
  /await setCloudNextTicket\(\s*shouldSyncTicketCounter\s*\);[\s\S]*?clearPendingTicketCounter\(\s*shouldSyncTicketCounter\s*\)/s.test(pendingSyncBlock)
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
  /if\s*\(isTemporarySyncInfrastructureError\(error\)\)\s*\{[\s\S]*?break;/.test(pendingOrderLoop)
    && pendingSyncBlock.includes("SYNC_INFRASTRUCTURE_BACKOFF_MS"),
  "error general 503 corta la ronda y aplica backoff"
);
const centralRealtimeReconnectStart = app.indexOf("function scheduleCentralRealtimeReconnect()");
const centralRealtimeStart = app.indexOf("function startCentralRealtime()", centralRealtimeReconnectStart);
const clientRealtimeReconnectStart = app.indexOf("function scheduleClientOrdersRealtimeReconnect()", centralRealtimeStart);
const centralRealtimeReconnectBlock = centralRealtimeReconnectStart >= 0 && centralRealtimeStart > centralRealtimeReconnectStart
  ? app.slice(centralRealtimeReconnectStart, centralRealtimeStart)
  : "";
const centralRealtimeSubscribeBlock = centralRealtimeStart >= 0 && clientRealtimeReconnectStart > centralRealtimeStart
  ? app.slice(centralRealtimeStart, clientRealtimeReconnectStart)
  : "";
check(
  app.includes("const CENTRAL_REALTIME_RECONNECT_MIN_MS = 1_500;")
    && app.includes("const CENTRAL_REALTIME_RECONNECT_MAX_MS = 60_000;")
    && centralRealtimeReconnectBlock.includes("const retryDelay = centralRealtimeReconnectDelay;")
    && centralRealtimeReconnectBlock.includes("retryDelay * 2")
    && centralRealtimeReconnectBlock.includes("CENTRAL_REALTIME_RECONNECT_MAX_MS")
    && centralRealtimeReconnectBlock.includes("}, retryDelay);")
    && !centralRealtimeReconnectBlock.includes("}, 1500);"),
  "Realtime central aplica backoff exponencial"
);
check(
  /centralRealtimeReconnectDelay\s*=\s*CENTRAL_REALTIME_RECONNECT_MIN_MS;/.test(centralRealtimeSubscribeBlock)
    && centralRealtimeSubscribeBlock.includes('status === "SUBSCRIBED"')
    && /scheduleCentralRefresh\(\{[\s\S]*?settings: true,[\s\S]*?profile: true,[\s\S]*?orders: true,/s.test(centralRealtimeSubscribeBlock),
  "Realtime central recupera datos y reinicia backoff al reconectar"
);
check(
  /if\s*\(!pendingOrderSyncError\)\s*\{?\s*pendingOrderSyncError\s*=\s*error;/.test(pendingOrderLoop)
    && /if\s*\(isTemporarySyncInfrastructureError\(error\)\)\s*\{[\s\S]*?break;/.test(pendingOrderLoop),
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
