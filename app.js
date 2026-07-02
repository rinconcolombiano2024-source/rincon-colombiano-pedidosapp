const STORAGE_KEYS = {
  nextTicket: "rincon_colombiano_next_ticket",
  ticketDate: "rincon_colombiano_ticket_date",
  orders: "rincon_colombiano_orders",
  menu: "rincon_colombiano_menu",
  currencySymbol: "rincon_colombiano_currency_symbol",
  currencyPosition: "rincon_colombiano_currency_position",
  moneyFormat: "rincon_colombiano_money_format",
  settingsPending: "rincon_colombiano_settings_pending",
  cloudSession: "rincon_colombiano_cloud_session",
};

const DEFAULT_MENU_CATALOG = {
  Entradas: [
    { name: "Empanada colombiana", price: 2.5 },
    { name: "Arepa con queso", price: 4.5 },
    { name: "Patacon con hogao", price: 5.5 },
    { name: "Chicharron", price: 6.5 },
  ],
  "Platos principales": [
    { name: "Bandeja paisa", price: 17.99 },
    { name: "Sancocho de gallina", price: 15.99 },
    { name: "Ajiaco santafereño", price: 15.5 },
    { name: "Sobrebarriga criolla", price: 16.99 },
    { name: "Arroz con pollo", price: 13.99 },
    { name: "Carne asada", price: 16.5 },
  ],
  Bebidas: [
    { name: "Limonada natural", price: 4 },
    { name: "Jugo de maracuya", price: 4.5 },
    { name: "Jugo de mora", price: 4.5 },
    { name: "Cafe colombiano", price: 2.5 },
  ],
  Postres: [
    { name: "Tres leches", price: 5.5 },
    { name: "Flan casero", price: 4.5 },
    { name: "Arroz con leche", price: 4 },
  ],
  Extras: [
    { name: "Arroz extra", price: 3 },
    { name: "Aguacate", price: 3.5 },
    { name: "Tostones extra", price: 4 },
    { name: "Salsa aparte", price: 0 },
  ],
  Porciones: [
    { name: "Porcion de arroz", price: 3 },
    { name: "Porcion de frijoles", price: 4 },
    { name: "Porcion de ensalada", price: 3 },
    { name: "Porcion de maduro", price: 3.5 },
  ],
};

const elements = {
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  signInButton: document.querySelector("#signInButton"),
  signUpButton: document.querySelector("#signUpButton"),
  resetPasswordButton: document.querySelector("#resetPasswordButton"),
  passwordRecoveryPanel: document.querySelector("#passwordRecoveryPanel"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  updatePasswordButton: document.querySelector("#updatePasswordButton"),
  cancelRecoveryButton: document.querySelector("#cancelRecoveryButton"),
  authMessage: document.querySelector("#authMessage"),
  cloudStatus: document.querySelector("#cloudStatus"),
  openSignInButton: document.querySelector("#openSignInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  nextTicketLabel: document.querySelector("#nextTicketLabel"),
  categoryTabs: document.querySelector("#categoryTabs"),
  menuGrid: document.querySelector("#menuGrid"),
  customItemForm: document.querySelector("#customItemForm"),
  customItemName: document.querySelector("#customItemName"),
  customItemPrice: document.querySelector("#customItemPrice"),
  clearOrderButton: document.querySelector("#clearOrderButton"),
  activeTicketTitle: document.querySelector("#activeTicketTitle"),
  orderStatus: document.querySelector("#orderStatus"),
  orderType: document.querySelector("#orderType"),
  customerName: document.querySelector("#customerName"),
  serverName: document.querySelector("#serverName"),
  lineItems: document.querySelector("#lineItems"),
  orderNotes: document.querySelector("#orderNotes"),
  orderTotal: document.querySelector("#orderTotal"),
  newOrderButton: document.querySelector("#newOrderButton"),
  saveOrderButton: document.querySelector("#saveOrderButton"),
  printOrderButton: document.querySelector("#printOrderButton"),
  historyList: document.querySelector("#historyList"),
  printTicket: document.querySelector("#printTicket"),
  counterButton: document.querySelector("#counterButton"),
  counterDialog: document.querySelector("#counterDialog"),
  counterInput: document.querySelector("#counterInput"),
  confirmCounterButton: document.querySelector("#confirmCounterButton"),
  itemNoteDialog: document.querySelector("#itemNoteDialog"),
  itemNoteTitle: document.querySelector("#itemNoteTitle"),
  itemNoteTextarea: document.querySelector("#itemNoteTextarea"),
  saveItemNoteButton: document.querySelector("#saveItemNoteButton"),
  customerButton: document.querySelector("#customerButton"),
  customerDialog: document.querySelector("#customerDialog"),
  customerDialogInput: document.querySelector("#customerDialogInput"),
  saveCustomerButton: document.querySelector("#saveCustomerButton"),
  monthlyCloseButton: document.querySelector("#monthlyCloseButton"),
  monthlyCloseDialog: document.querySelector("#monthlyCloseDialog"),
  closeMonthInput: document.querySelector("#closeMonthInput"),
  monthlyCloseContent: document.querySelector("#monthlyCloseContent"),
  printCloseButton: document.querySelector("#printCloseButton"),
  installAppButton: document.querySelector("#installAppButton"),
  installHelpDialog: document.querySelector("#installHelpDialog"),
  editMenuButton: document.querySelector("#editMenuButton"),
  menuEditorDialog: document.querySelector("#menuEditorDialog"),
  editorCategoryList: document.querySelector("#editorCategoryList"),
  categoryNameInput: document.querySelector("#categoryNameInput"),
  addCategoryButton: document.querySelector("#addCategoryButton"),
  renameCategoryButton: document.querySelector("#renameCategoryButton"),
  deleteCategoryButton: document.querySelector("#deleteCategoryButton"),
  activeProductCategoryLabel: document.querySelector("#activeProductCategoryLabel"),
  newProductButton: document.querySelector("#newProductButton"),
  productCategorySelect: document.querySelector("#productCategorySelect"),
  productNameInput: document.querySelector("#productNameInput"),
  productPriceInput: document.querySelector("#productPriceInput"),
  saveProductButton: document.querySelector("#saveProductButton"),
  cancelEditProductButton: document.querySelector("#cancelEditProductButton"),
  productList: document.querySelector("#productList"),
  resetMenuButton: document.querySelector("#resetMenuButton"),
  currencySymbolInput: document.querySelector("#currencySymbolInput"),
  currencyPositionSelect: document.querySelector("#currencyPositionSelect"),
  moneyFormatSelect: document.querySelector("#moneyFormatSelect"),
  saveCurrencyButton: document.querySelector("#saveCurrencyButton"),
};

let menuCatalog = readMenuCatalog();
let activeCategory = Object.keys(menuCatalog)[0];
let todayKey = currentBusinessDate();
let nextTicket = initializeDailyTicket();
let savedOrders = readOrders();
let currentOrder = createBlankOrder();
let deferredInstallPrompt = null;
let editingProduct = null;
let currencySymbol = readCurrencySymbol();
let currencyPosition = readCurrencyPosition();
let moneyFormat = readMoneyFormat();
let editingNoteItemId = null;
const cloudState = {
  client: null,
  configured: false,
  ready: false,
  user: null,
  loading: false,
  syncing: false,
  recoveringPassword: false,
};

function createBlankOrder() {
  return {
    id: null,
    ticketNumber: null,
    type: "Comer en el punto",
    customer: "",
    server: "",
    notes: "",
    items: [],
    createdAt: null,
    updatedAt: null,
    businessDate: todayKey,
    saved: false,
    syncStatus: "local",
  };
}

function currentBusinessDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initializeDailyTicket() {
  const storedDate = localStorage.getItem(STORAGE_KEYS.ticketDate);
  if (storedDate !== todayKey) {
    localStorage.setItem(STORAGE_KEYS.ticketDate, todayKey);
    localStorage.setItem(STORAGE_KEYS.nextTicket, "1");
    return 1;
  }

  return readNumber(STORAGE_KEYS.nextTicket, 1);
}

function saveTicketState() {
  localStorage.setItem(STORAGE_KEYS.ticketDate, todayKey);
  localStorage.setItem(STORAGE_KEYS.nextTicket, String(nextTicket));
}

function rollOverDayIfNeeded() {
  const latestDate = currentBusinessDate();
  if (latestDate === todayKey) return false;

  todayKey = latestDate;
  nextTicket = 1;
  saveTicketState();

  if (!currentOrder.saved) {
    currentOrder.ticketNumber = null;
    currentOrder.businessDate = todayKey;
  }

  return true;
}

function readNumber(key, fallback) {
  const value = Number.parseInt(localStorage.getItem(key), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || "[]");
    return Array.isArray(parsed)
      ? parsed.map((order) => ({
          ...order,
          type: normalizeOrderType(order.type),
          businessDate: orderBusinessDate(order),
          syncStatus: order.syncStatus || "synced",
        }))
      : [];
  } catch {
    return [];
  }
}

function orderBusinessDate(order) {
  if (order.businessDate) return order.businessDate;

  const created = new Date(order.createdAt);
  return Number.isNaN(created.getTime()) ? todayKey : currentBusinessDate(created);
}

function todaysOrders() {
  return savedOrders.filter((order) => orderBusinessDate(order) === todayKey);
}

function currentMonthKey(date = new Date()) {
  return currentBusinessDate(date).slice(0, 7);
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("es-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDayLabel(day) {
  const [year, monthNumber, dayNumber] = day.split("-").map(Number);
  return new Date(year, monthNumber - 1, dayNumber).toLocaleDateString("es-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
}

function ordersForMonth(month) {
  return savedOrders.filter((order) => orderBusinessDate(order).startsWith(`${month}-`));
}

function buildMonthlyClose(month) {
  const monthOrders = ordersForMonth(month);
  const days = new Map();
  const products = new Map();

  monthOrders.forEach((order) => {
    const day = orderBusinessDate(order);
    const dayRecord = days.get(day) || { day, tickets: 0, items: 0, total: 0 };
    const orderItems = order.items.reduce((count, item) => count + item.qty, 0);
    const total = orderTotal(order);

    dayRecord.tickets += 1;
    dayRecord.items += orderItems;
    dayRecord.total += total;
    days.set(day, dayRecord);

    order.items.forEach((item) => {
      const key = item.name.toLowerCase();
      const product = products.get(key) || { name: item.name, qty: 0, total: 0 };
      product.qty += item.qty;
      product.total += item.qty * item.price;
      products.set(key, product);
    });
  });

  const total = monthOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const items = monthOrders.reduce(
    (sum, order) => sum + order.items.reduce((count, item) => count + item.qty, 0),
    0
  );

  return {
    month,
    label: formatMonthLabel(month),
    tickets: monthOrders.length,
    items,
    total,
    average: monthOrders.length ? total / monthOrders.length : 0,
    days: Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day)),
    products: Array.from(products.values()).sort((a, b) => b.qty - a.qty || b.total - a.total),
  };
}

function saveOrders() {
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(savedOrders.slice(0, 5000)));
}

function hasKnownCloudSession() {
  return localStorage.getItem(STORAGE_KEYS.cloudSession) === "1";
}

function rememberCloudSession(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.cloudSession, "1");
  }
}

function clearRememberedCloudSession() {
  localStorage.removeItem(STORAGE_KEYS.cloudSession);
}

function shouldQueueForCloud() {
  return cloudState.configured && (Boolean(cloudState.user) || hasKnownCloudSession());
}

function needsCloudSync(order) {
  return Boolean(order?.saved && order.syncStatus === "pending");
}

function pendingOrdersCount() {
  return savedOrders.filter(needsCloudSync).length;
}

function hasPendingSettings() {
  return localStorage.getItem(STORAGE_KEYS.settingsPending) === "1";
}

function markSettingsPending() {
  if (cloudState.configured) localStorage.setItem(STORAGE_KEYS.settingsPending, "1");
}

function clearSettingsPending() {
  localStorage.removeItem(STORAGE_KEYS.settingsPending);
}

function setOrderSyncStatus(orderId, status) {
  savedOrders = savedOrders.map((order) => (order.id === orderId ? { ...order, syncStatus: status } : order));
  if (currentOrder.id === orderId) currentOrder.syncStatus = status;
}

function mergeOrders(cloudOrders, localOrders) {
  const ordersById = new Map();
  [...cloudOrders, ...localOrders].forEach((order) => {
    if (!order?.id) return;
    const current = ordersById.get(order.id);
    if (!current || needsCloudSync(order) || new Date(order.updatedAt || 0) > new Date(current.updatedAt || 0)) {
      ordersById.set(order.id, {
        ...order,
        type: normalizeOrderType(order.type),
        businessDate: orderBusinessDate(order),
      });
    }
  });

  return Array.from(ordersById.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function supabaseConfig() {
  const config = window.RINCON_SUPABASE || {};
  const rawUrl = String(config.url || "").trim();
  let cleanUrl = rawUrl;

  try {
    const parsed = new URL(rawUrl);
    cleanUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    cleanUrl = rawUrl.replace(/\/rest\/v1\/?.*$/i, "").replace(/\/+$/, "");
  }

  return {
    url: cleanUrl,
    anonKey: String(config.anonKey || "").trim(),
  };
}

function hasSupabaseConfig() {
  const config = supabaseConfig();
  return config.url.startsWith("http") && config.anonKey.length > 20;
}

function currentSettingsPayload() {
  return {
    currencySymbol,
    currencyPosition,
    moneyFormat,
  };
}

function applySettingsPayload(settings = {}) {
  currencySymbol = settings.currencySymbol || currencySymbol || "$";
  currencyPosition = settings.currencyPosition === "after" ? "after" : "before";
  moneyFormat = settings.moneyFormat === "eu" ? "eu" : "us";
  localStorage.setItem(STORAGE_KEYS.currencySymbol, currencySymbol);
  localStorage.setItem(STORAGE_KEYS.currencyPosition, currencyPosition);
  localStorage.setItem(STORAGE_KEYS.moneyFormat, moneyFormat);
}

function updateCloudStatus(message = "") {
  if (!cloudState.configured) {
    elements.cloudStatus.textContent = "Modo local";
    return;
  }

  if (message) {
    elements.cloudStatus.textContent = message;
    return;
  }

  const pending = pendingOrdersCount();
  if (!navigator.onLine) {
    elements.cloudStatus.textContent = pending ? `Sin internet (${pending} pendientes)` : "Sin internet";
    return;
  }

  if (pending || hasPendingSettings()) {
    elements.cloudStatus.textContent = pending ? `Pendiente nube (${pending})` : "Pendiente nube";
    return;
  }

  elements.cloudStatus.textContent = cloudState.user ? "Sincronizado" : "Iniciar sesion";
}

function renderCloudState(message = "") {
  if (!cloudState.configured) {
    elements.authScreen.hidden = true;
    elements.openSignInButton.hidden = true;
    elements.signOutButton.hidden = true;
    updateCloudStatus();
    return;
  }

  const canWorkOffline = !cloudState.user && hasKnownCloudSession() && !navigator.onLine;
  elements.authScreen.hidden = cloudState.recoveringPassword ? false : Boolean(cloudState.user) || canWorkOffline;
  elements.openSignInButton.hidden = Boolean(cloudState.user) || cloudState.recoveringPassword;
  elements.signOutButton.hidden = !cloudState.user;
  updateCloudStatus(canWorkOffline ? "" : message);
  elements.authMessage.textContent = message;
}

function openSignInScreen() {
  if (!cloudState.configured) {
    alert("La nube no esta configurada todavia.");
    return;
  }
  hidePasswordRecoveryForm();
  elements.authScreen.hidden = false;
  elements.authEmail.focus();
}

function loadSupabaseLibrary() {
  if (window.supabase?.createClient) return Promise.resolve(true);
  if (!navigator.onLine) return Promise.resolve(false);

  return new Promise((resolve) => {
    const existingScript = document.querySelector("script[data-supabase-loader]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(Boolean(window.supabase?.createClient)), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.dataset.supabaseLoader = "true";
    script.addEventListener("load", () => resolve(Boolean(window.supabase?.createClient)), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
}

async function initializeCloud() {
  cloudState.configured = hasSupabaseConfig();
  if (!cloudState.configured) {
    renderCloudState();
    return;
  }

  if (!window.supabase?.createClient && !(await loadSupabaseLibrary())) {
    renderCloudState(hasKnownCloudSession() ? "" : "No se pudo cargar Supabase. Revisa la conexion a internet.");
    return;
  }

  const config = supabaseConfig();
  cloudState.client = window.supabase.createClient(config.url, config.anonKey);
  const { data, error } = await cloudState.client.auth.getSession();
  if (error) throw error;
  cloudState.user = data.session?.user || null;
  if (cloudState.user) rememberCloudSession(cloudState.user);
  renderCloudState();

  cloudState.client.auth.onAuthStateChange(async (event, session) => {
    cloudState.user = session?.user || null;
    if (cloudState.user) rememberCloudSession(cloudState.user);
    if (event === "PASSWORD_RECOVERY") {
      showPasswordRecoveryForm();
      return;
    }
    renderCloudState();
    if (cloudState.user) await loadCloudData();
  });

  if (cloudState.user) await loadCloudData();
}

async function loadCloudData() {
  if (!cloudState.client || !cloudState.user || cloudState.loading) return;
  cloudState.loading = true;
  elements.cloudStatus.textContent = "Cargando nube...";
  const localOrdersBeforeLoad = savedOrders.map(structuredCloneOrder);
  const localPendingOrders = localOrdersBeforeLoad.filter(needsCloudSync);
  const localSettingsPending = hasPendingSettings();

  try {
    const { data: settingsRow, error: settingsError } = await cloudState.client
      .from("app_settings")
      .select("menu, settings")
      .eq("user_id", cloudState.user.id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (settingsRow && !localSettingsPending) {
      menuCatalog = normalizeMenuCatalog(settingsRow.menu || DEFAULT_MENU_CATALOG);
      localStorage.setItem(STORAGE_KEYS.menu, JSON.stringify(menuCatalog));
      applySettingsPayload(settingsRow.settings || {});
    } else if (!settingsRow || localSettingsPending) {
      await saveCloudSettings();
      clearSettingsPending();
    }

    const { data: cloudOrders, error: ordersError } = await cloudState.client
      .from("orders")
      .select("order_json")
      .eq("user_id", cloudState.user.id)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (ordersError) throw ordersError;

    const normalizedCloudOrders = (cloudOrders || []).map((row) => ({
      ...row.order_json,
      type: normalizeOrderType(row.order_json?.type),
      businessDate: orderBusinessDate(row.order_json),
      syncStatus: "synced",
    }));
    savedOrders = mergeOrders(normalizedCloudOrders, localPendingOrders);
    saveOrders();

    todayKey = currentBusinessDate();
    const { data: counterRow, error: counterError } = await cloudState.client
      .from("ticket_counters")
      .select("next_ticket")
      .eq("user_id", cloudState.user.id)
      .eq("business_date", todayKey)
      .maybeSingle();

    if (counterError) throw counterError;
    nextTicket = counterRow?.next_ticket || 1;
    saveTicketState();

    currentOrder = createBlankOrder();
    renderCurrencySettings();
    renderCategories();
    renderMenu();
    renderOrder();
    renderHistory();
    cloudState.ready = true;
    await syncPendingData({ silent: true, allowWhileLoading: true });
    updateCloudStatus();
  } catch (error) {
    console.error(error);
    updateCloudStatus(navigator.onLine ? "Error nube" : "");
    elements.authMessage.textContent = error.message || "No se pudo cargar la informacion.";
  } finally {
    cloudState.loading = false;
  }
}

async function saveCloudSettings() {
  if (!cloudState.client || !cloudState.user) return;

  const { error } = await cloudState.client.from("app_settings").upsert({
    user_id: cloudState.user.id,
    menu: normalizeMenuCatalog(menuCatalog),
    settings: currentSettingsPayload(),
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

async function claimCloudTicket() {
  if (!cloudState.client || !cloudState.user) return null;

  const { data, error } = await cloudState.client.rpc("claim_next_ticket", {
    p_business_date: todayKey,
  });

  if (error) throw error;
  return data;
}

async function setCloudNextTicket(number) {
  if (!cloudState.client || !cloudState.user) return;

  const { error } = await cloudState.client.rpc("set_next_ticket", {
    p_business_date: todayKey,
    p_next_ticket: number,
  });

  if (error) throw error;
}

async function saveCloudOrder(order) {
  if (!cloudState.client || !cloudState.user || !order.saved) return;

  const orderForCloud = structuredCloneOrder(order);
  orderForCloud.syncStatus = "synced";

  const { error } = await cloudState.client.from("orders").upsert({
    id: order.id,
    user_id: cloudState.user.id,
    ticket_number: order.ticketNumber,
    business_date: orderBusinessDate(order),
    order_json: orderForCloud,
    total: orderTotal(order),
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  });

  if (error) throw error;
}

async function advanceCloudTicketCounter(minimumNextTicket) {
  if (!cloudState.client || !cloudState.user || !Number.isFinite(minimumNextTicket)) return;

  const { data, error } = await cloudState.client
    .from("ticket_counters")
    .select("next_ticket")
    .eq("user_id", cloudState.user.id)
    .eq("business_date", todayKey)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.next_ticket < minimumNextTicket) {
    await setCloudNextTicket(minimumNextTicket);
  }
}

async function syncPendingData(options = {}) {
  const { silent = false, allowWhileLoading = false } = options;
  if (!cloudState.client || !cloudState.user || cloudState.syncing || !navigator.onLine) {
    updateCloudStatus();
    return;
  }
  if (cloudState.loading && !allowWhileLoading) return;

  const pendingOrders = savedOrders.filter(needsCloudSync);
  const shouldSyncSettings = hasPendingSettings();
  if (!pendingOrders.length && !shouldSyncSettings) {
    updateCloudStatus();
    return;
  }

  cloudState.syncing = true;
  if (!silent) updateCloudStatus("Sincronizando...");

  try {
    if (shouldSyncSettings) {
      await saveCloudSettings();
      clearSettingsPending();
    }

    for (const order of pendingOrders) {
      await saveCloudOrder(order);
      setOrderSyncStatus(order.id, "synced");
      saveOrders();
    }

    const highestLocalTicketToday = savedOrders
      .filter((order) => orderBusinessDate(order) === todayKey)
      .reduce((highest, order) => Math.max(highest, Number(order.ticketNumber) || 0), 0);
    const minimumNextTicket = Math.max(nextTicket, highestLocalTicketToday + 1);
    await advanceCloudTicketCounter(minimumNextTicket);
    nextTicket = minimumNextTicket;
    saveTicketState();
    saveOrders();
    renderOrder();
    renderHistory();
    updateCloudStatus();
  } catch (error) {
    console.error(error);
    saveOrders();
    updateCloudStatus();
  } finally {
    cloudState.syncing = false;
  }
}

async function signInWithEmail() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || !password) {
    elements.authMessage.textContent = "Escribe correo y contrasena.";
    return;
  }

  elements.authMessage.textContent = "Iniciando sesion...";
  try {
    const { error } = await cloudState.client.auth.signInWithPassword({ email, password });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
    return;
  }

  elements.authPassword.value = "";
}

async function signUpWithEmail() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || password.length < 6) {
    elements.authMessage.textContent = "Usa un correo y una contrasena de minimo 6 caracteres.";
    return;
  }

  elements.authMessage.textContent = "Creando cuenta...";
  try {
    const { error } = await cloudState.client.auth.signUp({ email, password });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
    return;
  }

  elements.authMessage.textContent = "Cuenta creada. Si Supabase pide confirmacion, revisa el correo.";
  elements.authPassword.value = "";
}

async function sendPasswordResetEmail() {
  const email = elements.authEmail.value.trim();
  if (!email) {
    elements.authMessage.textContent = "Escribe tu correo electronico para recuperar la contrasena.";
    elements.authEmail.focus();
    return;
  }

  if (!cloudState.client) {
    elements.authMessage.textContent = "No se pudo conectar con Supabase. Revisa internet.";
    return;
  }

  elements.authMessage.textContent = "Enviando correo de recuperacion...";
  const redirectTo = window.location.href.split("#")[0].split("?")[0];

  try {
    const { error } = await cloudState.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
    elements.authMessage.textContent = "Correo enviado. Abre el enlace para crear una contrasena nueva.";
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
  }
}

function showPasswordRecoveryForm() {
  cloudState.recoveringPassword = true;
  elements.passwordRecoveryPanel.hidden = false;
  elements.authPassword.closest("label").hidden = true;
  elements.signInButton.hidden = true;
  elements.signUpButton.hidden = true;
  elements.resetPasswordButton.hidden = true;
  renderCloudState("Escribe tu nueva contrasena.");
  elements.newPasswordInput.focus();
}

function hidePasswordRecoveryForm(message = "") {
  cloudState.recoveringPassword = false;
  elements.passwordRecoveryPanel.hidden = true;
  elements.newPasswordInput.value = "";
  elements.authPassword.closest("label").hidden = false;
  elements.signInButton.hidden = false;
  elements.signUpButton.hidden = false;
  elements.resetPasswordButton.hidden = false;
  renderCloudState(message);
}

async function updateRecoveredPassword() {
  const password = elements.newPasswordInput.value;
  if (password.length < 6) {
    elements.authMessage.textContent = "La nueva contrasena debe tener minimo 6 caracteres.";
    return;
  }

  if (!cloudState.client) {
    elements.authMessage.textContent = "No se pudo conectar con Supabase. Revisa internet.";
    return;
  }

  elements.authMessage.textContent = "Guardando nueva contrasena...";
  try {
    const { error } = await cloudState.client.auth.updateUser({ password });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
    hidePasswordRecoveryForm("Contrasena actualizada.");
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
  }
}

function friendlyAuthError(error) {
  const message = error?.message || String(error || "");
  if (message.toLowerCase().includes("invalid path specified")) {
    return "URL de Supabase incorrecta. Usa solo https://tu-proyecto.supabase.co, sin /rest/v1.";
  }

  return message;
}

async function signOut() {
  if (!cloudState.client) return;
  await cloudState.client.auth.signOut();
  cloudState.user = null;
  cloudState.ready = false;
  clearRememberedCloudSession();
  renderCloudState("Sesion cerrada.");
}

function readMenuCatalog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.menu) || "null");
    return normalizeMenuCatalog(parsed || DEFAULT_MENU_CATALOG);
  } catch {
    return normalizeMenuCatalog(DEFAULT_MENU_CATALOG);
  }
}

function normalizeMenuCatalog(menu) {
  const normalized = {};

  Object.entries(menu || {}).forEach(([category, dishes]) => {
    const cleanCategory = category === "Fuertes" ? "Platos principales" : String(category || "").trim();
    if (!cleanCategory) return;
    if (!normalized[cleanCategory]) normalized[cleanCategory] = [];

    if (Array.isArray(dishes)) {
      dishes.forEach((dish) => {
        const name = String(dish?.name || "").trim();
        const price = Number.parseFloat(dish?.price) || 0;
        if (name) normalized[cleanCategory].push({ name, price });
      });
    }
  });

  Object.keys(DEFAULT_MENU_CATALOG).forEach((category) => {
    if (!normalized[category]) normalized[category] = [];
  });

  return normalized;
}

function saveMenuCatalog() {
  menuCatalog = normalizeMenuCatalog(menuCatalog);
  localStorage.setItem(STORAGE_KEYS.menu, JSON.stringify(menuCatalog));

  if (!menuCatalog[activeCategory]) {
    activeCategory = Object.keys(menuCatalog)[0] || "Entradas";
  }

  renderCategories();
  renderMenu();
  if (cloudState.user && navigator.onLine) {
    saveCloudSettings()
      .then(() => {
        clearSettingsPending();
        updateCloudStatus();
      })
      .catch((error) => {
        console.error(error);
        markSettingsPending();
        updateCloudStatus();
      });
  } else if (shouldQueueForCloud()) {
    markSettingsPending();
    updateCloudStatus();
  }
}

function saveSettingsWhenPossible() {
  if (cloudState.user && navigator.onLine) {
    saveCloudSettings()
      .then(() => {
        clearSettingsPending();
        updateCloudStatus();
      })
      .catch((error) => {
        console.error(error);
        markSettingsPending();
        updateCloudStatus();
      });
  } else if (shouldQueueForCloud()) {
    markSettingsPending();
    updateCloudStatus();
  }
}

function readCurrencySymbol() {
  return localStorage.getItem(STORAGE_KEYS.currencySymbol) || "$";
}

function readCurrencyPosition() {
  const position = localStorage.getItem(STORAGE_KEYS.currencyPosition);
  return position === "after" ? "after" : "before";
}

function readMoneyFormat() {
  const format = localStorage.getItem(STORAGE_KEYS.moneyFormat);
  return format === "eu" ? "eu" : "us";
}

function saveCurrencySymbol() {
  const symbol = elements.currencySymbolInput.value.trim() || "$";
  currencySymbol = symbol;
  currencyPosition = elements.currencyPositionSelect.value === "after" ? "after" : "before";
  moneyFormat = elements.moneyFormatSelect.value === "eu" ? "eu" : "us";
  localStorage.setItem(STORAGE_KEYS.currencySymbol, currencySymbol);
  localStorage.setItem(STORAGE_KEYS.currencyPosition, currencyPosition);
  localStorage.setItem(STORAGE_KEYS.moneyFormat, moneyFormat);
  renderCurrencySettings();
  renderMenu();
  renderOrder();
  renderHistory();
  if (elements.menuEditorDialog.open) renderMenuEditor();
  if (elements.monthlyCloseDialog.open) renderMonthlyClose(elements.closeMonthInput.value || currentMonthKey());
  saveSettingsWhenPossible();
}

function renderCurrencySettings() {
  elements.currencySymbolInput.value = currencySymbol;
  elements.currencyPositionSelect.value = currencyPosition;
  elements.moneyFormatSelect.value = moneyFormat;
}

function formatTicket(number) {
  return `#${String(number).padStart(4, "0")}`;
}

function formatMoney(amount) {
  const value = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const localized = moneyFormat === "eu" ? formatted.replaceAll(",", " ").replace(".", ",") : formatted;

  if (currencyPosition === "after") {
    return `${localized} ${currencySymbol}`;
  }

  const separator = /[A-Za-z0-9]$/.test(currencySymbol) ? " " : "";
  return `${currencySymbol}${separator}${localized}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function orderTotal(order = currentOrder) {
  return order.items.reduce((total, item) => total + item.qty * item.price, 0);
}

function normalizeOrderType(type) {
  if (type === "Mesa") return "Comer en el punto";
  if (type === "Para llevar" || type === "Domicilio" || type === "Comer en el punto") return type;
  return "Comer en el punto";
}

function syncFormToOrder() {
  currentOrder.type = normalizeOrderType(elements.orderType.value);
  currentOrder.customer = elements.customerName.value.trim();
  currentOrder.server = elements.serverName.value.trim();
  currentOrder.notes = elements.orderNotes.value.trim();
}

function renderCategories() {
  elements.categoryTabs.innerHTML = Object.keys(menuCatalog)
    .map(
      (category) => `
        <button
          type="button"
          role="tab"
          aria-selected="${category === activeCategory}"
          data-category="${escapeHtml(category)}"
        >${escapeHtml(category)}</button>
      `
    )
    .join("");
}

function renderMenu() {
  const dishes = menuCatalog[activeCategory] || [];
  if (!dishes.length) {
    elements.menuGrid.innerHTML = `<div class="empty-menu-category">No hay productos en esta categoria.</div>`;
    return;
  }

  elements.menuGrid.innerHTML = dishes
    .map(
      (dish) => `
        <button class="dish-button" type="button" data-name="${escapeHtml(dish.name)}" data-price="${dish.price}">
          <strong>${escapeHtml(dish.name)}</strong>
          <span>${formatMoney(dish.price)}</span>
        </button>
      `
    )
    .join("");
}

function renderMenuEditor() {
  const categories = Object.keys(menuCatalog);
  if (!categories.includes(activeCategory)) {
    activeCategory = categories[0] || "Entradas";
  }

  elements.categoryNameInput.value = activeCategory;
  elements.activeProductCategoryLabel.textContent = `Categoria: ${activeCategory}`;
  elements.editorCategoryList.innerHTML = categories
    .map(
      (category) => `
        <button
          class="editor-category-button"
          type="button"
          data-category="${escapeHtml(category)}"
          aria-selected="${category === activeCategory}"
        >
          <span>${escapeHtml(category)}</span>
          <span>${(menuCatalog[category] || []).length}</span>
        </button>
      `
    )
    .join("");

  elements.productCategorySelect.innerHTML = categories
    .map(
      (category) => `
        <option value="${escapeHtml(category)}" ${category === activeCategory ? "selected" : ""}>
          ${escapeHtml(category)}
        </option>
      `
    )
    .join("");

  renderProductList();
}

function renderProductList() {
  const products = menuCatalog[activeCategory] || [];

  if (!products.length) {
    elements.productList.innerHTML = `<div class="editor-empty">Esta categoria no tiene productos todavia.</div>`;
    return;
  }

  elements.productList.innerHTML = products
    .map(
      (product, index) => `
        <article class="product-row" data-index="${index}">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${formatMoney(product.price)}</span>
          <button type="button" data-action="edit-product">Editar</button>
          <button type="button" data-action="delete-product">Eliminar</button>
        </article>
      `
    )
    .join("");
}

function openMenuEditor() {
  editingProduct = null;
  clearProductForm();
  renderCurrencySettings();
  renderMenuEditor();
  elements.menuEditorDialog.showModal();
}

function selectEditorCategory(category) {
  if (!menuCatalog[category]) return;
  activeCategory = category;
  editingProduct = null;
  clearProductForm();
  renderCategories();
  renderMenu();
  renderMenuEditor();
}

function clearProductForm() {
  elements.productNameInput.value = "";
  elements.productPriceInput.value = "";
  elements.productCategorySelect.value = activeCategory;
  elements.saveProductButton.textContent = "Agregar producto";
  elements.cancelEditProductButton.hidden = true;
  editingProduct = null;
}

function startNewProduct() {
  clearProductForm();
  elements.productCategorySelect.value = activeCategory;
  elements.productNameInput.focus();
}

function addCategory() {
  const category = elements.categoryNameInput.value.trim();
  if (!category) {
    alert("Escribe el nombre de la categoria.");
    return;
  }

  if (menuCatalog[category]) {
    activeCategory = category;
  } else {
    menuCatalog[category] = [];
    activeCategory = category;
  }

  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
}

function renameCategory() {
  const newName = elements.categoryNameInput.value.trim();
  if (!newName) {
    alert("Escribe el nuevo nombre de la categoria.");
    return;
  }

  if (newName === activeCategory) return;
  if (menuCatalog[newName]) {
    alert("Ya existe una categoria con ese nombre.");
    return;
  }

  const renamed = {};
  Object.entries(menuCatalog).forEach(([category, products]) => {
    renamed[category === activeCategory ? newName : category] = products;
  });
  menuCatalog = renamed;
  activeCategory = newName;
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
}

function deleteCategory() {
  const categories = Object.keys(menuCatalog);
  if (categories.length <= 1) {
    alert("Debe quedar al menos una categoria.");
    return;
  }

  const shouldDelete = confirm(`Eliminar la categoria "${activeCategory}" y todos sus productos?`);
  if (!shouldDelete) return;

  delete menuCatalog[activeCategory];
  activeCategory = Object.keys(menuCatalog)[0];
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
}

function saveProduct() {
  const category = elements.productCategorySelect.value;
  const name = elements.productNameInput.value.trim();
  const price = Number.parseFloat(elements.productPriceInput.value) || 0;

  if (!category || !menuCatalog[category]) {
    alert("Selecciona una categoria.");
    return;
  }

  if (!name) {
    alert("Escribe el nombre del producto.");
    return;
  }

  const product = { name, price };

  if (editingProduct) {
    const oldList = menuCatalog[editingProduct.category] || [];
    oldList.splice(editingProduct.index, 1);
  }

  menuCatalog[category].push(product);
  activeCategory = category;
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
}

function editProduct(index) {
  const product = (menuCatalog[activeCategory] || [])[index];
  if (!product) return;

  editingProduct = { category: activeCategory, index };
  elements.productCategorySelect.value = activeCategory;
  elements.productNameInput.value = product.name;
  elements.productPriceInput.value = product.price;
  elements.saveProductButton.textContent = "Guardar cambios";
  elements.cancelEditProductButton.hidden = false;
  elements.productNameInput.focus();
}

function deleteProduct(index) {
  const product = (menuCatalog[activeCategory] || [])[index];
  if (!product) return;

  const shouldDelete = confirm(`Eliminar "${product.name}"?`);
  if (!shouldDelete) return;

  menuCatalog[activeCategory].splice(index, 1);
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
}

function resetMenu() {
  const shouldReset = confirm("Restaurar el menu base? Esto reemplaza las categorias y productos actuales.");
  if (!shouldReset) return;

  menuCatalog = normalizeMenuCatalog(DEFAULT_MENU_CATALOG);
  activeCategory = Object.keys(menuCatalog)[0];
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
}

function addItem(name, price) {
  const cleanName = String(name || "").trim();
  const cleanPrice = Number.parseFloat(price) || 0;
  if (!cleanName) return;

  const existing = currentOrder.items.find(
    (item) => item.name.toLowerCase() === cleanName.toLowerCase() && item.price === cleanPrice && !item.note
  );

  if (existing) {
    existing.qty += 1;
  } else {
    currentOrder.items.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name: cleanName,
      price: cleanPrice,
      qty: 1,
      note: "",
    });
  }

  markOrderChanged();
  renderOrder();
}

function markOrderChanged() {
  if (currentOrder.saved) {
    currentOrder.updatedAt = new Date().toISOString();
  }
}

function renderOrder() {
  currentOrder.type = normalizeOrderType(currentOrder.type);
  elements.nextTicketLabel.textContent = formatTicket(nextTicket);
  elements.activeTicketTitle.textContent = currentOrder.ticketNumber
    ? `Ticket ${formatTicket(currentOrder.ticketNumber)}`
    : "Ticket sin guardar";

  elements.orderStatus.textContent = currentOrder.saved
    ? needsCloudSync(currentOrder)
      ? "Pendiente nube"
      : "Guardado"
    : "Nuevo";
  elements.orderStatus.classList.toggle("saved", currentOrder.saved);
  elements.orderStatus.classList.toggle("pending", needsCloudSync(currentOrder));

  elements.orderType.value = normalizeOrderType(currentOrder.type);
  elements.customerName.value = currentOrder.customer;
  elements.serverName.value = currentOrder.server;
  elements.orderNotes.value = currentOrder.notes;
  elements.orderTotal.textContent = formatMoney(orderTotal());

  if (!currentOrder.items.length) {
    elements.lineItems.innerHTML = `<div class="empty-order">Toca un plato del menu para iniciar el pedido.</div>`;
  } else {
    elements.lineItems.innerHTML = currentOrder.items
      .map(
        (item) => `
          <article class="line-item" data-id="${escapeHtml(item.id)}">
            <div class="qty-controls" aria-label="Cantidad de ${escapeHtml(item.name)}">
              <button type="button" data-action="minus" aria-label="Restar">-</button>
              <input type="number" min="1" step="1" value="${item.qty}" data-action="qty" aria-label="Cantidad" />
              <button type="button" data-action="plus" aria-label="Sumar">+</button>
            </div>
            <div class="item-main">
              <div class="item-title">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="item-subtotal">${formatMoney(item.qty * item.price)}</span>
              </div>
              <div class="item-note-row">
                <input class="item-note" type="text" value="${escapeHtml(item.note)}" data-action="note" placeholder="Nota para este plato" />
                <button class="note-item-button" type="button" data-action="open-note">Nota</button>
              </div>
            </div>
            <button class="remove-item" type="button" data-action="remove" aria-label="Quitar">x</button>
          </article>
        `
      )
      .join("");
  }

  elements.saveOrderButton.disabled = currentOrder.items.length === 0;
  elements.printOrderButton.disabled = currentOrder.items.length === 0;
}

async function upsertCurrentOrder() {
  rollOverDayIfNeeded();
  syncFormToOrder();

  if (!currentOrder.items.length) {
    alert("Agrega al menos un producto antes de guardar.");
    return false;
  }

  const now = new Date().toISOString();
  const canTryCloud = Boolean(cloudState.user && navigator.onLine);

  if (!currentOrder.saved) {
    currentOrder.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    currentOrder.syncStatus = shouldQueueForCloud() ? "pending" : "local";

    if (canTryCloud) {
      try {
        currentOrder.ticketNumber = await claimCloudTicket();
        nextTicket = currentOrder.ticketNumber + 1;
      } catch (error) {
        console.error(error);
        currentOrder.ticketNumber = nextTicket;
        nextTicket += 1;
        currentOrder.syncStatus = shouldQueueForCloud() ? "pending" : "local";
        updateCloudStatus();
      }
    } else {
      currentOrder.ticketNumber = nextTicket;
      nextTicket += 1;
    }
    saveTicketState();
    currentOrder.createdAt = now;
    currentOrder.updatedAt = now;
    currentOrder.businessDate = todayKey;
    currentOrder.saved = true;
    savedOrders.unshift(structuredCloneOrder(currentOrder));
  } else {
    currentOrder.updatedAt = now;
    if (shouldQueueForCloud()) currentOrder.syncStatus = "pending";
    const index = savedOrders.findIndex((order) => order.id === currentOrder.id);
    if (index >= 0) savedOrders[index] = structuredCloneOrder(currentOrder);
  }

  if (canTryCloud) {
    try {
      await saveCloudOrder(currentOrder);
      currentOrder.syncStatus = "synced";
      setOrderSyncStatus(currentOrder.id, "synced");
      await advanceCloudTicketCounter(Math.max(nextTicket, Number(currentOrder.ticketNumber) + 1));
      updateCloudStatus();
    } catch (error) {
      console.error(error);
      currentOrder.syncStatus = shouldQueueForCloud() ? "pending" : "local";
      setOrderSyncStatus(currentOrder.id, currentOrder.syncStatus);
      updateCloudStatus();
    }
  } else if (shouldQueueForCloud()) {
    currentOrder.syncStatus = "pending";
    setOrderSyncStatus(currentOrder.id, "pending");
    updateCloudStatus();
  }

  saveOrders();
  saveTicketState();
  renderOrder();
  renderHistory();
  if (elements.monthlyCloseDialog.open) {
    renderMonthlyClose(elements.closeMonthInput.value || currentMonthKey());
  }
  return true;
}

function structuredCloneOrder(order) {
  return JSON.parse(JSON.stringify(order));
}

async function printCurrentOrder() {
  if (!(await upsertCurrentOrder())) return;
  renderPrintTicket(currentOrder);
  window.print();
}

function renderPrintTicket(order) {
  const created = new Date(order.createdAt);
  const dateText = created.toLocaleDateString("es-US");
  const timeText = created.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });
  const place = order.customer || "Sin mesa/cliente";
  const server = order.server || "No indicado";
  const orderType = normalizeOrderType(order.type);

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">RINCON COLOMBIANO</div>
    <div class="receipt-number">COCINA ${formatTicket(order.ticketNumber)}</div>
    <div class="receipt-order-type">TIPO DE PEDIDO<br>${escapeHtml(orderType).toUpperCase()}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>Tipo:</strong><span>${escapeHtml(orderType)}</span></div>
    <div class="receipt-row"><strong>Mesa/Cliente:</strong><span>${escapeHtml(place)}</span></div>
    <div class="receipt-row"><strong>Tomo pedido:</strong><span>${escapeHtml(server)}</span></div>
    <div class="receipt-row"><strong>Fecha:</strong><span>${escapeHtml(dateText)}</span></div>
    <div class="receipt-row"><strong>Hora:</strong><span>${escapeHtml(timeText)}</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-items">
      ${order.items
        .map(
          (item) => `
            <div class="receipt-item">
              <strong>${item.qty} x ${escapeHtml(item.name)}</strong>
              ${item.note ? `<div class="receipt-note">Nota: ${escapeHtml(item.note)}</div>` : ""}
            </div>
          `
        )
        .join("")}
    </div>
    ${
      order.notes
        ? `<div class="receipt-divider"></div><p><strong>Notas:</strong> ${escapeHtml(order.notes)}</p>`
        : ""
    }
    <div class="receipt-divider"></div>
    <p class="receipt-total">FIN DEL TICKET</p>
  `;
}

function renderHistory() {
  const ordersForToday = todaysOrders();

  if (!ordersForToday.length) {
    elements.historyList.innerHTML = `<div class="history-empty">Aun no hay tickets guardados en este turno.</div>`;
    return;
  }

  elements.historyList.innerHTML = ordersForToday
    .slice(0, 30)
    .map((order) => {
      const created = new Date(order.createdAt);
      const timeText = created.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });
      const itemCount = order.items.reduce((count, item) => count + item.qty, 0);
      return `
        <article class="history-item">
          <div class="history-title">
            <strong>${formatTicket(order.ticketNumber)}</strong>
            <span>${formatMoney(orderTotal(order))}</span>
          </div>
          <div class="history-meta">
            <span>${escapeHtml(normalizeOrderType(order.type))}</span>
            <span>${escapeHtml(timeText)}</span>
          </div>
          <div class="history-meta">
            <span>${escapeHtml(order.customer || "Sin mesa")}</span>
            <span>${itemCount} items</span>
          </div>
          ${needsCloudSync(order) ? `<div class="sync-badge">Pendiente nube</div>` : ""}
          <button type="button" data-history-id="${escapeHtml(order.id)}">Abrir / reimprimir</button>
        </article>
      `;
    })
    .join("");
}

function renderMonthlyClose(month = currentMonthKey()) {
  const report = buildMonthlyClose(month);
  elements.closeMonthInput.value = month;
  elements.printCloseButton.disabled = report.tickets === 0;

  if (!report.tickets) {
    elements.monthlyCloseContent.innerHTML = `
      <div class="monthly-empty">No hay pedidos guardados para ${escapeHtml(report.label)}.</div>
    `;
    return report;
  }

  elements.monthlyCloseContent.innerHTML = `
    <div class="monthly-summary-grid">
      <div class="monthly-metric">
        <span>Total vendido</span>
        <strong>${formatMoney(report.total)}</strong>
      </div>
      <div class="monthly-metric">
        <span>Tickets</span>
        <strong>${report.tickets}</strong>
      </div>
      <div class="monthly-metric">
        <span>Productos</span>
        <strong>${report.items}</strong>
      </div>
      <div class="monthly-metric">
        <span>Promedio</span>
        <strong>${formatMoney(report.average)}</strong>
      </div>
    </div>

    <h3 class="monthly-section-title">Detalle por dia</h3>
    <div class="monthly-table">
      <div class="monthly-table-row header">
        <span>Dia</span>
        <span>Tickets</span>
        <span>Items</span>
        <span>Total</span>
      </div>
      ${report.days
        .map(
          (day) => `
            <div class="monthly-table-row">
              <strong>${escapeHtml(formatDayLabel(day.day))}</strong>
              <span>${day.tickets}</span>
              <span>${day.items}</span>
              <strong>${formatMoney(day.total)}</strong>
            </div>
          `
        )
        .join("")}
    </div>

    <h3 class="monthly-section-title">Productos vendidos</h3>
    <div class="monthly-table">
      <div class="monthly-table-row header">
        <span>Producto</span>
        <span>Cantidad</span>
        <span></span>
        <span>Total</span>
      </div>
      ${report.products
        .map(
          (product) => `
            <div class="monthly-table-row">
              <strong>${escapeHtml(product.name)}</strong>
              <span>${product.qty}</span>
              <span></span>
              <strong>${formatMoney(product.total)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  return report;
}

function renderPrintMonthlyClose(report) {
  const printedAt = new Date();
  const dateText = printedAt.toLocaleDateString("es-US");
  const timeText = printedAt.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">RINCON COLOMBIANO</div>
    <div class="receipt-number">CIERRE MES</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>Mes:</strong><span>${escapeHtml(report.label)}</span></div>
    <div class="receipt-row"><strong>Fecha:</strong><span>${escapeHtml(dateText)}</span></div>
    <div class="receipt-row"><strong>Hora:</strong><span>${escapeHtml(timeText)}</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>Total vendido:</strong><span>${formatMoney(report.total)}</span></div>
    <div class="receipt-row"><strong>Tickets:</strong><span>${report.tickets}</span></div>
    <div class="receipt-row"><strong>Productos:</strong><span>${report.items}</span></div>
    <div class="receipt-row"><strong>Promedio:</strong><span>${formatMoney(report.average)}</span></div>
    <div class="receipt-divider"></div>
    <p><strong>DETALLE POR DIA</strong></p>
    <div class="receipt-items">
      ${report.days
        .map(
          (day) => `
            <div class="receipt-item">
              <strong>${escapeHtml(formatDayLabel(day.day))}: ${formatMoney(day.total)}</strong>
              <div>${day.tickets} tickets / ${day.items} productos</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p><strong>PRODUCTOS</strong></p>
    <div class="receipt-items">
      ${report.products
        .map(
          (product) => `
            <div class="receipt-item">
              <strong>${product.qty} x ${escapeHtml(product.name)}</strong>
              <div>${formatMoney(product.total)}</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p class="receipt-total">FIN DEL CIERRE</p>
  `;
}

function printMonthlyClose() {
  const report = renderMonthlyClose(elements.closeMonthInput.value || currentMonthKey());
  if (!report.tickets) {
    alert("No hay pedidos guardados para imprimir en ese mes.");
    return;
  }

  renderPrintMonthlyClose(report);
  window.print();
}

function startNewOrder() {
  currentOrder = createBlankOrder();
  renderOrder();
}

function clearCurrentOrder() {
  if (!currentOrder.items.length) return;
  const shouldClear = confirm("Quieres limpiar los productos del pedido actual?");
  if (!shouldClear) return;
  currentOrder.items = [];
  currentOrder.notes = "";
  currentOrder.saved = false;
  currentOrder.id = null;
  currentOrder.ticketNumber = null;
  currentOrder.createdAt = null;
  currentOrder.updatedAt = null;
  currentOrder.businessDate = todayKey;
  elements.orderNotes.value = "";
  renderOrder();
}

function openItemNote(itemId) {
  const item = currentOrder.items.find((entry) => entry.id === itemId);
  if (!item) return;

  editingNoteItemId = item.id;
  elements.itemNoteTitle.textContent = item.name;
  elements.itemNoteTextarea.value = item.note || "";
  elements.itemNoteDialog.showModal();
  elements.itemNoteTextarea.focus();
}

function saveItemNote() {
  const item = currentOrder.items.find((entry) => entry.id === editingNoteItemId);
  if (!item) return;

  item.note = elements.itemNoteTextarea.value.trim();
  markOrderChanged();
  renderOrder();
  elements.itemNoteDialog.close();
  editingNoteItemId = null;
}

function openCustomerDialog() {
  syncFormToOrder();
  elements.customerDialogInput.value = currentOrder.customer || "";
  elements.customerDialog.showModal();
  elements.customerDialogInput.focus();
}

function saveCustomerFromDialog() {
  currentOrder.customer = elements.customerDialogInput.value.trim();
  elements.customerName.value = currentOrder.customer;
  markOrderChanged();
  elements.customerDialog.close();
}

function loadOrder(orderId) {
  const order = savedOrders.find((item) => item.id === orderId);
  if (!order) return;
  currentOrder = structuredCloneOrder(order);
  renderOrder();
  renderPrintTicket(currentOrder);
}

async function setNextTicket(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) {
    alert("Escribe un numero valido mayor a cero.");
    return;
  }

  if (cloudState.user && navigator.onLine) {
    try {
      await setCloudNextTicket(number);
      updateCloudStatus();
    } catch (error) {
      console.error(error);
      markSettingsPending();
      updateCloudStatus();
    }
  } else if (shouldQueueForCloud()) {
    markSettingsPending();
    updateCloudStatus();
  }

  nextTicket = number;
  saveTicketState();
  renderOrder();
  elements.counterDialog.close();
}

elements.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategories();
  renderMenu();
});

elements.menuGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".dish-button");
  if (!button) return;
  addItem(button.dataset.name, button.dataset.price);
});

elements.customItemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addItem(elements.customItemName.value, elements.customItemPrice.value);
  elements.customItemName.value = "";
  elements.customItemPrice.value = "";
  elements.customItemName.focus();
});

elements.lineItems.addEventListener("click", (event) => {
  const itemElement = event.target.closest(".line-item");
  const action = event.target.dataset.action;
  if (!itemElement || !action) return;
  if (!["plus", "minus", "remove", "open-note"].includes(action)) return;

  const item = currentOrder.items.find((entry) => entry.id === itemElement.dataset.id);
  if (!item) return;

  if (action === "plus") item.qty += 1;
  if (action === "minus") item.qty = Math.max(1, item.qty - 1);
  if (action === "remove") currentOrder.items = currentOrder.items.filter((entry) => entry.id !== item.id);
  if (action === "open-note") {
    openItemNote(item.id);
    return;
  }

  markOrderChanged();
  renderOrder();
});

elements.lineItems.addEventListener("input", (event) => {
  const itemElement = event.target.closest(".line-item");
  const action = event.target.dataset.action;
  if (!itemElement || !action) return;

  const item = currentOrder.items.find((entry) => entry.id === itemElement.dataset.id);
  if (!item) return;

  if (action === "qty") {
    item.qty = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
    event.target.value = item.qty;
    const subtotal = itemElement.querySelector(".item-subtotal");
    if (subtotal) subtotal.textContent = formatMoney(item.qty * item.price);
  }

  if (action === "note") {
    item.note = event.target.value;
  }

  markOrderChanged();
  elements.orderTotal.textContent = formatMoney(orderTotal());
});

[elements.orderType, elements.customerName, elements.serverName, elements.orderNotes].forEach((input) => {
  input.addEventListener("input", () => {
    syncFormToOrder();
    markOrderChanged();
  });
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await signInWithEmail();
});

elements.signUpButton.addEventListener("click", signUpWithEmail);
elements.resetPasswordButton.addEventListener("click", sendPasswordResetEmail);
elements.updatePasswordButton.addEventListener("click", updateRecoveredPassword);
elements.cancelRecoveryButton.addEventListener("click", () => hidePasswordRecoveryForm());
elements.openSignInButton.addEventListener("click", openSignInScreen);
elements.signOutButton.addEventListener("click", signOut);

elements.saveOrderButton.addEventListener("click", async () => {
  if (await upsertCurrentOrder()) {
    const syncMessage = needsCloudSync(currentOrder) ? " Guardado localmente; se subira cuando vuelva internet." : "";
    alert(`Pedido ${formatTicket(currentOrder.ticketNumber)} guardado.${syncMessage}`);
  }
});

elements.printOrderButton.addEventListener("click", printCurrentOrder);
elements.newOrderButton.addEventListener("click", startNewOrder);
elements.clearOrderButton.addEventListener("click", clearCurrentOrder);

elements.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-history-id]");
  if (!button) return;
  loadOrder(button.dataset.historyId);
});

elements.counterButton.addEventListener("click", () => {
  elements.counterInput.value = nextTicket;
  elements.counterDialog.showModal();
});

elements.confirmCounterButton.addEventListener("click", () => {
  setNextTicket(elements.counterInput.value);
});
elements.saveItemNoteButton.addEventListener("click", saveItemNote);
elements.customerButton.addEventListener("click", openCustomerDialog);
elements.saveCustomerButton.addEventListener("click", saveCustomerFromDialog);

elements.monthlyCloseButton.addEventListener("click", () => {
  renderMonthlyClose(currentMonthKey());
  elements.monthlyCloseDialog.showModal();
});

elements.closeMonthInput.addEventListener("change", () => {
  renderMonthlyClose(elements.closeMonthInput.value || currentMonthKey());
});

elements.printCloseButton.addEventListener("click", printMonthlyClose);

elements.editMenuButton.addEventListener("click", openMenuEditor);

elements.editorCategoryList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  selectEditorCategory(button.dataset.category);
});

elements.productCategorySelect.addEventListener("change", () => {
  selectEditorCategory(elements.productCategorySelect.value);
});

elements.addCategoryButton.addEventListener("click", addCategory);
elements.renameCategoryButton.addEventListener("click", renameCategory);
elements.deleteCategoryButton.addEventListener("click", deleteCategory);
elements.newProductButton.addEventListener("click", startNewProduct);
elements.saveProductButton.addEventListener("click", saveProduct);
elements.cancelEditProductButton.addEventListener("click", clearProductForm);
elements.resetMenuButton.addEventListener("click", resetMenu);
elements.saveCurrencyButton.addEventListener("click", saveCurrencySymbol);

elements.productList.addEventListener("click", (event) => {
  const row = event.target.closest(".product-row");
  const action = event.target.dataset.action;
  if (!row || !action) return;

  const index = Number.parseInt(row.dataset.index, 10);
  if (action === "edit-product") editProduct(index);
  if (action === "delete-product") deleteProduct(index);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  elements.installAppButton.hidden = false;
});

elements.installAppButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    elements.installHelpDialog.showModal();
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elements.installAppButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  elements.installAppButton.hidden = true;
});

window.addEventListener("offline", () => {
  renderCloudState();
});

window.addEventListener("online", async () => {
  updateCloudStatus("Conectando...");
  try {
    if (cloudState.configured && !cloudState.client) {
      await initializeCloud();
    }
    await syncPendingData();
  } catch (error) {
    console.error(error);
    updateCloudStatus();
  }
});

if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

renderCategories();
renderMenu();
renderOrder();
renderHistory();
initializeCloud().catch((error) => {
  console.error(error);
  updateCloudStatus(navigator.onLine ? "Error nube" : "");
  elements.authMessage.textContent = error.message || "No se pudo iniciar Supabase.";
});
