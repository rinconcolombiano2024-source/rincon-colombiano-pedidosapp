const STORAGE_KEYS = {
  nextTicket: "rincon_colombiano_next_ticket",
  ticketDate: "rincon_colombiano_ticket_date",
  orders: "rincon_colombiano_orders",
  menu: "rincon_colombiano_menu",
  currencySymbol: "rincon_colombiano_currency_symbol",
  currencyPosition: "rincon_colombiano_currency_position",
  moneyFormat: "rincon_colombiano_money_format",
  receiptWidthMm: "rincon_colombiano_receipt_width_mm",
  shiftServerName: "rincon_colombiano_shift_server_name",
  settingsPending: "rincon_colombiano_settings_pending",
  cloudSession: "rincon_colombiano_cloud_session",
  deletedOrders: "rincon_colombiano_deleted_orders",
  deliveryFee: "rincon_colombiano_delivery_fee",
  restaurantAddress: "rincon_colombiano_restaurant_address",
  googleMapsApiKey: "rincon_colombiano_google_maps_api_key",
  bankAccount: "rincon_colombiano_bank_account",
  bankTransferNote: "rincon_colombiano_bank_transfer_note",
  onlinePaymentProvider: "rincon_colombiano_online_payment_provider",
  onlinePaymentNote: "rincon_colombiano_online_payment_note",
  clientAlarmEnabled: "rincon_colombiano_client_alarm_enabled",
  businessName: "rincon_colombiano_business_name",
  businessLogoUrl: "rincon_colombiano_business_logo_url",
  restaurantActive: "rincon_colombiano_restaurant_active",
  legalBusinessName: "rincon_colombiano_legal_business_name",
  taxId: "rincon_colombiano_tax_id",
  businessPhone: "rincon_colombiano_business_phone",
  businessEmail: "rincon_colombiano_business_email",
  legalAddress: "rincon_colombiano_legal_address",
  deliveryMinimumFee: "rincon_colombiano_delivery_minimum_fee",
  currentOrderDraft: "rincon_colombiano_current_order_draft",
};

const DEFAULT_BUSINESS_NAME = "RINCON COLOMBIANO";
const DEFAULT_DELIVERY_MINIMUM_FEE = 20;
const APP_VERSION = "v60";
const PLATFORM_SCOPE_ID = "00000000-0000-0000-0000-000000000000";

const EMPTY_MENU_CATALOG = {
  Entradas: [],
};

const elements = {
  authScreen: document.querySelector("#authScreen"),
  restaurantAuthDialog: document.querySelector("#restaurantAuthDialog"),
  restaurantAuthTitle: document.querySelector("#restaurantAuthTitle"),
  restaurantAuthCloseButton: document.querySelector("#restaurantAuthCloseButton"),
  openRestaurantSignInButton: document.querySelector("#openRestaurantSignInButton"),
  openRestaurantSignupButton: document.querySelector("#openRestaurantSignupButton"),
  authBusinessName: document.querySelector("#authBusinessName"),
  authLogoImage: document.querySelector("#authLogoImage"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authRestaurantNameInput: document.querySelector("#authRestaurantNameInput"),
  authLegalNameInput: document.querySelector("#authLegalNameInput"),
  authTaxIdInput: document.querySelector("#authTaxIdInput"),
  authLegalAddressInput: document.querySelector("#authLegalAddressInput"),
  authBusinessPhoneInput: document.querySelector("#authBusinessPhoneInput"),
  authOwnerNameInput: document.querySelector("#authOwnerNameInput"),
  authLegalConsentInput: document.querySelector("#authLegalConsentInput"),
  signInButton: document.querySelector("#signInButton"),
  signUpButton: document.querySelector("#signUpButton"),
  resetPasswordButton: document.querySelector("#resetPasswordButton"),
  resendVerificationButton: document.querySelector("#resendVerificationButton"),
  passwordRecoveryPanel: document.querySelector("#passwordRecoveryPanel"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  updatePasswordButton: document.querySelector("#updatePasswordButton"),
  cancelRecoveryButton: document.querySelector("#cancelRecoveryButton"),
  authMessage: document.querySelector("#authMessage"),
  cloudStatus: document.querySelector("#cloudStatus"),
  appBusinessName: document.querySelector("#appBusinessName"),
  appLogoImage: document.querySelector("#appLogoImage"),
  refreshAppButton: document.querySelector("#refreshAppButton"),
  openSignInButton: document.querySelector("#openSignInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  qrButton: document.querySelector("#qrButton"),
  clientAlarmButton: document.querySelector("#clientAlarmButton"),
  clientOrdersButton: document.querySelector("#clientOrdersButton"),
  clientOrdersBadge: document.querySelector("#clientOrdersBadge"),
  nextTicketLabel: document.querySelector("#nextTicketLabel"),
  categoryTabs: document.querySelector("#categoryTabs"),
  menuGrid: document.querySelector("#menuGrid"),
  menuSearchInput: document.querySelector("#menuSearchInput"),
  menuSearchClearButton: document.querySelector("#menuSearchClearButton"),
  customItemForm: document.querySelector("#customItemForm"),
  customItemName: document.querySelector("#customItemName"),
  customItemPrice: document.querySelector("#customItemPrice"),
  clearOrderButton: document.querySelector("#clearOrderButton"),
  activeTicketTitle: document.querySelector("#activeTicketTitle"),
  orderStatus: document.querySelector("#orderStatus"),
  orderType: document.querySelector("#orderType"),
  paymentMethod: document.querySelector("#paymentMethod"),
  customerName: document.querySelector("#customerName"),
  serverName: document.querySelector("#serverName"),
  lineItems: document.querySelector("#lineItems"),
  orderNotes: document.querySelector("#orderNotes"),
  orderTotal: document.querySelector("#orderTotal"),
  newOrderButton: document.querySelector("#newOrderButton"),
  correctOrderButton: document.querySelector("#correctOrderButton"),
  saveOrderButton: document.querySelector("#saveOrderButton"),
  printOrderButton: document.querySelector("#printOrderButton"),
  downloadTicketPdfButton: document.querySelector("#downloadTicketPdfButton"),
  cancelOrderButton: document.querySelector("#cancelOrderButton"),
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
  shiftButton: document.querySelector("#shiftButton"),
  shiftDialog: document.querySelector("#shiftDialog"),
  shiftServerInput: document.querySelector("#shiftServerInput"),
  saveShiftButton: document.querySelector("#saveShiftButton"),
  customerButton: document.querySelector("#customerButton"),
  customerDialog: document.querySelector("#customerDialog"),
  customerDialogInput: document.querySelector("#customerDialogInput"),
  saveCustomerButton: document.querySelector("#saveCustomerButton"),
  dailyCloseButton: document.querySelector("#dailyCloseButton"),
  dailyCloseDialog: document.querySelector("#dailyCloseDialog"),
  closeDayInput: document.querySelector("#closeDayInput"),
  dailyCloseContent: document.querySelector("#dailyCloseContent"),
  printDailyCloseButton: document.querySelector("#printDailyCloseButton"),
  monthlyCloseButton: document.querySelector("#monthlyCloseButton"),
  monthlyCloseDialog: document.querySelector("#monthlyCloseDialog"),
  closeMonthInput: document.querySelector("#closeMonthInput"),
  monthlyCloseContent: document.querySelector("#monthlyCloseContent"),
  printCloseButton: document.querySelector("#printCloseButton"),
  qrDialog: document.querySelector("#qrDialog"),
  qrTableInput: document.querySelector("#qrTableInput"),
  qrImage: document.querySelector("#qrImage"),
  qrLinkInput: document.querySelector("#qrLinkInput"),
  qrHint: document.querySelector("#qrHint"),
  copyQrLinkButton: document.querySelector("#copyQrLinkButton"),
  openClientPageButton: document.querySelector("#openClientPageButton"),
  clientOrdersDialog: document.querySelector("#clientOrdersDialog"),
  clientOrdersList: document.querySelector("#clientOrdersList"),
  refreshClientOrdersButton: document.querySelector("#refreshClientOrdersButton"),
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
  productDescriptionInput: document.querySelector("#productDescriptionInput"),
  productPriceInput: document.querySelector("#productPriceInput"),
  productImageUrlInput: document.querySelector("#productImageUrlInput"),
  productImageFileInput: document.querySelector("#productImageFileInput"),
  productAvailableInput: document.querySelector("#productAvailableInput"),
  saveProductButton: document.querySelector("#saveProductButton"),
  cancelEditProductButton: document.querySelector("#cancelEditProductButton"),
  productList: document.querySelector("#productList"),
  resetMenuButton: document.querySelector("#resetMenuButton"),
  businessNameInput: document.querySelector("#businessNameInput"),
  businessLogoUrlInput: document.querySelector("#businessLogoUrlInput"),
  businessLogoFileInput: document.querySelector("#businessLogoFileInput"),
  legalBusinessNameInput: document.querySelector("#legalBusinessNameInput"),
  taxIdInput: document.querySelector("#taxIdInput"),
  businessPhoneInput: document.querySelector("#businessPhoneInput"),
  businessEmailInput: document.querySelector("#businessEmailInput"),
  legalAddressInput: document.querySelector("#legalAddressInput"),
  currencySymbolInput: document.querySelector("#currencySymbolInput"),
  currencyPositionSelect: document.querySelector("#currencyPositionSelect"),
  moneyFormatSelect: document.querySelector("#moneyFormatSelect"),
  receiptWidthInput: document.querySelector("#receiptWidthInput"),
  saveCurrencyButton: document.querySelector("#saveCurrencyButton"),
  deliveryFeeInput: document.querySelector("#deliveryFeeInput"),
  deliveryMinimumFeeInput: document.querySelector("#deliveryMinimumFeeInput"),
  restaurantAddressInput: document.querySelector("#restaurantAddressInput"),
  useRestaurantLocationButton: document.querySelector("#useRestaurantLocationButton"),
  googleMapsApiKeyInput: document.querySelector("#googleMapsApiKeyInput"),
  bankAccountInput: document.querySelector("#bankAccountInput"),
  bankTransferNoteInput: document.querySelector("#bankTransferNoteInput"),
  onlinePaymentProviderSelect: document.querySelector("#onlinePaymentProviderSelect"),
  onlinePaymentNoteInput: document.querySelector("#onlinePaymentNoteInput"),
  restaurantStatusText: document.querySelector("#restaurantStatusText"),
  closeRestaurantButton: document.querySelector("#closeRestaurantButton"),
  requestRestaurantDeletionButton: document.querySelector("#requestRestaurantDeletionButton"),
  saveCustomerSettingsButton: document.querySelector("#saveCustomerSettingsButton"),
  toastNotice: document.querySelector("#toastNotice"),
};

let menuCatalog = readMenuCatalog();
let activeCategory = Object.keys(menuCatalog)[0];
let menuSearchQuery = "";
let todayKey = currentBusinessDate();
let nextTicket = initializeDailyTicket();
let savedOrders = readOrders();
let shiftServerName = readShiftServerName();
let currentOrder = readCurrentOrderDraft();
let deferredInstallPrompt = null;
let editingProduct = null;
let businessName = readBusinessName();
let currencySymbol = readCurrencySymbol();
let currencyPosition = readCurrencyPosition();
let moneyFormat = readMoneyFormat();
let receiptWidthMm = readReceiptWidthMm();
let deliveryFee = readDeliveryFee();
let deliveryMinimumFee = readDeliveryMinimumFee();
let restaurantAddress = readRestaurantAddress();
let googleMapsApiKey = readGoogleMapsApiKey();
let bankAccount = readBankAccount();
let bankTransferNote = readBankTransferNote();
let onlinePaymentProvider = readOnlinePaymentProvider();
let onlinePaymentNote = readOnlinePaymentNote();
let businessLogoUrl = readBusinessLogoUrl();
let restaurantActive = readRestaurantActive();
let legalBusinessName = readLegalBusinessName();
let taxId = readTaxId();
let businessPhone = readBusinessPhone();
let businessEmail = readBusinessEmail();
let legalAddress = readLegalAddress();
let editingNoteItemId = null;
let toastTimer = null;
let pendingClientOrders = [];
let clientOrdersTimer = null;
let clientAlarmTimer = null;
let clientAlarmAudioContext = null;
let clientAlarmEnabled = readClientAlarmEnabled();
let clientChatKnownMessageIds = new Set();
let clientChatLoadedOnce = false;
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
    paymentMethod: "Pago en caja",
    customer: "",
    server: shiftServerName,
    notes: "",
    delivery: null,
    items: [],
    createdAt: null,
    updatedAt: null,
    businessDate: todayKey,
    saved: false,
    syncStatus: "local",
  };
}

function currentOrderHasContent(order = currentOrder) {
  return Boolean(
    order?.saved ||
      (Array.isArray(order?.items) && order.items.length) ||
      String(order?.customer || "").trim() ||
      String(order?.notes || "").trim() ||
      order?.delivery
  );
}

function normalizeCurrentOrderDraft(order) {
  const normalized = normalizeOrderNotes({
    ...createBlankOrder(),
    ...(order || {}),
    items: Array.isArray(order?.items) ? order.items : [],
  });
  normalized.type = normalizeOrderType(normalized.type);
  normalized.paymentMethod = normalizePaymentMethod(normalized.paymentMethod);
  normalized.server = String(normalized.server || shiftServerName || "").trim();
  normalized.businessDate = normalized.saved ? orderBusinessDate(normalized) : todayKey;
  normalized.syncStatus = normalized.syncStatus || (normalized.saved ? "local" : "local");
  return normalized;
}

function readCurrentOrderDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.currentOrderDraft) || "null");
    if (!parsed) return createBlankOrder();
    const draft = normalizeCurrentOrderDraft(parsed);
    if (!draft.saved && draft.businessDate !== todayKey) return createBlankOrder();
    return currentOrderHasContent(draft) ? draft : createBlankOrder();
  } catch {
    return createBlankOrder();
  }
}

function saveCurrentOrderDraft() {
  try {
    if (!currentOrderHasContent(currentOrder)) {
      localStorage.removeItem(STORAGE_KEYS.currentOrderDraft);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.currentOrderDraft, JSON.stringify(normalizeCurrentOrderDraft(currentOrder)));
  } catch {
    // Si el navegador no permite guardar el borrador, la toma de pedidos sigue funcionando.
  }
}

function clearCurrentOrderDraft() {
  localStorage.removeItem(STORAGE_KEYS.currentOrderDraft);
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
      ? parsed.map((order) =>
          normalizeOrderNotes({
            ...order,
            type: normalizeOrderType(order.type),
            businessDate: orderBusinessDate(order),
            syncStatus: order.syncStatus || "synced",
          })
        )
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

function ordersForDay(day) {
  return savedOrders.filter((order) => orderBusinessDate(order) === day);
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

function buildDailyClose(day) {
  const dayOrders = ordersForDay(day);
  const products = new Map();
  const orderTypes = new Map();
  const servers = new Map();
  const paymentMethods = new Map();

  dayOrders.forEach((order) => {
    const total = orderTotal(order);
    const type = normalizeOrderType(order.type);
    const typeRecord = orderTypes.get(type) || { label: orderTypeLabel(type), tickets: 0, total: 0 };
    typeRecord.tickets += 1;
    typeRecord.total += total;
    orderTypes.set(type, typeRecord);

    const server = order.server || "No indicado";
    const serverRecord = servers.get(server) || { name: server, tickets: 0, total: 0 };
    serverRecord.tickets += 1;
    serverRecord.total += total;
    servers.set(server, serverRecord);

    const payment = paymentMethodLabel(order.paymentMethod);
    const paymentRecord = paymentMethods.get(payment) || { label: payment, tickets: 0, total: 0 };
    paymentRecord.tickets += 1;
    paymentRecord.total += total;
    paymentMethods.set(payment, paymentRecord);

    orderItemsList(order).forEach((item) => {
      const key = itemReportKey(item);
      const product = products.get(key) || { name: itemReportName(item), qty: 0, total: 0 };
      product.qty += itemQuantity(item);
      product.total += itemLineTotal(item);
      products.set(key, product);
    });
  });

  const total = dayOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const items = dayOrders.reduce((sum, order) => sum + orderItemsCount(order), 0);
  const ticketNumbers = dayOrders.map((order) => order.ticketNumber).filter(Number.isFinite).sort((a, b) => a - b);

  return {
    day,
    label: formatDayLabel(day),
    tickets: dayOrders.length,
    items,
    total,
    average: dayOrders.length ? total / dayOrders.length : 0,
    firstTicket: ticketNumbers[0] || null,
    lastTicket: ticketNumbers[ticketNumbers.length - 1] || null,
    orderTypes: Array.from(orderTypes.values()).sort((a, b) => b.total - a.total),
    paymentMethods: Array.from(paymentMethods.values()).sort((a, b) => b.total - a.total),
    servers: Array.from(servers.values()).sort((a, b) => b.total - a.total),
    products: Array.from(products.values()).sort((a, b) => b.qty - a.qty || b.total - a.total),
  };
}

function buildMonthlyClose(month) {
  const monthOrders = ordersForMonth(month);
  const days = new Map();
  const products = new Map();

  monthOrders.forEach((order) => {
    const day = orderBusinessDate(order);
    const dayRecord = days.get(day) || { day, tickets: 0, items: 0, total: 0 };
    const orderItems = orderItemsCount(order);
    const total = orderTotal(order);

    dayRecord.tickets += 1;
    dayRecord.items += orderItems;
    dayRecord.total += total;
    days.set(day, dayRecord);

    orderItemsList(order).forEach((item) => {
      const key = itemReportKey(item);
      const product = products.get(key) || { name: itemReportName(item), qty: 0, total: 0 };
      product.qty += itemQuantity(item);
      product.total += itemLineTotal(item);
      products.set(key, product);
    });
  });

  const total = monthOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const items = monthOrders.reduce((sum, order) => sum + orderItemsCount(order), 0);

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

function readDeletedOrderIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.deletedOrders) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveDeletedOrderIds(ids) {
  localStorage.setItem(STORAGE_KEYS.deletedOrders, JSON.stringify(Array.from(new Set(ids.filter(Boolean)))));
}

function queueDeletedOrderId(orderId) {
  if (!orderId || !shouldQueueForCloud()) return;
  saveDeletedOrderIds([...readDeletedOrderIds(), orderId]);
}

function clearDeletedOrderId(orderId) {
  saveDeletedOrderIds(readDeletedOrderIds().filter((id) => id !== orderId));
}

function pendingDeletedOrdersCount() {
  return readDeletedOrderIds().length;
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
  saveCurrentOrderDraft();
}

function mergeOrders(cloudOrders, localOrders) {
  const ordersById = new Map();
  [...cloudOrders, ...localOrders].forEach((order) => {
    if (!order?.id) return;
    const current = ordersById.get(order.id);
    if (!current || needsCloudSync(order) || new Date(order.updatedAt || 0) > new Date(current.updatedAt || 0)) {
      ordersById.set(order.id, normalizeOrderNotes({
        ...order,
        type: normalizeOrderType(order.type),
        businessDate: orderBusinessDate(order),
      }));
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
    businessName,
    currencySymbol,
    currencyPosition,
    moneyFormat,
    receiptWidthMm,
    deliveryFee,
    deliveryMinimumFee,
    restaurantAddress,
    googleMapsApiKey,
    bankAccount,
    bankTransferNote,
    onlinePaymentProvider,
    onlinePaymentNote,
    businessLogoUrl,
    restaurantActive,
    legalBusinessName,
    taxId,
    businessPhone,
    businessEmail,
    legalAddress,
  };
}

function currentRestaurantPublicProfilePayload() {
  const publicAddress = normalizeTextSetting(restaurantAddress || legalAddress);
  return {
    user_id: cloudState.user.id,
    business_name: normalizeBusinessName(businessName),
    logo_url: normalizeProductImageUrl(businessLogoUrl),
    public_address: publicAddress,
    phone: normalizeTextSetting(businessPhone),
    description: "",
    active: restaurantActive,
    updated_at: new Date().toISOString(),
  };
}

function restaurantSignupProfileFromInputs(email = "") {
  return {
    businessName: normalizeBusinessName(elements.authRestaurantNameInput?.value || businessName),
    legalBusinessName: normalizeTextSetting(elements.authLegalNameInput?.value || ""),
    taxId: normalizeTextSetting(elements.authTaxIdInput?.value || ""),
    legalAddress: normalizeTextSetting(elements.authLegalAddressInput?.value || ""),
    businessPhone: normalizeTextSetting(elements.authBusinessPhoneInput?.value || ""),
    businessEmail: normalizeTextSetting(email || elements.authEmail?.value || ""),
    ownerName: normalizeTextSetting(elements.authOwnerNameInput?.value || ""),
    legalConsent: Boolean(elements.authLegalConsentInput?.checked),
  };
}

function restaurantProfileFromUserMetadata() {
  const metadata = cloudState.user?.user_metadata || {};
  const profile = metadata.restaurant_profile || {};
  return {
    businessName: profile.businessName || metadata.business_name || metadata.app_name || "",
    legalBusinessName: profile.legalBusinessName || metadata.legal_business_name || "",
    taxId: profile.taxId || metadata.tax_id || "",
    legalAddress: profile.legalAddress || metadata.legal_address || "",
    businessPhone: profile.businessPhone || metadata.business_phone || "",
    businessEmail: profile.businessEmail || metadata.business_email || cloudState.user?.email || "",
    ownerName: profile.ownerName || metadata.owner_name || "",
  };
}

function hasRestaurantOwnerRegistration(profile = {}, settingsRow = null) {
  const metadata = cloudState.user?.user_metadata || {};
  return Boolean(
    settingsRow ||
      metadata.account_type === "restaurant" ||
      normalizeTextSetting(profile.legalBusinessName) ||
      normalizeTextSetting(profile.taxId) ||
      normalizeTextSetting(profile.legalAddress) ||
      normalizeTextSetting(profile.businessPhone) ||
      normalizeTextSetting(profile.ownerName)
  );
}

function splitProfileName(fullName = "") {
  const cleanName = normalizeTextSetting(fullName);
  if (!cleanName) return { firstName: "", lastName: "" };
  const parts = cleanName.split(" ");
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" "),
  };
}

function restaurantOwnerUserProfilePayload(profile = restaurantProfileFromUserMetadata()) {
  const fullName = normalizeTextSetting(profile.ownerName || cloudState.user?.user_metadata?.full_name || "");
  const nameParts = splitProfileName(fullName);
  return {
    user_id: cloudState.user.id,
    first_name: nameParts.firstName,
    last_name: nameParts.lastName,
    full_name: fullName,
    phone: normalizeTextSetting(profile.businessPhone || businessPhone),
    country: "",
    city: "",
    preferred_language: "es",
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

async function activateCurrentUserRole(role) {
  if (!cloudState.client || !cloudState.user) return;
  try {
    const { error } = await cloudState.client.rpc("activate_user_role", {
      p_role: role,
      p_scope_type: "platform",
      p_scope_id: PLATFORM_SCOPE_ID,
    });
    if (error) throw error;
  } catch (error) {
    console.warn("No se pudo activar el rol de usuario. Ejecuta la migracion de Fase 3 en Supabase.", error);
  }
}

async function ensureRestaurantOwnerIdentity(profile = restaurantProfileFromUserMetadata()) {
  if (!cloudState.client || !cloudState.user) return;
  try {
    const { error } = await cloudState.client.from("user_profiles").upsert(restaurantOwnerUserProfilePayload(profile));
    if (error) throw error;
  } catch (error) {
    console.warn("No se pudo actualizar el perfil general del propietario.", error);
  }
  await activateCurrentUserRole("restaurant_owner");
}

function applyRestaurantProfile(profile = {}, options = {}) {
  const onlyIfEmpty = Boolean(options.onlyIfEmpty);
  const assignText = (currentValue, nextValue) => {
    const cleanValue = normalizeTextSetting(nextValue);
    if (!cleanValue) return currentValue;
    if (onlyIfEmpty && normalizeTextSetting(currentValue)) return currentValue;
    return cleanValue;
  };

  businessName = onlyIfEmpty && businessName !== DEFAULT_BUSINESS_NAME
    ? businessName
    : normalizeBusinessName(profile.businessName || businessName);
  legalBusinessName = assignText(legalBusinessName, profile.legalBusinessName);
  taxId = assignText(taxId, profile.taxId);
  legalAddress = assignText(legalAddress, profile.legalAddress);
  restaurantAddress = assignText(restaurantAddress, profile.legalAddress);
  businessPhone = assignText(businessPhone, profile.businessPhone);
  businessEmail = assignText(businessEmail, profile.businessEmail);

  localStorage.setItem(STORAGE_KEYS.businessName, businessName);
  localStorage.setItem(STORAGE_KEYS.legalBusinessName, legalBusinessName);
  localStorage.setItem(STORAGE_KEYS.taxId, taxId);
  localStorage.setItem(STORAGE_KEYS.legalAddress, legalAddress);
  localStorage.setItem(STORAGE_KEYS.restaurantAddress, restaurantAddress);
  localStorage.setItem(STORAGE_KEYS.businessPhone, businessPhone);
  localStorage.setItem(STORAGE_KEYS.businessEmail, businessEmail);
  applyBusinessNameToUi();
}

function applySettingsPayload(settings = {}) {
  businessName = normalizeBusinessName(settings.businessName || businessName);
  businessLogoUrl = normalizeProductImageUrl(settings.businessLogoUrl ?? businessLogoUrl);
  legalBusinessName = normalizeTextSetting(settings.legalBusinessName ?? legalBusinessName);
  taxId = normalizeTextSetting(settings.taxId ?? taxId);
  businessPhone = normalizeTextSetting(settings.businessPhone ?? businessPhone);
  businessEmail = normalizeTextSetting(settings.businessEmail ?? businessEmail);
  legalAddress = normalizeTextSetting(settings.legalAddress ?? legalAddress);
  currencySymbol = settings.currencySymbol || currencySymbol || "$";
  currencyPosition = settings.currencyPosition === "after" ? "after" : "before";
  moneyFormat = settings.moneyFormat === "eu" ? "eu" : "us";
  receiptWidthMm = normalizeReceiptWidth(settings.receiptWidthMm || receiptWidthMm);
  deliveryFee = normalizeMoneyValue(settings.deliveryFee ?? deliveryFee);
  deliveryMinimumFee = normalizeDeliveryMinimumFee(settings.deliveryMinimumFee ?? deliveryMinimumFee);
  restaurantAddress = normalizeTextSetting(settings.restaurantAddress ?? restaurantAddress);
  googleMapsApiKey = normalizeTextSetting(settings.googleMapsApiKey ?? googleMapsApiKey);
  bankAccount = normalizeTextSetting(settings.bankAccount ?? bankAccount);
  bankTransferNote = normalizeTextSetting(settings.bankTransferNote ?? bankTransferNote);
  onlinePaymentProvider = normalizeOnlinePaymentProvider(settings.onlinePaymentProvider ?? onlinePaymentProvider);
  onlinePaymentNote = normalizeTextSetting(settings.onlinePaymentNote ?? onlinePaymentNote);
  restaurantActive = settings.restaurantActive === false ? false : restaurantActive;
  localStorage.setItem(STORAGE_KEYS.businessName, businessName);
  localStorage.setItem(STORAGE_KEYS.businessLogoUrl, businessLogoUrl);
  localStorage.setItem(STORAGE_KEYS.restaurantActive, restaurantActive ? "1" : "0");
  localStorage.setItem(STORAGE_KEYS.legalBusinessName, legalBusinessName);
  localStorage.setItem(STORAGE_KEYS.taxId, taxId);
  localStorage.setItem(STORAGE_KEYS.businessPhone, businessPhone);
  localStorage.setItem(STORAGE_KEYS.businessEmail, businessEmail);
  localStorage.setItem(STORAGE_KEYS.legalAddress, legalAddress);
  localStorage.setItem(STORAGE_KEYS.currencySymbol, currencySymbol);
  localStorage.setItem(STORAGE_KEYS.currencyPosition, currencyPosition);
  localStorage.setItem(STORAGE_KEYS.moneyFormat, moneyFormat);
  localStorage.setItem(STORAGE_KEYS.receiptWidthMm, String(receiptWidthMm));
  localStorage.setItem(STORAGE_KEYS.deliveryFee, String(deliveryFee));
  localStorage.setItem(STORAGE_KEYS.deliveryMinimumFee, String(deliveryMinimumFee));
  localStorage.setItem(STORAGE_KEYS.restaurantAddress, restaurantAddress);
  localStorage.setItem(STORAGE_KEYS.googleMapsApiKey, googleMapsApiKey);
  localStorage.setItem(STORAGE_KEYS.bankAccount, bankAccount);
  localStorage.setItem(STORAGE_KEYS.bankTransferNote, bankTransferNote);
  localStorage.setItem(STORAGE_KEYS.onlinePaymentProvider, onlinePaymentProvider);
  localStorage.setItem(STORAGE_KEYS.onlinePaymentNote, onlinePaymentNote);
  localStorage.setItem(STORAGE_KEYS.restaurantActive, restaurantActive ? "1" : "0");
  applyBusinessNameToUi();
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

  const pending = pendingOrdersCount() + pendingDeletedOrdersCount();
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
    elements.qrButton.hidden = true;
    elements.clientAlarmButton.hidden = true;
    elements.clientOrdersButton.hidden = true;
    stopClientAlarm();
    updateCloudStatus();
    return;
  }

  const canWorkOffline = !cloudState.user && hasKnownCloudSession() && !navigator.onLine;
  elements.authScreen.hidden = cloudState.recoveringPassword ? false : Boolean(cloudState.user) || canWorkOffline;
  if ((cloudState.user || canWorkOffline) && elements.restaurantAuthDialog?.open) closeRestaurantAuthDialog();
  elements.openSignInButton.hidden = Boolean(cloudState.user) || cloudState.recoveringPassword;
  elements.signOutButton.hidden = !cloudState.user;
  elements.qrButton.hidden = false;
  elements.clientAlarmButton.hidden = !cloudState.user;
  elements.clientOrdersButton.hidden = false;
  updateClientOrdersBadge();
  updateClientAlarmButton();
  updateCloudStatus(canWorkOffline ? "" : message);
  if (elements.authMessage) elements.authMessage.textContent = message;
}

function setRestaurantAuthMode(mode = "login") {
  const normalizedMode = mode === "register" ? "register" : "login";
  elements.authForm.dataset.mode = normalizedMode;
  if (elements.restaurantAuthTitle) {
    elements.restaurantAuthTitle.textContent = normalizedMode === "register" ? "Registrar restaurante" : "Iniciar sesion";
  }
  if (elements.signInButton) elements.signInButton.hidden = normalizedMode === "register";
  if (elements.signUpButton) elements.signUpButton.hidden = normalizedMode !== "register";
  if (elements.resetPasswordButton) elements.resetPasswordButton.hidden = normalizedMode === "register";
  if (elements.authPassword) {
    elements.authPassword.autocomplete = normalizedMode === "register" ? "new-password" : "current-password";
  }
  if (elements.authMessage) elements.authMessage.textContent = "";
}

function openRestaurantAuthDialog(mode = "login") {
  if (!cloudState.configured) {
    alert("La nube no esta configurada todavia.");
    return;
  }
  hidePasswordRecoveryForm();
  elements.authScreen.hidden = false;
  setRestaurantAuthMode(mode);
  if (elements.restaurantAuthDialog?.showModal && !elements.restaurantAuthDialog.open) {
    elements.restaurantAuthDialog.showModal();
  }
  window.setTimeout(() => elements.authEmail?.focus(), 50);
}

function closeRestaurantAuthDialog() {
  if (elements.restaurantAuthDialog?.open) elements.restaurantAuthDialog.close();
}

function openSignInScreen() {
  openRestaurantAuthDialog("login");
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
    if (cloudState.user) {
      await loadCloudData();
    } else {
      pendingClientOrders = [];
      stopClientOrdersPolling();
      stopClientAlarm();
      updateClientOrdersBadge();
    }
  });

  if (cloudState.user) await loadCloudData();
}

async function loadCloudData() {
  if (!cloudState.client || !cloudState.user || cloudState.loading) return;
  cloudState.loading = true;
  elements.cloudStatus.textContent = "Cargando nube...";
  const localOrdersBeforeLoad = savedOrders.map(structuredCloneOrder);
  const currentOrderBeforeLoad = normalizeCurrentOrderDraft(currentOrder);
  const localDeletedOrderIds = readDeletedOrderIds();
  const localPendingOrders = localOrdersBeforeLoad.filter(
    (order) => needsCloudSync(order) && !localDeletedOrderIds.includes(order.id)
  );
  const localSettingsPending = hasPendingSettings();

  try {
    const { data: settingsRow, error: settingsError } = await cloudState.client
      .from("app_settings")
      .select("menu, settings")
      .eq("user_id", cloudState.user.id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const restaurantProfile = restaurantProfileFromUserMetadata();
    const { data: publicProfileRow, error: publicProfileError } = await cloudState.client
      .from("restaurant_profiles")
      .select("active")
      .eq("user_id", cloudState.user.id)
      .maybeSingle();
    if (!publicProfileError && typeof publicProfileRow?.active === "boolean") {
      restaurantActive = publicProfileRow.active;
      localStorage.setItem(STORAGE_KEYS.restaurantActive, restaurantActive ? "1" : "0");
    } else if (publicProfileError) {
      console.warn("No se pudo leer el estado publico del restaurante.", publicProfileError);
    }

    if (hasRestaurantOwnerRegistration(restaurantProfile, settingsRow)) {
      await ensureRestaurantOwnerIdentity(restaurantProfile);
    }

    if (settingsRow && !localSettingsPending) {
      menuCatalog = normalizeMenuCatalog(settingsRow.menu || EMPTY_MENU_CATALOG);
      localStorage.setItem(STORAGE_KEYS.menu, JSON.stringify(menuCatalog));
      applySettingsPayload(settingsRow.settings || {});
      applyRestaurantProfile(restaurantProfile, { onlyIfEmpty: true });
    } else if (!settingsRow || localSettingsPending) {
      applyRestaurantProfile(restaurantProfile, { onlyIfEmpty: false });
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

    const normalizedCloudOrders = (cloudOrders || [])
      .map((row) => ({
        ...row.order_json,
        type: normalizeOrderType(row.order_json?.type),
        businessDate: orderBusinessDate(row.order_json),
        syncStatus: "synced",
      }))
      .filter((order) => !localDeletedOrderIds.includes(order.id));
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

    currentOrder = currentOrderHasContent(currentOrderBeforeLoad) ? currentOrderBeforeLoad : createBlankOrder();
    renderCurrencySettings();
    renderCategories();
    renderMenu();
    renderOrder();
    renderHistory();
    cloudState.ready = true;
    await syncPendingData({ silent: true, allowWhileLoading: true });
    await refreshClientOrders({ silent: true });
    startClientOrdersPolling();
    updateCloudStatus();
    maybeAskShiftServer();
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

  await saveRestaurantPublicProfile();
}

async function saveRestaurantPublicProfile() {
  if (!cloudState.client || !cloudState.user) return;

  const { error } = await cloudState.client
    .from("restaurant_profiles")
    .upsert(currentRestaurantPublicProfilePayload());

  if (error) {
    console.warn("No se pudo actualizar el perfil publico del restaurante.", error);
  }
}

async function restaurantNameAlreadyExists(name) {
  if (!cloudState.client) return false;
  const cleanName = normalizeBusinessName(name);
  if (!cleanName) return false;
  try {
    const { data, error } = await cloudState.client
      .from("restaurant_profiles")
      .select("user_id, business_name")
      .eq("active", true)
      .ilike("business_name", cleanName)
      .limit(1);
    if (error) throw error;
    return (data || []).some((row) => row.user_id !== cloudState.user?.id);
  } catch (error) {
    console.warn("No se pudo validar si el restaurante ya existe.", error);
    return false;
  }
}

async function setRestaurantActive(nextActive) {
  if (!cloudState.client || !cloudState.user) {
    showToast("Inicia sesion para cambiar el estado del restaurante.");
    return;
  }

  const message = nextActive
    ? "Reabrir restaurante para que aparezca en la app del cliente?"
    : "Cerrar restaurante? Dejaremos de mostrarlo en la app del cliente, pero no se borran pedidos ni reportes.";
  if (!confirm(message)) return;

  restaurantActive = Boolean(nextActive);
  localStorage.setItem(STORAGE_KEYS.restaurantActive, restaurantActive ? "1" : "0");
  renderRestaurantStatus();
  try {
    await saveRestaurantPublicProfile();
    await saveCloudSettings();
    showToast(restaurantActive ? "Restaurante reabierto para clientes." : "Restaurante cerrado para clientes.");
  } catch (error) {
    console.error(error);
    restaurantActive = !nextActive;
    localStorage.setItem(STORAGE_KEYS.restaurantActive, restaurantActive ? "1" : "0");
    renderRestaurantStatus();
    alert("No se pudo cambiar el estado del restaurante. Revisa internet o Supabase.");
  }
}

async function toggleRestaurantActive() {
  await setRestaurantActive(!restaurantActive);
}

async function requestRestaurantDeletion() {
  if (!cloudState.client || !cloudState.user) {
    showToast("Inicia sesion para solicitar eliminacion.");
    return;
  }
  const detail = prompt(
    "Escribe ELIMINAR para solicitar eliminar/desactivar la cuenta del restaurante. No borraremos pedidos ni datos contables automaticamente."
  );
  if (detail !== "ELIMINAR") {
    showToast("Solicitud cancelada.");
    return;
  }

  try {
    const { error } = await cloudState.client.from("account_privacy_requests").insert({
      user_id: cloudState.user.id,
      request_type: "restaurant_deletion",
      role_context: "restaurant_owner",
      status: "requested",
      details: {
        businessName,
        requestedAt: new Date().toISOString(),
      },
    });
    if (error) throw error;
    restaurantActive = false;
    localStorage.setItem(STORAGE_KEYS.restaurantActive, "0");
    renderRestaurantStatus();
    await saveRestaurantPublicProfile();
    await saveCloudSettings();
    showToast("Solicitud registrada. El restaurante quedo cerrado para clientes.");
  } catch (error) {
    console.error(error);
    alert("No se pudo registrar la solicitud. Ejecuta la migracion v55 en Supabase y vuelve a intentar.");
  }
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

async function deleteCloudOrder(orderId) {
  if (!cloudState.client || !cloudState.user || !orderId) return;

  const { error } = await cloudState.client
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("user_id", cloudState.user.id);

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

function canUseCustomerModule() {
  return Boolean(cloudState.configured && cloudState.client && cloudState.user);
}

function pendingClientOrdersCount() {
  return pendingClientOrders.filter((order) => order.status === "pending").length;
}

function updateClientOrdersBadge() {
  const count = pendingClientOrdersCount();
  elements.clientOrdersBadge.textContent = count;
  elements.clientOrdersBadge.hidden = count === 0;
  updateClientAlarmButton();
  syncClientAlarm();
}

function updateClientAlarmButton() {
  if (!elements.clientAlarmButton) return;
  const hasPending = pendingClientOrdersCount() > 0;
  elements.clientAlarmButton.textContent = clientAlarmEnabled ? "Alarma activa" : "Activar alarma";
  elements.clientAlarmButton.classList.toggle("alarm-active", clientAlarmEnabled);
  elements.clientAlarmButton.classList.toggle("alarm-pending", hasPending);
}

function getClientAlarmAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!clientAlarmAudioContext) clientAlarmAudioContext = new AudioContextClass();
  return clientAlarmAudioContext;
}

async function requestRestaurantNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

function showRestaurantNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "app-icon-192.png",
      tag: "rincon-colombiano-client-order",
    });
  } catch {
    // Algunos navegadores bloquean notificaciones aunque el permiso exista.
  }
}

async function enableClientAlarm() {
  const context = getClientAlarmAudioContext();
  if (context?.state === "suspended") await context.resume();
  try {
    await requestRestaurantNotificationPermission();
  } catch {
    // La alarma sonora sigue funcionando aunque el navegador bloquee notificaciones.
  }
  clientAlarmEnabled = true;
  localStorage.setItem(STORAGE_KEYS.clientAlarmEnabled, "1");
  updateClientAlarmButton();
  ringClientAlarm();
  syncClientAlarm();
  showToast("Alarma de pedidos activada.");
}

function disableClientAlarm() {
  clientAlarmEnabled = false;
  localStorage.removeItem(STORAGE_KEYS.clientAlarmEnabled);
  stopClientAlarm();
  updateClientAlarmButton();
  showToast("Alarma de pedidos apagada.");
}

function toggleClientAlarm() {
  if (clientAlarmEnabled) {
    disableClientAlarm();
    return;
  }
  enableClientAlarm().catch(() => {
    showToast("No se pudo activar sonido en este navegador.");
  });
}

function ringClientAlarm() {
  if (!clientAlarmEnabled || pendingClientOrdersCount() === 0) return;
  const context = getClientAlarmAudioContext();
  if (!context || context.state === "suspended") return;

  const now = context.currentTime;
  [0, 0.18, 0.36, 0.54].forEach((offset) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, now + offset);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.11);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.12);
  });
}

function syncClientAlarm() {
  if (!clientAlarmEnabled || pendingClientOrdersCount() === 0) {
    stopClientAlarm();
    return;
  }
  if (clientAlarmTimer) return;
  ringClientAlarm();
  clientAlarmTimer = window.setInterval(ringClientAlarm, 2400);
}

function stopClientAlarm() {
  if (clientAlarmTimer) {
    window.clearInterval(clientAlarmTimer);
    clientAlarmTimer = null;
  }
}

function startClientOrdersPolling() {
  stopClientOrdersPolling();
  if (!canUseCustomerModule()) return;
  clientOrdersTimer = window.setInterval(() => {
    refreshClientOrders({ silent: true }).catch(() => {});
  }, 20000);
}

function stopClientOrdersPolling() {
  if (clientOrdersTimer) {
    window.clearInterval(clientOrdersTimer);
    clientOrdersTimer = null;
  }
}

async function refreshClientOrders(options = {}) {
  const { silent = false } = options;
  const previousIds = new Set(pendingClientOrders.filter((order) => order.status === "pending").map((order) => order.id));
  if (!canUseCustomerModule()) {
    pendingClientOrders = [];
    updateClientOrdersBadge();
    if (elements.clientOrdersDialog.open) {
      elements.clientOrdersList.innerHTML = `<div class="monthly-empty">Inicia sesion para recibir pedidos de clientes.</div>`;
    }
    return;
  }

  if (!navigator.onLine) {
    if (!silent || elements.clientOrdersDialog.open) {
      elements.clientOrdersList.innerHTML = `<div class="monthly-empty">Sin internet. Los pedidos del cliente necesitan conexion.</div>`;
    }
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await cloudState.client
    .from("customer_orders")
    .select("id, status, table_label, customer_name, order_type, order_json, total, created_at")
    .eq("user_id", cloudState.user.id)
    .in("status", ["pending", "accepted", "sent"])
    .gte("created_at", startOfDay.toISOString())
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    if (!silent || elements.clientOrdersDialog.open) {
      elements.clientOrdersList.innerHTML = `<div class="monthly-empty">No se pudieron cargar pedidos de clientes. Ejecuta el SQL actualizado de Supabase.</div>`;
    }
    throw error;
  }

  const orders = data || [];
  pendingClientOrders = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      messages: await loadRestaurantChatMessages(order.id),
    }))
  );
  notifyNewClientChatMessages(pendingClientOrders);
  const newOrdersCount = pendingClientOrders.filter((order) => order.status === "pending" && !previousIds.has(order.id)).length;
  updateClientOrdersBadge();
  renderClientOrders();
  if (newOrdersCount > 0) {
    showToast(`${newOrdersCount} pedido cliente nuevo.`);
    showRestaurantNotification(
      "Pedido cliente nuevo",
      `${newOrdersCount} pedido pendiente esperando aceptacion.`
    );
    syncClientAlarm();
  }
}

function clientOrderItems(row) {
  return Array.isArray(row?.order_json?.items) ? row.order_json.items : [];
}

function clientOrderTotal(row) {
  const total = Number.parseFloat(row?.total);
  if (Number.isFinite(total)) return total;
  return clientOrderItems(row).reduce((sum, item) => sum + itemLineTotal(item), 0);
}

function clientOrderStatusLabel(status) {
  if (status === "accepted") return "Aceptado";
  if (status === "sent") return "Enviado";
  if (status === "delivered") return "Entregado";
  if (status === "cancelled") return "Cancelado";
  return "Pendiente";
}

function clientOrderActionsHtml(status) {
  if (status === "pending") {
    return `
      <div class="client-order-actions">
        <button type="button" data-action="accept-client-order">Aceptar e imprimir</button>
        <button type="button" data-action="cancel-client-order">Cancelar</button>
      </div>
    `;
  }

  if (status === "accepted") {
    return `
      <div class="client-order-actions">
        <button type="button" data-action="sent-client-order">Pedido enviado</button>
        <button type="button" data-action="cancel-client-order">Cancelar</button>
      </div>
    `;
  }

  if (status === "sent") {
    return `
      <div class="client-order-actions">
        <button type="button" data-action="delivered-client-order">Pedido entregado</button>
      </div>
    `;
  }

  return `<p class="client-order-note">Estado actualizado. El chat queda abierto durante el dia para soporte.</p>`;
}

async function loadRestaurantChatMessages(orderId) {
  if (!cloudState.client || !orderId) return [];
  const { data, error } = await cloudState.client.rpc("get_restaurant_order_messages", {
    p_order_id: orderId,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

function notifyNewClientChatMessages(orders) {
  const messages = orders.flatMap((order) => order.messages || []);
  const hasNewCustomerMessage = messages.some(
    (message) => message.sender === "customer" && clientChatLoadedOnce && !clientChatKnownMessageIds.has(message.id)
  );
  clientChatKnownMessageIds = new Set(messages.map((message) => message.id));
  clientChatLoadedOnce = true;
  if (hasNewCustomerMessage) {
    showToast("Nuevo mensaje de cliente en chat.");
    showRestaurantNotification("Mensaje de cliente", "Hay una respuesta o comprobante en un pedido.");
  }
}

function clientChatImageHtml(message) {
  const image = String(message?.image_data_url || "");
  if (!image.startsWith("data:image/")) return "";
  return `<a href="${escapeHtml(image)}" target="_blank" rel="noopener"><img src="${escapeHtml(image)}" alt="Imagen enviada en chat" loading="lazy" /></a>`;
}

function renderClientChat(order) {
  const messages = Array.isArray(order.messages) ? order.messages : [];
  return `
    <section class="client-chat-box">
      <strong>Chat / soporte</strong>
      <div class="client-chat-messages">
        ${
          messages.length
            ? messages
                .map(
                  (message) => `
                    <article class="client-chat-message ${message.sender === "restaurant" ? "restaurant" : "customer"}">
                      <strong>${message.sender === "restaurant" ? "Restaurante" : "Cliente"}</strong>
                      ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
                      ${clientChatImageHtml(message)}
                    </article>
                  `
                )
                .join("")
            : `<div class="customer-empty">Sin mensajes. Aqui aparecera el comprobante o consulta del cliente.</div>`
        }
      </div>
      <textarea data-action="restaurant-chat-input" rows="2" placeholder="Responder al cliente..."></textarea>
      <input data-action="restaurant-chat-image" type="file" accept="image/*" />
      <button type="button" data-action="send-client-message">Enviar chat</button>
    </section>
  `;
}

function renderClientOrders() {
  if (!elements.clientOrdersList) return;
  if (!pendingClientOrders.length) {
    elements.clientOrdersList.innerHTML = `<div class="monthly-empty">No hay pedidos de clientes de hoy.</div>`;
    return;
  }

  elements.clientOrdersList.innerHTML = pendingClientOrders
    .map((order) => {
      const created = new Date(order.created_at);
      const timeText = Number.isNaN(created.getTime())
        ? ""
        : created.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });
      const items = clientOrderItems(order);
      const customerLabel = [order.table_label, order.customer_name].filter(Boolean).join(" - ") || "Cliente QR";
      const paymentMethod = paymentMethodLabel(order.order_json?.paymentMethod);
      const deliverySummary = formatDeliverySummary(order.order_json?.delivery);

      return `
        <article class="client-order-card" data-client-order-id="${escapeHtml(order.id)}">
          <div class="client-order-head">
            <div>
              <strong>${escapeHtml(customerLabel)}</strong>
              <span>${escapeHtml(orderTypeLabel(order.order_type))}${timeText ? ` / ${escapeHtml(timeText)}` : ""}</span>
              <span>Estado: ${clientOrderStatusLabel(order.status)}</span>
              <span>Pago: ${escapeHtml(paymentMethod)}</span>
            </div>
            <strong>${formatMoney(clientOrderTotal(order))}</strong>
          </div>
          <div class="client-order-items">
            ${items
              .map(
                (item) => `
                  <div>
                    <strong>${itemQuantity(item)} x ${escapeHtml(itemReportName(item))}</strong>
                    ${item.note ? `<span>NOTA: ${escapeHtml(normalizeNoteText(item.note))}</span>` : ""}
                  </div>
                `
              )
              .join("")}
          </div>
          ${
            order.order_json?.notes
              ? `<p class="client-order-note">NOTAS: ${escapeHtml(normalizeNoteText(order.order_json.notes))}</p>`
              : ""
          }
          ${deliverySummary ? `<p class="client-order-note">DOMICILIO: ${escapeHtml(deliverySummary)}</p>` : ""}
          ${renderClientChat(order)}
          ${clientOrderActionsHtml(order.status)}
        </article>
      `;
    })
    .join("");
}

function orderFromClientOrder(clientOrder) {
  const payload = clientOrder.order_json || {};
  const tableLabel = String(clientOrder.table_label || payload.table || "").trim();
  const customerName = String(clientOrder.customer_name || payload.customer || "").trim();
  const customerLabel = [tableLabel, customerName].filter(Boolean).join(" - ") || "Cliente QR";
  const clientNote = normalizeNoteText(payload.notes);
  const qrNote = `PEDIDO CLIENTE QR ${String(clientOrder.id || "").slice(0, 8).toUpperCase()}`;

  return {
    ...createBlankOrder(),
    type: normalizeOrderType(clientOrder.order_type || payload.type),
    paymentMethod: normalizePaymentMethod(payload.paymentMethod),
    customer: customerLabel,
    server: shiftServerName || elements.serverName.value.trim() || "Caja",
    notes: [clientNote, qrNote].filter(Boolean).join(" | "),
    delivery: normalizeDeliveryInfo(payload.delivery),
    items: clientOrderItems(clientOrder)
      .map((item) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        productId: item.product_id || item.productId || "",
        name: itemReportName(item),
        price: itemPrice(item),
        qty: Math.max(1, Number.parseInt(itemQuantity(item), 10) || 1),
        note: normalizeNoteText(item.note),
      }))
      .filter((item) => item.name),
  };
}

async function acceptClientOrder(orderId) {
  const clientOrder = pendingClientOrders.find((order) => order.id === orderId);
  if (!clientOrder) return;
  if (!canUseCustomerModule() || !navigator.onLine) {
    alert("Necesitas internet e iniciar sesion para aceptar pedidos de clientes.");
    return;
  }

  if (currentOrder.items.length && !currentOrder.saved) {
    const replaceOrder = confirm("Hay un pedido manual sin guardar. Deseas reemplazarlo por el pedido del cliente?");
    if (!replaceOrder) return;
  }

  currentOrder = orderFromClientOrder(clientOrder);
  renderOrder();
  if (!(await upsertCurrentOrder())) return;

  const acceptedOrderId = currentOrder.id;
  const { error } = await cloudState.client
    .from("customer_orders")
    .update({
      status: "accepted",
      restaurant_order_id: acceptedOrderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("user_id", cloudState.user.id);

  if (error) {
    alert("El pedido se guardo, pero no se pudo marcar como aceptado en la bandeja.");
  } else {
    pendingClientOrders = pendingClientOrders.map((order) =>
      order.id === orderId
        ? { ...order, status: "accepted", restaurant_order_id: acceptedOrderId, updated_at: new Date().toISOString() }
        : order
    );
    updateClientOrdersBadge();
    renderClientOrders();
  }

  renderPrintTicket(currentOrder);
  applyReceiptPrintStyle();
  window.print();
  showToast(`Pedido cliente aceptado como ${formatTicket(currentOrder.ticketNumber)}.`);
}

async function updateClientOrderStatus(orderId, nextStatus, successMessage, options = {}) {
  const clientOrder = pendingClientOrders.find((order) => order.id === orderId);
  if (!clientOrder) return;
  if (!canUseCustomerModule() || !navigator.onLine) {
    alert("Necesitas internet e iniciar sesion para actualizar pedidos de clientes.");
    return;
  }

  const { error } = await cloudState.client
    .from("customer_orders")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", cloudState.user.id);

  if (error) {
    alert("No se pudo actualizar el estado del pedido del cliente.");
    return;
  }

  if (options.removeFromList) {
    pendingClientOrders = pendingClientOrders.filter((order) => order.id !== orderId);
  } else {
    pendingClientOrders = pendingClientOrders.map((order) =>
      order.id === orderId ? { ...order, status: nextStatus, updated_at: new Date().toISOString() } : order
    );
  }

  updateClientOrdersBadge();
  renderClientOrders();
  showToast(successMessage);
}

async function markClientOrderSent(orderId) {
  await updateClientOrderStatus(orderId, "sent", "Pedido marcado como enviado. El cliente sera notificado.");
}

async function markClientOrderDelivered(orderId) {
  const clientOrder = pendingClientOrders.find((order) => order.id === orderId);
  if (!clientOrder) return;
  const label = [clientOrder.table_label, clientOrder.customer_name].filter(Boolean).join(" - ") || "Cliente QR";
  const shouldMarkDelivered = confirm(`Marcar como entregado el pedido de ${label}?`);
  if (!shouldMarkDelivered) return;
  await updateClientOrderStatus(orderId, "delivered", "Pedido marcado como entregado. El cliente sera notificado.", {
    removeFromList: true,
  });
}

async function cancelClientOrder(orderId) {
  const clientOrder = pendingClientOrders.find((order) => order.id === orderId);
  if (!clientOrder) return;
  if (!canUseCustomerModule() || !navigator.onLine) {
    alert("Necesitas internet e iniciar sesion para cancelar pedidos de clientes.");
    return;
  }

  const label = [clientOrder.table_label, clientOrder.customer_name].filter(Boolean).join(" - ") || "Cliente QR";
  const shouldCancel = confirm(`Cancelar el pedido de ${label}?`);
  if (!shouldCancel) return;

  const { error } = await cloudState.client
    .from("customer_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("user_id", cloudState.user.id);

  if (error) {
    alert("No se pudo cancelar el pedido del cliente.");
    return;
  }

  pendingClientOrders = pendingClientOrders.filter((order) => order.id !== orderId);
  updateClientOrdersBadge();
  renderClientOrders();
  showToast("Pedido de cliente cancelado.");
}

async function restaurantImageFileToDataUrl(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen valida.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen es muy pesada. Usa una foto menor a 5 MB.");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("No se pudo leer la imagen.")));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("No se pudo preparar la imagen.")));
    img.src = dataUrl;
  });

  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL("image/jpeg", 0.76);
  if (compressed.length > 950000) {
    throw new Error("La imagen sigue muy pesada. Recorta la foto o baja la calidad.");
  }
  return compressed;
}

async function sendRestaurantChatMessage(orderId, card) {
  if (!canUseCustomerModule() || !navigator.onLine) {
    alert("Necesitas internet e iniciar sesion para responder el chat.");
    return;
  }

  const textarea = card.querySelector('textarea[data-action="restaurant-chat-input"]');
  const fileInput = card.querySelector('input[data-action="restaurant-chat-image"]');
  const button = card.querySelector('button[data-action="send-client-message"]');
  const body = normalizeTextSetting(textarea?.value || "");
  const file = fileInput?.files?.[0] || null;
  if (!body && !file) {
    showToast("Escribe un mensaje o agrega una imagen.");
    return;
  }

  button.disabled = true;
  try {
    const imageDataUrl = await restaurantImageFileToDataUrl(file);
    const { error } = await cloudState.client.rpc("create_restaurant_message", {
      p_order_id: orderId,
      p_body: body,
      p_image_data_url: imageDataUrl,
    });
    if (error) throw error;
    if (textarea) textarea.value = "";
    if (fileInput) fileInput.value = "";
    showToast("Mensaje enviado al cliente.");
    await refreshClientOrders({ silent: true });
  } catch (error) {
    alert(error.message || "No se pudo enviar el mensaje.");
  } finally {
    button.disabled = false;
  }
}

function buildClientOrderLink() {
  if (!cloudState.user) return "";
  const url = new URL("./cliente.html", window.location.href);
  url.searchParams.set("store", cloudState.user.id);
  url.searchParams.set("app", APP_VERSION);
  const tableLabel = elements.qrTableInput.value.trim();
  if (tableLabel) url.searchParams.set("mesa", tableLabel);
  return url.toString();
}

function updateQrPreview() {
  const link = buildClientOrderLink();
  elements.qrLinkInput.value = link;
  if (!link) {
    elements.qrImage.removeAttribute("src");
    elements.qrHint.textContent = "Inicia sesion para generar el QR del restaurante.";
    return;
  }

  elements.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(link)}`;
  elements.qrHint.textContent = elements.qrTableInput.value.trim()
    ? "QR con mesa/ubicacion incluida. Puedes imprimirlo o mostrarlo al cliente."
    : "QR general del restaurante. El cliente escribira mesa, nombre o domicilio.";
}

async function syncMenuBeforeQr() {
  if (!cloudState.user) return false;
  if (!navigator.onLine) {
    alert("Para que el QR muestre el menu real actualizado, conecta internet y vuelve a abrir el QR.");
    return false;
  }

  try {
    await saveCloudSettings();
    clearSettingsPending();
    updateCloudStatus();
    return true;
  } catch (error) {
    console.error(error);
    markSettingsPending();
    updateCloudStatus();
    alert("No pude subir el menu actual a la nube. El QR podria mostrar un menu viejo hasta que vuelva a sincronizar.");
    return false;
  }
}

async function openQrDialog() {
  if (!cloudState.configured) {
    alert("Configura Supabase antes de usar pedidos por QR.");
    return;
  }
  if (!cloudState.user) {
    alert("Inicia sesion para generar el QR del cliente.");
    openSignInScreen();
    return;
  }
  const synced = await syncMenuBeforeQr();
  if (!synced) return;
  updateQrPreview();
  elements.qrDialog.showModal();
}

async function copyQrLink() {
  const link = elements.qrLinkInput.value;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
    showToast("Link de cliente copiado.");
  } catch {
    elements.qrLinkInput.select();
    document.execCommand?.("copy");
    showToast("Link de cliente listo para copiar.");
  }
}

function openClientPage() {
  const link = elements.qrLinkInput.value;
  if (link) window.open(link, "_blank", "noopener");
}

async function openClientOrdersDialog() {
  if (!cloudState.configured) {
    alert("Configura Supabase antes de recibir pedidos de clientes.");
    return;
  }
  if (!cloudState.user) {
    alert("Inicia sesion para ver pedidos de clientes.");
    openSignInScreen();
    return;
  }
  elements.clientOrdersDialog.showModal();
  elements.clientOrdersList.innerHTML = `<div class="monthly-empty">Cargando pedidos de clientes...</div>`;
  try {
    await refreshClientOrders();
  } catch (error) {
    console.error(error);
  }
}

async function syncPendingData(options = {}) {
  const { silent = false, allowWhileLoading = false } = options;
  if (!cloudState.client || !cloudState.user || cloudState.syncing || !navigator.onLine) {
    updateCloudStatus();
    return;
  }
  if (cloudState.loading && !allowWhileLoading) return;

  const pendingDeletedOrderIds = readDeletedOrderIds();
  const pendingOrders = savedOrders.filter((order) => needsCloudSync(order) && !pendingDeletedOrderIds.includes(order.id));
  const shouldSyncSettings = hasPendingSettings();
  if (!pendingOrders.length && !pendingDeletedOrderIds.length && !shouldSyncSettings) {
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

    for (const orderId of pendingDeletedOrderIds) {
      await deleteCloudOrder(orderId);
      clearDeletedOrderId(orderId);
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

  const profile = restaurantSignupProfileFromInputs(email);
  if (!normalizeTextSetting(elements.authRestaurantNameInput?.value || "")) {
    elements.authMessage.textContent = "Escribe el nombre comercial del restaurante para registrarlo.";
    elements.authRestaurantNameInput?.focus();
    return;
  }
  if (!profile.legalBusinessName) {
    elements.authMessage.textContent = "Escribe la razon social o nombre legal de la empresa.";
    elements.authLegalNameInput?.focus();
    return;
  }
  if (!profile.legalAddress) {
    elements.authMessage.textContent = "Escribe la direccion legal o direccion del punto.";
    elements.authLegalAddressInput?.focus();
    return;
  }
  if (!profile.businessPhone) {
    elements.authMessage.textContent = "Escribe el telefono del restaurante.";
    elements.authBusinessPhoneInput?.focus();
    return;
  }
  if (!profile.ownerName) {
    elements.authMessage.textContent = "Escribe el nombre del responsable o administrador.";
    elements.authOwnerNameInput?.focus();
    return;
  }
  if (!profile.legalConsent) {
    elements.authMessage.textContent = "Debes confirmar que puedes administrar el restaurante y aceptar el tratamiento tecnico de datos.";
    elements.authLegalConsentInput?.focus();
    return;
  }
  if (await restaurantNameAlreadyExists(profile.businessName)) {
    elements.authMessage.textContent = "Ya existe un restaurante activo con ese nombre. Usa un nombre diferente o inicia sesion con la cuenta correcta.";
    elements.authRestaurantNameInput?.focus();
    return;
  }

  applyRestaurantProfile(profile, { onlyIfEmpty: false });
  elements.authMessage.textContent = "Creando cuenta...";
  try {
    const { error } = await cloudState.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.href.split("#")[0].split("?")[0],
        data: {
          account_type: "restaurant",
          app_name: profile.businessName,
          business_name: profile.businessName,
          legal_business_name: profile.legalBusinessName,
          tax_id: profile.taxId,
          legal_address: profile.legalAddress,
          business_phone: profile.businessPhone,
          business_email: profile.businessEmail,
          owner_name: profile.ownerName,
          privacy_accepted_at: new Date().toISOString(),
          restaurant_profile: profile,
        },
      },
    });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
    return;
  }

  elements.authMessage.textContent =
    "Cuenta del restaurante creada. RINCON COLOMBIANO PEDIDOS te envio un correo de verificacion. Abre ese correo, confirma la cuenta y despues inicia sesion.";
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

  elements.authMessage.textContent = "RINCON COLOMBIANO PEDIDOS esta enviando el correo de recuperacion...";
  const redirectTo = window.location.href.split("#")[0].split("?")[0];

  try {
    const { error } = await cloudState.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
    elements.authMessage.textContent =
      "Correo enviado por RINCON COLOMBIANO PEDIDOS. Abre el enlace del correo para crear una contrasena nueva.";
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
  }
}

async function resendVerificationEmail() {
  const email = elements.authEmail.value.trim();
  if (!email) {
    elements.authMessage.textContent = "Escribe tu correo electronico para reenviar la verificacion.";
    elements.authEmail.focus();
    return;
  }

  if (!cloudState.client) {
    elements.authMessage.textContent = "No se pudo conectar con Supabase. Revisa internet.";
    return;
  }

  elements.authMessage.textContent = "RINCON COLOMBIANO PEDIDOS esta reenviando el correo de verificacion...";
  try {
    const { error } = await cloudState.client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.href.split("#")[0].split("?")[0] },
    });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
    elements.authMessage.textContent =
      "Correo de verificacion reenviado por RINCON COLOMBIANO PEDIDOS. Revisa entrada, spam o promociones.";
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
  }
}

async function refreshRestaurantApp() {
  syncFormToOrder();
  saveCurrentOrderDraft();
  showToast("Actualizando sin borrar el pedido actual...");

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update?.();
    }
  } catch (error) {
    console.error(error);
  }

  try {
    if (cloudState.configured && cloudState.user && navigator.onLine) {
      await syncPendingData({ silent: true });
      await loadCloudData();
      await refreshClientOrders({ silent: true });
      showToast("App y nube actualizadas. Pedido actual conservado.");
      return;
    }
    renderCategories();
    renderMenu();
    renderOrder();
    renderHistory();
    showToast("Pantalla actualizada. Pedido actual conservado.");
  } catch (error) {
    console.error(error);
    showToast("No se pudo actualizar todo. El pedido actual sigue guardado.");
  }
}

function showPasswordRecoveryForm() {
  cloudState.recoveringPassword = true;
  elements.authScreen.hidden = false;
  if (elements.restaurantAuthDialog?.showModal && !elements.restaurantAuthDialog.open) {
    elements.restaurantAuthDialog.showModal();
  }
  elements.passwordRecoveryPanel.hidden = false;
  if (elements.restaurantAuthTitle) elements.restaurantAuthTitle.textContent = "Nueva contrasena";
  elements.authPassword.closest("label").hidden = true;
  elements.signInButton.hidden = true;
  elements.signUpButton.hidden = true;
  elements.resetPasswordButton.hidden = true;
  renderCloudState("RINCON COLOMBIANO PEDIDOS verifico el enlace. Escribe tu nueva contrasena.");
  elements.newPasswordInput.focus();
}

function hidePasswordRecoveryForm(message = "") {
  cloudState.recoveringPassword = false;
  elements.passwordRecoveryPanel.hidden = true;
  elements.newPasswordInput.value = "";
  elements.authPassword.closest("label").hidden = false;
  setRestaurantAuthMode(elements.authForm.dataset.mode || "login");
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
    hidePasswordRecoveryForm("Contrasena actualizada. Ya puedes iniciar sesion en RINCON COLOMBIANO PEDIDOS.");
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
  }
}

function friendlyAuthError(error) {
  const message = error?.message || String(error || "");
  if (message.toLowerCase().includes("invalid path specified")) {
    return "URL de Supabase incorrecta. Usa solo https://tu-proyecto.supabase.co, sin /rest/v1.";
  }
  if (/email not confirmed/i.test(message)) {
    return "RINCON COLOMBIANO PEDIDOS envio un correo de verificacion. Revisa tu correo, confirma la cuenta y vuelve a iniciar sesion.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Correo o contrasena incorrectos.";
  }

  return message;
}

async function signOut() {
  if (!cloudState.client) return;
  await cloudState.client.auth.signOut();
  cloudState.user = null;
  cloudState.ready = false;
  pendingClientOrders = [];
  stopClientOrdersPolling();
  stopClientAlarm();
  clearRememberedCloudSession();
  updateClientOrdersBadge();
  renderCloudState("Sesion cerrada.");
}

function readMenuCatalog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.menu) || "null");
    return normalizeMenuCatalog(parsed || EMPTY_MENU_CATALOG);
  } catch {
    return normalizeMenuCatalog(EMPTY_MENU_CATALOG);
  }
}

function cleanCategoryName(value) {
  const cleanName = String(value || "").trim().replace(/\s+/g, " ");
  return cleanName === "Fuertes" ? "Platos principales" : cleanName;
}

function categoryIdentityKey(value) {
  return cleanCategoryName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findCategoryByName(name) {
  const key = categoryIdentityKey(name);
  return Object.keys(menuCatalog).find((category) => categoryIdentityKey(category) === key) || "";
}

function normalizeProductImageUrl(value) {
  return String(value || "").trim();
}

function normalizeProductDescription(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 260);
}

function hashText(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeProductId(value) {
  return String(value || "").trim().replace(/\s+/g, "-").slice(0, 90);
}

function stableProductId(category, name, description = "") {
  const cleanCategory = categoryIdentityKey(category) || "menu";
  const cleanName = categoryIdentityKey(name) || "producto";
  return `prod-${cleanCategory}-${cleanName}-${hashText(`${category}|${name}|${description}`)}`;
}

function createProductId() {
  const rawId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `prod-${rawId}`;
}

function productIsAvailable(product) {
  return product?.available !== false;
}

function normalizeMenuCatalog(menu) {
  const normalized = {};
  const categoriesByKey = new Map();

  Object.entries(menu || {}).forEach(([category, dishes]) => {
    const cleanCategory = cleanCategoryName(category);
    if (!cleanCategory) return;
    const categoryKey = categoryIdentityKey(cleanCategory);
    const finalCategory = categoriesByKey.get(categoryKey) || cleanCategory;
    categoriesByKey.set(categoryKey, finalCategory);
    if (!normalized[finalCategory]) normalized[finalCategory] = [];

    if (Array.isArray(dishes)) {
      dishes.forEach((dish) => {
        const name = String(dish?.name || "").trim();
        const price = Number.parseFloat(dish?.price) || 0;
        const imageUrl = normalizeProductImageUrl(dish?.imageUrl || dish?.image || dish?.photo || "");
        const description = normalizeProductDescription(dish?.description || dish?.descripcion || dish?.details || "");
        if (name) {
          normalized[finalCategory].push({
            id: normalizeProductId(dish?.id || dish?.productId) || stableProductId(finalCategory, name, description),
            name,
            price,
            available: dish?.available === false ? false : true,
            imageUrl,
            description,
          });
        }
      });
    }
  });

  if (!Object.keys(normalized).length) normalized.Entradas = [];

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

function normalizeBusinessName(value) {
  const name = normalizeTextSetting(value).replace(/\s+/g, " ");
  return name || DEFAULT_BUSINESS_NAME;
}

function readBusinessName() {
  return normalizeBusinessName(localStorage.getItem(STORAGE_KEYS.businessName) || DEFAULT_BUSINESS_NAME);
}

function applyBusinessNameToUi() {
  const name = normalizeBusinessName(businessName);
  businessName = name;
  if (elements.authBusinessName) elements.authBusinessName.textContent = `${name} PEDIDOS`;
  if (elements.appBusinessName) elements.appBusinessName.textContent = name;
  [elements.authLogoImage, elements.appLogoImage].forEach((image) => {
    if (!image) return;
    if (businessLogoUrl) {
      image.src = businessLogoUrl;
      image.hidden = false;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
    }
  });
  document.title = `${name} - Pedidos`;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute("content", name);
}

function readCurrencyPosition() {
  const position = localStorage.getItem(STORAGE_KEYS.currencyPosition);
  return position === "after" ? "after" : "before";
}

function readMoneyFormat() {
  const format = localStorage.getItem(STORAGE_KEYS.moneyFormat);
  return format === "eu" ? "eu" : "us";
}

function normalizeMoneyValue(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeReceiptWidth(value) {
  const width = Number.parseInt(value, 10);
  if (!Number.isFinite(width)) return 80;
  return Math.min(120, Math.max(50, width));
}

function readReceiptWidthMm() {
  return normalizeReceiptWidth(localStorage.getItem(STORAGE_KEYS.receiptWidthMm) || 80);
}

function readDeliveryFee() {
  return normalizeMoneyValue(localStorage.getItem(STORAGE_KEYS.deliveryFee) || 0);
}

function normalizeDeliveryMinimumFee(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number >= 0 ? number : DEFAULT_DELIVERY_MINIMUM_FEE;
}

function readDeliveryMinimumFee() {
  const saved = localStorage.getItem(STORAGE_KEYS.deliveryMinimumFee);
  return saved === null ? DEFAULT_DELIVERY_MINIMUM_FEE : normalizeDeliveryMinimumFee(saved);
}

function normalizeTextSetting(value) {
  return String(value || "").trim();
}

function readBusinessLogoUrl() {
  return normalizeProductImageUrl(localStorage.getItem(STORAGE_KEYS.businessLogoUrl) || "");
}

function readRestaurantActive() {
  return localStorage.getItem(STORAGE_KEYS.restaurantActive) !== "0";
}

function readLegalBusinessName() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.legalBusinessName) || "");
}

function readTaxId() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.taxId) || "");
}

function readBusinessPhone() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.businessPhone) || "");
}

function readBusinessEmail() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.businessEmail) || "");
}

function readLegalAddress() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.legalAddress) || "");
}

function readRestaurantAddress() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.restaurantAddress) || "");
}

function readGoogleMapsApiKey() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.googleMapsApiKey) || "");
}

function readBankAccount() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.bankAccount) || "");
}

function readBankTransferNote() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.bankTransferNote) || "");
}

function normalizeOnlinePaymentProvider(value) {
  return ["disabled", "sumup", "stripe", "manual_link"].includes(value) ? value : "disabled";
}

function readOnlinePaymentProvider() {
  return normalizeOnlinePaymentProvider(localStorage.getItem(STORAGE_KEYS.onlinePaymentProvider) || "disabled");
}

function readOnlinePaymentNote() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.onlinePaymentNote) || "");
}

function readClientAlarmEnabled() {
  return localStorage.getItem(STORAGE_KEYS.clientAlarmEnabled) === "1";
}

function readShiftServerName() {
  return localStorage.getItem(STORAGE_KEYS.shiftServerName) || "";
}

function saveShiftServerName(name) {
  shiftServerName = String(name || "").trim();
  localStorage.setItem(STORAGE_KEYS.shiftServerName, shiftServerName);
}

function openShiftDialog(force = false) {
  elements.shiftServerInput.value = shiftServerName || elements.serverName.value.trim();
  elements.shiftDialog.dataset.force = force ? "1" : "0";
  elements.shiftDialog.showModal();
  elements.shiftServerInput.focus();
}

function saveShiftFromDialog() {
  const name = elements.shiftServerInput.value.trim();
  if (!name) {
    alert("Escribe el nombre de quien tomara pedidos en este turno.");
    return;
  }

  saveShiftServerName(name);
  if (!currentOrder.saved || !currentOrder.server) {
    currentOrder.server = shiftServerName;
    elements.serverName.value = shiftServerName;
  }
  elements.shiftDialog.close();
  renderOrder();
}

function maybeAskShiftServer() {
  if (shiftServerName || elements.shiftDialog.open) return;
  window.setTimeout(() => openShiftDialog(true), 250);
}

function showToast(message) {
  if (!elements.toastNotice) return;
  window.clearTimeout(toastTimer);
  elements.toastNotice.textContent = message;
  elements.toastNotice.hidden = false;
  window.requestAnimationFrame?.(() => elements.toastNotice.classList.add("show"));
  if (!window.requestAnimationFrame) elements.toastNotice.classList.add("show");
  toastTimer = window.setTimeout(() => {
    elements.toastNotice.classList.remove("show");
    window.setTimeout(() => {
      elements.toastNotice.hidden = true;
    }, 180);
  }, 2600);
}

function saveCurrencySymbol() {
  businessName = normalizeBusinessName(elements.businessNameInput?.value || businessName);
  businessLogoUrl = normalizeProductImageUrl(elements.businessLogoUrlInput?.value || "");
  legalBusinessName = normalizeTextSetting(elements.legalBusinessNameInput?.value || "");
  taxId = normalizeTextSetting(elements.taxIdInput?.value || "");
  businessPhone = normalizeTextSetting(elements.businessPhoneInput?.value || "");
  businessEmail = normalizeTextSetting(elements.businessEmailInput?.value || "");
  legalAddress = normalizeTextSetting(elements.legalAddressInput?.value || "");
  const symbol = elements.currencySymbolInput.value.trim() || "$";
  currencySymbol = symbol;
  currencyPosition = elements.currencyPositionSelect.value === "after" ? "after" : "before";
  moneyFormat = elements.moneyFormatSelect.value === "eu" ? "eu" : "us";
  receiptWidthMm = normalizeReceiptWidth(elements.receiptWidthInput.value);
  deliveryFee = normalizeMoneyValue(elements.deliveryFeeInput.value);
  deliveryMinimumFee = normalizeDeliveryMinimumFee(elements.deliveryMinimumFeeInput?.value);
  restaurantAddress = normalizeTextSetting(elements.restaurantAddressInput.value);
  googleMapsApiKey = normalizeTextSetting(elements.googleMapsApiKeyInput.value);
  bankAccount = normalizeTextSetting(elements.bankAccountInput.value);
  bankTransferNote = normalizeTextSetting(elements.bankTransferNoteInput.value);
  onlinePaymentProvider = normalizeOnlinePaymentProvider(elements.onlinePaymentProviderSelect?.value || "disabled");
  onlinePaymentNote = normalizeTextSetting(elements.onlinePaymentNoteInput?.value || "");
  localStorage.setItem(STORAGE_KEYS.businessName, businessName);
  localStorage.setItem(STORAGE_KEYS.businessLogoUrl, businessLogoUrl);
  localStorage.setItem(STORAGE_KEYS.legalBusinessName, legalBusinessName);
  localStorage.setItem(STORAGE_KEYS.taxId, taxId);
  localStorage.setItem(STORAGE_KEYS.businessPhone, businessPhone);
  localStorage.setItem(STORAGE_KEYS.businessEmail, businessEmail);
  localStorage.setItem(STORAGE_KEYS.legalAddress, legalAddress);
  localStorage.setItem(STORAGE_KEYS.currencySymbol, currencySymbol);
  localStorage.setItem(STORAGE_KEYS.currencyPosition, currencyPosition);
  localStorage.setItem(STORAGE_KEYS.moneyFormat, moneyFormat);
  localStorage.setItem(STORAGE_KEYS.receiptWidthMm, String(receiptWidthMm));
  localStorage.setItem(STORAGE_KEYS.deliveryFee, String(deliveryFee));
  localStorage.setItem(STORAGE_KEYS.deliveryMinimumFee, String(deliveryMinimumFee));
  localStorage.setItem(STORAGE_KEYS.restaurantAddress, restaurantAddress);
  localStorage.setItem(STORAGE_KEYS.googleMapsApiKey, googleMapsApiKey);
  localStorage.setItem(STORAGE_KEYS.bankAccount, bankAccount);
  localStorage.setItem(STORAGE_KEYS.bankTransferNote, bankTransferNote);
  localStorage.setItem(STORAGE_KEYS.onlinePaymentProvider, onlinePaymentProvider);
  localStorage.setItem(STORAGE_KEYS.onlinePaymentNote, onlinePaymentNote);
  localStorage.setItem(STORAGE_KEYS.restaurantActive, restaurantActive ? "1" : "0");
  applyBusinessNameToUi();
  renderCurrencySettings();
  renderMenu();
  renderOrder();
  renderHistory();
  if (elements.menuEditorDialog.open) renderMenuEditor();
  if (elements.dailyCloseDialog.open) renderDailyClose(elements.closeDayInput.value || todayKey);
  if (elements.monthlyCloseDialog.open) renderMonthlyClose(elements.closeMonthInput.value || currentMonthKey());
  saveSettingsWhenPossible();
  showToast("Ajustes guardados.");
}

function useRestaurantCurrentLocation() {
  if (!navigator.geolocation) {
    alert("Este dispositivo no permite obtener ubicacion.");
    return;
  }

  elements.useRestaurantLocationButton.disabled = true;
  showToast("Solicitando ubicacion del restaurante...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = Number(position.coords.latitude).toFixed(6);
      const lng = Number(position.coords.longitude).toFixed(6);
      restaurantAddress = `${lat}, ${lng}`;
      elements.restaurantAddressInput.value = restaurantAddress;
      localStorage.setItem(STORAGE_KEYS.restaurantAddress, restaurantAddress);
      saveSettingsWhenPossible();
      updateQrPreview();
      elements.useRestaurantLocationButton.disabled = false;
      showToast("Ubicacion actual guardada para domicilio.");
    },
    () => {
      elements.useRestaurantLocationButton.disabled = false;
      alert("No pude obtener la ubicacion. Permite ubicacion en el navegador o escribe la direccion manualmente.");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

function renderCurrencySettings() {
  if (elements.businessNameInput) elements.businessNameInput.value = businessName;
  if (elements.businessLogoUrlInput) elements.businessLogoUrlInput.value = businessLogoUrl;
  if (elements.legalBusinessNameInput) elements.legalBusinessNameInput.value = legalBusinessName;
  if (elements.taxIdInput) elements.taxIdInput.value = taxId;
  if (elements.businessPhoneInput) elements.businessPhoneInput.value = businessPhone;
  if (elements.businessEmailInput) elements.businessEmailInput.value = businessEmail;
  if (elements.legalAddressInput) elements.legalAddressInput.value = legalAddress;
  elements.currencySymbolInput.value = currencySymbol;
  elements.currencyPositionSelect.value = currencyPosition;
  elements.moneyFormatSelect.value = moneyFormat;
  elements.receiptWidthInput.value = receiptWidthMm;
  elements.deliveryFeeInput.value = deliveryFee;
  if (elements.deliveryMinimumFeeInput) elements.deliveryMinimumFeeInput.value = deliveryMinimumFee;
  elements.restaurantAddressInput.value = restaurantAddress;
  elements.googleMapsApiKeyInput.value = googleMapsApiKey;
  elements.bankAccountInput.value = bankAccount;
  elements.bankTransferNoteInput.value = bankTransferNote;
  if (elements.onlinePaymentProviderSelect) elements.onlinePaymentProviderSelect.value = onlinePaymentProvider;
  if (elements.onlinePaymentNoteInput) elements.onlinePaymentNoteInput.value = onlinePaymentNote;
  renderRestaurantStatus();
  applyBusinessNameToUi();
  applyReceiptPrintStyle();
}

function renderRestaurantStatus() {
  if (elements.restaurantStatusText) {
    elements.restaurantStatusText.textContent = restaurantActive
      ? "Restaurante activo para clientes."
      : "Restaurante cerrado: no aparece en la app del cliente.";
  }
  if (elements.closeRestaurantButton) {
    elements.closeRestaurantButton.textContent = restaurantActive ? "Cerrar restaurante" : "Reabrir restaurante";
  }
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

function orderItemsList(order = currentOrder) {
  return Array.isArray(order?.items) ? order.items : [];
}

function itemQuantity(item) {
  const quantity = Number.parseFloat(item?.qty ?? item?.quantity);
  return Number.isFinite(quantity) ? quantity : 0;
}

function itemPrice(item) {
  const price = Number.parseFloat(item?.price ?? item?.unit_price_snapshot);
  return Number.isFinite(price) ? price : 0;
}

function itemLineTotal(item) {
  return itemQuantity(item) * itemPrice(item);
}

function itemReportName(item) {
  return String(item?.name || item?.product_name_snapshot || "Producto sin nombre").trim() || "Producto sin nombre";
}

function itemReportKey(item) {
  return itemReportName(item)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function orderItemsCount(order = currentOrder) {
  return orderItemsList(order).reduce((count, item) => count + itemQuantity(item), 0);
}

function orderDeliveryFee(order = currentOrder) {
  const fee = Number.parseFloat(order?.delivery?.fee);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
}

function orderTotal(order = currentOrder) {
  return orderItemsList(order).reduce((total, item) => total + itemLineTotal(item), 0) + orderDeliveryFee(order);
}

function normalizeOrderType(type) {
  if (type === "Mesa") return "Comer en el punto";
  if (type === "Para llevar") return "Recoger en el punto";
  if (type === "Recoger en el punto" || type === "Domicilio" || type === "Comer en el punto") return type;
  return "Comer en el punto";
}

function orderTypeLabel(type) {
  const value = normalizeOrderType(type);
  if (value === "Recoger en el punto") return "Para llevar / recoger en el punto";
  if (value === "Domicilio") return "Envio a domicilio";
  return value;
}

function normalizePaymentMethod(method) {
  const value = String(method || "").trim();
  const allowed = ["Pago en caja", "Efectivo", "Transferencia", "Datafono"];
  return allowed.includes(value) ? value : "Pago en caja";
}

function paymentMethodLabel(method) {
  const value = normalizePaymentMethod(method);
  if (value === "Datafono") return "Datafono / tarjeta";
  return value;
}

function normalizeDeliveryInfo(delivery) {
  if (!delivery || typeof delivery !== "object") return null;
  const normalized = {
    name: String(delivery.name || "").trim(),
    phone: String(delivery.phone || "").trim(),
    address: String(delivery.address || "").trim(),
    neighborhood: String(delivery.neighborhood || "").trim(),
    reference: String(delivery.reference || "").trim(),
    distanceKm: normalizeMoneyValue(delivery.distanceKm),
    calculatedFee: normalizeMoneyValue(delivery.calculatedFee),
    extraFee: normalizeMoneyValue(delivery.extraFee),
    mapDistanceText: String(delivery.mapDistanceText || "").trim(),
    mapDurationText: String(delivery.mapDurationText || "").trim(),
    mapOrigin: String(delivery.mapOrigin || "").trim(),
    mapDestination: String(delivery.mapDestination || "").trim(),
    tariff: String(delivery.tariff || "").trim(),
    fee: normalizeMoneyValue(delivery.fee),
  };
  const hasDetails = Object.entries(normalized).some(([key, value]) => key === "fee" ? value > 0 : Boolean(value));
  return hasDetails ? normalized : null;
}

function formatDeliverySummary(delivery) {
  const info = normalizeDeliveryInfo(delivery);
  if (!info) return "";
  return [
    info.name ? `Nombre: ${info.name}` : "",
    info.phone ? `Telefono: ${info.phone}` : "",
    info.address ? `Direccion: ${info.address}` : "",
    info.neighborhood ? `Barrio/Ciudad: ${info.neighborhood}` : "",
    info.reference ? `Referencia: ${info.reference}` : "",
    info.distanceKm > 0 ? `Distancia: ${info.distanceKm} km` : "",
    info.mapDurationText ? `Tiempo Google Maps: ${info.mapDurationText}` : "",
    info.calculatedFee > 0 ? `Tarifa km: ${formatMoney(info.calculatedFee)}` : "",
    info.extraFee > 0 ? `Recargo: ${formatMoney(info.extraFee)}` : "",
    info.fee > 0 ? `Domicilio: ${formatMoney(info.fee)}` : "",
  ].filter(Boolean).join(" | ");
}

function normalizeNoteText(value) {
  return String(value || "").trim().toUpperCase();
}

function uppercaseNoteInput(value) {
  return String(value || "").toUpperCase();
}

function normalizeNoteDraft(value) {
  return uppercaseNoteInput(value);
}

function normalizeOrderNotes(order) {
  return {
    ...order,
    paymentMethod: normalizePaymentMethod(order?.paymentMethod),
    delivery: normalizeDeliveryInfo(order?.delivery),
    notes: normalizeNoteText(order?.notes),
    items: Array.isArray(order?.items)
      ? order.items.map((item) => ({
          ...item,
          note: normalizeNoteText(item.note),
        }))
      : [],
  };
}

function syncFormToOrder() {
  currentOrder.type = normalizeOrderType(elements.orderType.value);
  currentOrder.paymentMethod = normalizePaymentMethod(elements.paymentMethod.value);
  currentOrder.customer = elements.customerName.value.trim();
  currentOrder.server = elements.serverName.value.trim();
  currentOrder.notes = normalizeNoteDraft(elements.orderNotes.value);
  currentOrder.delivery = normalizeDeliveryInfo(currentOrder.delivery);
  currentOrder.items = currentOrder.items.map((item) => ({
    ...item,
    note: normalizeNoteDraft(item.note),
  }));
}

function renderCategories() {
  elements.categoryTabs.innerHTML = Object.keys(menuCatalog)
    .map(
      (category) => `
        <button
          type="button"
          role="tab"
          aria-selected="${!menuSearchQuery && category === activeCategory}"
          data-category="${escapeHtml(category)}"
        >${escapeHtml(category)}</button>
      `
    )
    .join("");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function menuSearchEntries(query) {
  const cleanQuery = normalizeSearchText(query);
  const entries = [];
  Object.entries(menuCatalog).forEach(([category, dishes]) => {
    (dishes || []).forEach((dish) => {
      const searchable = normalizeSearchText(`${category} ${dish.name} ${dish.description || ""}`);
      if (!cleanQuery || searchable.includes(cleanQuery)) entries.push({ category, dish });
    });
  });
  return entries;
}

function renderMenu() {
  const searchQuery = normalizeSearchText(menuSearchQuery);
  const entries = searchQuery
    ? menuSearchEntries(searchQuery)
    : (menuCatalog[activeCategory] || []).map((dish) => ({ category: activeCategory, dish }));

  if (!entries.length) {
    elements.menuGrid.innerHTML = `<div class="empty-menu-category">${
      searchQuery ? `No encontre productos con "${escapeHtml(menuSearchQuery)}".` : "No hay productos en esta categoria."
    }</div>`;
    return;
  }

  elements.menuGrid.innerHTML = entries
    .map(
      ({ category, dish }) => `
        <button
          class="dish-button ${dish.imageUrl ? "has-product-image" : ""} ${productIsAvailable(dish) ? "" : "is-unavailable"}"
          type="button"
          data-category="${escapeHtml(category)}"
          data-name="${escapeHtml(dish.name)}"
          data-price="${dish.price}"
          ${productIsAvailable(dish) ? "" : "disabled aria-disabled=\"true\""}
        >
          ${dish.imageUrl ? `<img src="${escapeHtml(dish.imageUrl)}" alt="${escapeHtml(dish.name)}" loading="lazy" />` : ""}
          <strong>${escapeHtml(dish.name)}</strong>
          ${searchQuery ? `<small>${escapeHtml(category)}</small>` : ""}
          <span>${formatMoney(dish.price)}</span>
          ${productIsAvailable(dish) ? "" : `<em>No disponible</em>`}
        </button>
      `
    )
    .join("");
}

function applyMenuSearch(value) {
  menuSearchQuery = String(value || "").trim();
  if (elements.menuSearchInput && elements.menuSearchInput.value !== menuSearchQuery) {
    elements.menuSearchInput.value = menuSearchQuery;
  }
  if (elements.menuSearchClearButton) elements.menuSearchClearButton.hidden = !menuSearchQuery;
  renderCategories();
  renderMenu();
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
        <article class="product-row ${productIsAvailable(product) ? "" : "is-unavailable"}" data-index="${index}">
          <div class="product-row-main">
            ${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />` : ""}
            <div>
              <strong>${escapeHtml(product.name)}</strong>
              ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
              <small>${productIsAvailable(product) ? "Disponible" : "No disponible"}</small>
            </div>
          </div>
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
  const resolvedCategory = menuCatalog[category] ? category : findCategoryByName(category);
  if (!resolvedCategory) return;
  activeCategory = resolvedCategory;
  editingProduct = null;
  clearProductForm();
  renderCategories();
  renderMenu();
  renderMenuEditor();
}

function clearProductForm() {
  elements.productNameInput.value = "";
  elements.productDescriptionInput.value = "";
  elements.productPriceInput.value = "";
  elements.productImageUrlInput.value = "";
  elements.productAvailableInput.checked = true;
  if (elements.productImageFileInput) elements.productImageFileInput.value = "";
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
  const category = cleanCategoryName(elements.categoryNameInput.value);
  if (!category) {
    alert("Escribe el nombre de la categoria.");
    return;
  }

  const existingCategory = findCategoryByName(category);
  const existed = Boolean(existingCategory);
  if (existingCategory) {
    activeCategory = existingCategory;
  } else {
    menuCatalog[category] = [];
    activeCategory = category;
  }

  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast(existed ? `Categoria "${activeCategory}" seleccionada.` : `Categoria "${category}" agregada.`);
}

function renameCategory() {
  const newName = cleanCategoryName(elements.categoryNameInput.value);
  if (!newName) {
    alert("Escribe el nuevo nombre de la categoria.");
    return;
  }

  const existingCategory = findCategoryByName(newName);
  if (existingCategory === activeCategory && newName === activeCategory) {
    showToast("No hubo cambios en la categoria.");
    return;
  }

  const previousName = activeCategory;
  if (existingCategory && existingCategory !== activeCategory) {
    const shouldMerge = confirm(`Ya existe una categoria parecida: "${existingCategory}". Unir los productos en esa categoria?`);
    if (!shouldMerge) return;

    menuCatalog[existingCategory] = [...(menuCatalog[existingCategory] || []), ...(menuCatalog[activeCategory] || [])];
    delete menuCatalog[activeCategory];
    activeCategory = existingCategory;
    saveMenuCatalog();
    clearProductForm();
    renderMenuEditor();
    showToast(`Categorias unidas en "${existingCategory}".`);
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
  showToast(`Categoria "${previousName}" cambiada a "${newName}".`);
}

function deleteCategory() {
  const originalCatalog = menuCatalog || {};
  const typedCategory = cleanCategoryName(elements.categoryNameInput.value);
  const targetCategory = findCategoryByName(typedCategory) || findCategoryByName(activeCategory);
  if (!targetCategory) {
    alert("Selecciona la categoria que quieres eliminar.");
    return;
  }
  activeCategory = targetCategory;

  const targetKey = categoryIdentityKey(targetCategory);
  const repeatedCategories = Object.keys(originalCatalog).filter((category) => categoryIdentityKey(category) === targetKey);
  if (repeatedCategories.length > 1) {
    const shouldCleanDuplicates = confirm(
      `Eliminar categorias repetidas de "${targetCategory}" y dejar una sola con sus productos?`
    );
    if (!shouldCleanDuplicates) return;

    const cleanedCatalog = {};
    Object.entries(originalCatalog).forEach(([category, products]) => {
      const cleanCategory = cleanCategoryName(category);
      if (!cleanCategory) return;
      const finalCategory = categoryIdentityKey(cleanCategory) === targetKey ? targetCategory : cleanCategory;
      if (!cleanedCatalog[finalCategory]) cleanedCatalog[finalCategory] = [];
      if (Array.isArray(products)) cleanedCatalog[finalCategory].push(...products);
    });

    menuCatalog = normalizeMenuCatalog(cleanedCatalog);
    activeCategory = findCategoryByName(targetCategory) || Object.keys(menuCatalog)[0];
    saveMenuCatalog();
    clearProductForm();
    renderMenuEditor();
    showToast(`Duplicadas de "${targetCategory}" eliminadas y guardadas.`);
    return;
  }

  menuCatalog = normalizeMenuCatalog(menuCatalog);
  const categories = Object.keys(menuCatalog);
  const activeKey = categoryIdentityKey(targetCategory);
  const categoriesToDelete = categories.filter((category) => categoryIdentityKey(category) === activeKey);

  if (categories.length - categoriesToDelete.length < 1) {
    alert("Debe quedar al menos una categoria.");
    return;
  }

  const deletedCategory = targetCategory;
  const deleteLabel =
    categoriesToDelete.length > 1 ? `${deletedCategory} (${categoriesToDelete.length} categorias repetidas)` : deletedCategory;
  const shouldDelete = confirm(`Eliminar la categoria "${deleteLabel}" y todos sus productos?`);
  if (!shouldDelete) return;

  categoriesToDelete.forEach((category) => delete menuCatalog[category]);
  activeCategory = Object.keys(menuCatalog)[0];
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast(
    categoriesToDelete.length > 1
      ? `Categorias repetidas de "${deletedCategory}" eliminadas.`
      : `Categoria "${deletedCategory}" eliminada.`
  );
}

function saveProduct() {
  const category = elements.productCategorySelect.value;
  const name = elements.productNameInput.value.trim();
  const description = normalizeProductDescription(elements.productDescriptionInput.value);
  const price = Number.parseFloat(elements.productPriceInput.value) || 0;
  const imageUrl = normalizeProductImageUrl(elements.productImageUrlInput.value);
  const available = elements.productAvailableInput.checked;

  if (!category || !menuCatalog[category]) {
    alert("Selecciona una categoria.");
    return;
  }

  if (!name) {
    alert("Escribe el nombre del producto.");
    return;
  }

  const previousProduct = editingProduct ? (menuCatalog[editingProduct.category] || [])[editingProduct.index] : null;
  const product = {
    id: normalizeProductId(previousProduct?.id || previousProduct?.productId) || createProductId(),
    name,
    description,
    price,
    available,
    imageUrl,
  };
  const wasEditing = Boolean(editingProduct);

  if (editingProduct) {
    const oldList = menuCatalog[editingProduct.category] || [];
    oldList.splice(editingProduct.index, 1);
  }

  menuCatalog[category].push(product);
  activeCategory = category;
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast("Producto guardado.");
}

function editProduct(index) {
  const product = (menuCatalog[activeCategory] || [])[index];
  if (!product) return;

  editingProduct = { category: activeCategory, index };
  elements.productCategorySelect.value = activeCategory;
  elements.productNameInput.value = product.name;
  elements.productDescriptionInput.value = product.description || "";
  elements.productPriceInput.value = product.price;
  elements.productImageUrlInput.value = product.imageUrl || "";
  elements.productAvailableInput.checked = productIsAvailable(product);
  if (elements.productImageFileInput) elements.productImageFileInput.value = "";
  elements.saveProductButton.textContent = "Guardar cambios";
  elements.cancelEditProductButton.hidden = false;
  elements.productNameInput.focus();
  showToast(`Editando "${product.name}". Cambia los datos y presiona Guardar cambios.`);
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
  showToast(`Producto "${product.name}" eliminado.`);
}

function resetMenu() {
  const shouldReset = confirm("Vaciar el menu? Esto elimina categorias y productos actuales. Usa esta opcion solo si vas a crear el menu desde cero.");
  if (!shouldReset) return;

  menuCatalog = normalizeMenuCatalog(EMPTY_MENU_CATALOG);
  activeCategory = Object.keys(menuCatalog)[0];
  saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast("Menu vaciado. Ahora puedes crear categorias y productos.");
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
  saveCurrentOrderDraft();
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
  elements.paymentMethod.value = normalizePaymentMethod(currentOrder.paymentMethod);
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
              <input type="number" min="1" step="1" value="${itemQuantity(item)}" data-action="qty" aria-label="Cantidad" />
              <button type="button" data-action="plus" aria-label="Sumar">+</button>
            </div>
            <div class="item-main">
              <div class="item-title">
                <strong>${escapeHtml(item.name)}</strong>
                <span class="item-subtotal">${formatMoney(itemLineTotal(item))}</span>
              </div>
              <div class="item-note-row">
                <input class="item-note" type="text" value="${escapeHtml(normalizeNoteText(item.note))}" data-action="note" placeholder="NOTA PARA ESTE PLATO" />
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
  elements.downloadTicketPdfButton.disabled = currentOrder.items.length === 0;
  elements.correctOrderButton.disabled = currentOrder.items.length === 0 && !currentOrder.saved;
  elements.cancelOrderButton.disabled = currentOrder.items.length === 0 && !currentOrder.saved;
  saveCurrentOrderDraft();
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
  if (elements.dailyCloseDialog.open) {
    renderDailyClose(elements.closeDayInput.value || todayKey);
  }
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
  applyReceiptPrintStyle();
  window.print();
}

function applyReceiptPrintStyle() {
  const width = normalizeReceiptWidth(receiptWidthMm);
  const contentWidth = Math.max(42, width - 4);
  let style = document.querySelector("#receiptPrintStyle");
  if (!style) {
    style = document.createElement("style");
    style.id = "receiptPrintStyle";
    document.head.appendChild(style);
  }

  style.textContent = `
    @media print {
      @page { margin: 0; size: ${width}mm auto; }
      .print-ticket {
        box-sizing: border-box !important;
        width: ${contentWidth}mm !important;
        padding: 2mm !important;
        break-after: auto !important;
        page-break-after: auto !important;
      }
      .print-ticket::after {
        content: "" !important;
        display: block !important;
        height: 4mm !important;
      }
    }
  `;
}

function renderPrintTicket(order) {
  const created = new Date(order.createdAt);
  const dateText = created.toLocaleDateString("es-US");
  const timeText = created.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });
  const place = order.customer || "Sin mesa/cliente";
  const server = order.server || "No indicado";
  const orderType = normalizeOrderType(order.type);
  const orderTypeText = orderTypeLabel(orderType);
  const paymentMethod = paymentMethodLabel(order.paymentMethod);
  const deliverySummary = formatDeliverySummary(order.delivery);

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <div class="receipt-number">COCINA ${formatTicket(order.ticketNumber)}</div>
    <div class="receipt-order-type">TIPO DE PEDIDO<br>${escapeHtml(orderTypeText).toUpperCase()}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>Tipo:</strong><span>${escapeHtml(orderTypeText)}</span></div>
    <div class="receipt-row"><strong>Pago:</strong><span>${escapeHtml(paymentMethod)}</span></div>
    <div class="receipt-row"><strong>Mesa/Cliente:</strong><span>${escapeHtml(place)}</span></div>
    <div class="receipt-row"><strong>Tomo pedido:</strong><span>${escapeHtml(server)}</span></div>
    <div class="receipt-row"><strong>Fecha:</strong><span>${escapeHtml(dateText)}</span></div>
    <div class="receipt-row"><strong>Hora:</strong><span>${escapeHtml(timeText)}</span></div>
    ${
      deliverySummary
        ? `<div class="receipt-divider"></div><p class="receipt-note-block"><strong>DOMICILIO:</strong> ${escapeHtml(deliverySummary)}</p>`
        : ""
    }
    <div class="receipt-divider"></div>
    <div class="receipt-items">
      ${orderItemsList(order)
        .map(
          (item) => `
            <div class="receipt-item">
              <strong>${itemQuantity(item)} x ${escapeHtml(itemReportName(item))}</strong>
              ${item.note ? `<div class="receipt-note">NOTA: ${escapeHtml(normalizeNoteText(item.note))}</div>` : ""}
            </div>
          `
        )
        .join("")}
    </div>
    ${
      order.notes
        ? `<div class="receipt-divider"></div><p class="receipt-note-block"><strong>NOTAS:</strong> ${escapeHtml(normalizeNoteText(order.notes))}</p>`
        : ""
    }
    <div class="receipt-divider"></div>
    <p class="receipt-total">FIN DEL TICKET</p>
  `;
}

function pdfSafeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapReceiptText(text, maxLength = 31) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word.length > maxLength ? word.slice(0, maxLength) : word;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildTicketPdfLines(order, maxLineLength) {
  const created = new Date(order.createdAt);
  const dateText = created.toLocaleDateString("es-US");
  const timeText = created.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });
  const orderType = normalizeOrderType(order.type);
  const orderTypeText = orderTypeLabel(orderType);
  const deliverySummary = formatDeliverySummary(order.delivery);
  const divider = "-".repeat(Math.min(31, Math.max(18, maxLineLength)));
  const lines = [
    pdfSafeText(businessName),
    `COCINA ${formatTicket(order.ticketNumber)}`,
    divider,
    "TIPO DE PEDIDO",
    orderTypeText.toUpperCase(),
    divider,
    `Cliente: ${order.customer || "Sin mesa/cliente"}`,
    `Pago: ${paymentMethodLabel(order.paymentMethod)}`,
    `Tomo pedido: ${order.server || "No indicado"}`,
    `Fecha: ${dateText}`,
    `Hora: ${timeText}`,
    divider,
  ];

  if (deliverySummary) {
    wrapReceiptText(`DOMICILIO: ${deliverySummary}`, maxLineLength).forEach((line) => lines.push(line));
    lines.push(divider);
  }

  orderItemsList(order).forEach((item) => {
    wrapReceiptText(`${itemQuantity(item)} x ${itemReportName(item)}`, maxLineLength).forEach((line) => lines.push(line));
    if (item.note) {
      wrapReceiptText(`NOTA: ${normalizeNoteText(item.note)}`, maxLineLength).forEach((line) => lines.push(line));
    }
  });

  if (order.notes) {
    lines.push(divider);
    wrapReceiptText(`NOTAS: ${normalizeNoteText(order.notes)}`, maxLineLength).forEach((line) => lines.push(line));
  }

  lines.push(divider, "FIN DEL TICKET");
  return lines;
}

function createReceiptPdfBlob(order) {
  const pageWidth = normalizeReceiptWidth(receiptWidthMm) * 72 / 25.4;
  const margin = 10;
  const lineHeight = 11;
  const fontSize = 9;
  const maxLineLength = Math.max(18, Math.floor((pageWidth - margin * 2) / 5.4));
  const lines = buildTicketPdfLines(order, maxLineLength);
  const pageHeight = Math.max(120, margin * 2 + lines.length * lineHeight + 12);
  const textCommands = [
    "BT",
    `/F1 ${fontSize} Tf`,
    `${margin} ${pageHeight - margin - fontSize} Td`,
    ...lines.flatMap((line) => [`(${pdfSafeText(line)}) Tj`, `0 -${lineHeight} Td`]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    `<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadCurrentTicketPdf() {
  if (!(await upsertCurrentOrder())) return;
  const blob = createReceiptPdfBlob(currentOrder);
  const ticketName = String(currentOrder.ticketNumber).padStart(4, "0");
  downloadBlob(blob, `rincon-colombiano-ticket-${ticketName}.pdf`);
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
      const itemCount = orderItemsCount(order);
      return `
        <article class="history-item">
          <div class="history-title">
            <strong>${formatTicket(order.ticketNumber)}</strong>
            <span>${formatMoney(orderTotal(order))}</span>
          </div>
          <div class="history-meta">
            <span>${escapeHtml(orderTypeLabel(order.type))}</span>
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

function renderDailyClose(day = todayKey) {
  const report = buildDailyClose(day);
  elements.closeDayInput.value = day;
  elements.printDailyCloseButton.disabled = report.tickets === 0;

  if (!report.tickets) {
    elements.dailyCloseContent.innerHTML = `
      <div class="monthly-empty">No hay pedidos guardados para ${escapeHtml(report.label)}.</div>
    `;
    return report;
  }

  const ticketRange =
    report.firstTicket && report.lastTicket
      ? `${formatTicket(report.firstTicket)} - ${formatTicket(report.lastTicket)}`
      : "Sin rango";

  elements.dailyCloseContent.innerHTML = `
    <div class="monthly-summary-grid">
      <div class="monthly-metric">
        <span>Total caja</span>
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

    <h3 class="monthly-section-title">Resumen del dia</h3>
    <div class="monthly-table">
      <div class="monthly-table-row">
        <strong>Dia</strong>
        <span>${escapeHtml(report.label)}</span>
        <strong>Rango tickets</strong>
        <span>${escapeHtml(ticketRange)}</span>
      </div>
    </div>

    <h3 class="monthly-section-title">Ventas por tipo de pedido</h3>
    <div class="monthly-table">
      <div class="monthly-table-row header">
        <span>Tipo</span>
        <span>Tickets</span>
        <span></span>
        <span>Total</span>
      </div>
      ${report.orderTypes
        .map(
          (type) => `
            <div class="monthly-table-row">
              <strong>${escapeHtml(type.label)}</strong>
              <span>${type.tickets}</span>
              <span></span>
              <strong>${formatMoney(type.total)}</strong>
            </div>
          `
        )
        .join("")}
    </div>

    <h3 class="monthly-section-title">Ventas por metodo de pago</h3>
    <div class="monthly-table">
      <div class="monthly-table-row header">
        <span>Metodo</span>
        <span>Tickets</span>
        <span></span>
        <span>Total</span>
      </div>
      ${report.paymentMethods
        .map(
          (method) => `
            <div class="monthly-table-row">
              <strong>${escapeHtml(method.label)}</strong>
              <span>${method.tickets}</span>
              <span></span>
              <strong>${formatMoney(method.total)}</strong>
            </div>
          `
        )
        .join("")}
    </div>

    <h3 class="monthly-section-title">Quien tomo pedidos</h3>
    <div class="monthly-table">
      <div class="monthly-table-row header">
        <span>Nombre</span>
        <span>Tickets</span>
        <span></span>
        <span>Total</span>
      </div>
      ${report.servers
        .map(
          (server) => `
            <div class="monthly-table-row">
              <strong>${escapeHtml(server.name)}</strong>
              <span>${server.tickets}</span>
              <span></span>
              <strong>${formatMoney(server.total)}</strong>
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

function renderPrintDailyClose(report) {
  const printedAt = new Date();
  const dateText = printedAt.toLocaleDateString("es-US");
  const timeText = printedAt.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });
  const ticketRange =
    report.firstTicket && report.lastTicket
      ? `${formatTicket(report.firstTicket)} - ${formatTicket(report.lastTicket)}`
      : "Sin rango";

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <div class="receipt-number">CIERRE DIA</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>Dia:</strong><span>${escapeHtml(report.label)}</span></div>
    <div class="receipt-row"><strong>Impreso:</strong><span>${escapeHtml(dateText)}</span></div>
    <div class="receipt-row"><strong>Hora:</strong><span>${escapeHtml(timeText)}</span></div>
    <div class="receipt-row"><strong>Tickets:</strong><span>${escapeHtml(ticketRange)}</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>Total caja:</strong><span>${formatMoney(report.total)}</span></div>
    <div class="receipt-row"><strong>Cant tickets:</strong><span>${report.tickets}</span></div>
    <div class="receipt-row"><strong>Productos:</strong><span>${report.items}</span></div>
    <div class="receipt-row"><strong>Promedio:</strong><span>${formatMoney(report.average)}</span></div>
    <div class="receipt-divider"></div>
    <p><strong>TIPO DE PEDIDO</strong></p>
    <div class="receipt-items">
      ${report.orderTypes
        .map(
          (type) => `
            <div class="receipt-item">
              <strong>${escapeHtml(type.label)}: ${formatMoney(type.total)}</strong>
              <div>${type.tickets} tickets</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p><strong>METODOS DE PAGO</strong></p>
    <div class="receipt-items">
      ${report.paymentMethods
        .map(
          (method) => `
            <div class="receipt-item">
              <strong>${escapeHtml(method.label)}: ${formatMoney(method.total)}</strong>
              <div>${method.tickets} tickets</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p><strong>TOMARON PEDIDOS</strong></p>
    <div class="receipt-items">
      ${report.servers
        .map(
          (server) => `
            <div class="receipt-item">
              <strong>${escapeHtml(server.name)}: ${formatMoney(server.total)}</strong>
              <div>${server.tickets} tickets</div>
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
    <p class="receipt-total">FIN DEL CIERRE DIA</p>
  `;
}

function printDailyClose() {
  const report = renderDailyClose(elements.closeDayInput.value || todayKey);
  if (!report.tickets) {
    alert("No hay pedidos guardados para imprimir en ese dia.");
    return;
  }

  renderPrintDailyClose(report);
  applyReceiptPrintStyle();
  window.print();
}

function renderPrintMonthlyClose(report) {
  const printedAt = new Date();
  const dateText = printedAt.toLocaleDateString("es-US");
  const timeText = printedAt.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit" });

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
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
  applyReceiptPrintStyle();
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

function beginCorrectCurrentOrder() {
  if (!currentOrder.items.length && !currentOrder.saved) {
    alert("No hay pedido para corregir. Abre un ticket guardado o agrega productos primero.");
    return;
  }

  if (currentOrder.saved) {
    showToast(`Corrigiendo ${formatTicket(currentOrder.ticketNumber)}. Cambia lo necesario y presiona Guardar pedido.`);
  } else {
    showToast("Corrige el pedido nuevo y presiona Guardar pedido.");
  }

  elements.orderNotes.focus();
}

async function cancelCurrentOrder() {
  syncFormToOrder();

  if (!currentOrder.items.length && !currentOrder.saved) {
    alert("No hay pedido para cancelar.");
    return;
  }

  const ticketLabel = currentOrder.ticketNumber ? formatTicket(currentOrder.ticketNumber) : "sin guardar";
  const shouldCancel = confirm(
    `Cancelar/eliminar el pedido ${ticketLabel}? Esto lo quitara del historial y de los cierres.`
  );
  if (!shouldCancel) return;

  const cancelledOrderId = currentOrder.id;
  const wasSaved = Boolean(currentOrder.saved && cancelledOrderId);

  if (wasSaved) {
    savedOrders = savedOrders.filter((order) => order.id !== cancelledOrderId);
    saveOrders();

    if (cloudState.user && navigator.onLine) {
      try {
        await deleteCloudOrder(cancelledOrderId);
        clearDeletedOrderId(cancelledOrderId);
      } catch (error) {
        console.error(error);
        queueDeletedOrderId(cancelledOrderId);
      }
    } else if (shouldQueueForCloud()) {
      queueDeletedOrderId(cancelledOrderId);
    }
  }

  currentOrder = createBlankOrder();
  saveOrders();
  renderOrder();
  renderHistory();
  if (elements.dailyCloseDialog.open) {
    renderDailyClose(elements.closeDayInput.value || todayKey);
  }
  if (elements.monthlyCloseDialog.open) {
    renderMonthlyClose(elements.closeMonthInput.value || currentMonthKey());
  }
  updateCloudStatus();
  showToast(wasSaved ? `Pedido ${ticketLabel} cancelado/eliminado.` : "Pedido nuevo cancelado.");
}

function openItemNote(itemId) {
  const item = currentOrder.items.find((entry) => entry.id === itemId);
  if (!item) return;

  editingNoteItemId = item.id;
  elements.itemNoteTitle.textContent = item.name;
  elements.itemNoteTextarea.value = normalizeNoteText(item.note);
  elements.itemNoteDialog.showModal();
  elements.itemNoteTextarea.focus();
}

function saveItemNote() {
  const item = currentOrder.items.find((entry) => entry.id === editingNoteItemId);
  if (!item) return;

  item.note = normalizeNoteText(elements.itemNoteTextarea.value);
  elements.itemNoteTextarea.value = item.note;
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
  const resolvedCategory = menuCatalog[button.dataset.category] ? button.dataset.category : findCategoryByName(button.dataset.category);
  if (!resolvedCategory) return;
  activeCategory = resolvedCategory;
  applyMenuSearch("");
  renderCategories();
  renderMenu();
});

if (elements.menuSearchInput) {
  elements.menuSearchInput.addEventListener("input", () => {
    applyMenuSearch(elements.menuSearchInput.value);
  });
}

if (elements.menuSearchClearButton) {
  elements.menuSearchClearButton.addEventListener("click", () => {
    applyMenuSearch("");
    if (elements.menuSearchInput) elements.menuSearchInput.focus();
  });
}

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
    if (subtotal) subtotal.textContent = formatMoney(itemLineTotal(item));
  }

  if (action === "note") {
    item.note = normalizeNoteDraft(event.target.value);
    event.target.value = uppercaseNoteInput(event.target.value);
  }

  markOrderChanged();
  elements.orderTotal.textContent = formatMoney(orderTotal());
});

[elements.orderType, elements.paymentMethod, elements.customerName, elements.serverName, elements.orderNotes].forEach((input) => {
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
elements.openRestaurantSignInButton?.addEventListener("click", () => openRestaurantAuthDialog("login"));
elements.openRestaurantSignupButton?.addEventListener("click", () => openRestaurantAuthDialog("register"));
elements.restaurantAuthCloseButton?.addEventListener("click", closeRestaurantAuthDialog);
elements.restaurantAuthDialog?.addEventListener("cancel", () => hidePasswordRecoveryForm());
elements.resetPasswordButton.addEventListener("click", sendPasswordResetEmail);
elements.resendVerificationButton?.addEventListener("click", resendVerificationEmail);
elements.updatePasswordButton.addEventListener("click", updateRecoveredPassword);
elements.cancelRecoveryButton.addEventListener("click", () => hidePasswordRecoveryForm());
if (elements.refreshAppButton) {
  elements.refreshAppButton.addEventListener("click", refreshRestaurantApp);
}
elements.openSignInButton.addEventListener("click", openSignInScreen);
elements.signOutButton.addEventListener("click", signOut);
elements.closeRestaurantButton?.addEventListener("click", toggleRestaurantActive);
elements.requestRestaurantDeletionButton?.addEventListener("click", requestRestaurantDeletion);
elements.qrButton.addEventListener("click", openQrDialog);
elements.clientAlarmButton.addEventListener("click", toggleClientAlarm);
elements.qrTableInput.addEventListener("input", updateQrPreview);
elements.copyQrLinkButton.addEventListener("click", copyQrLink);
elements.openClientPageButton.addEventListener("click", openClientPage);
elements.clientOrdersButton.addEventListener("click", openClientOrdersDialog);
elements.refreshClientOrdersButton.addEventListener("click", () => refreshClientOrders());
elements.clientOrdersList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest(".client-order-card");
  if (!button || !card) return;
  if (button.dataset.action === "accept-client-order") acceptClientOrder(card.dataset.clientOrderId);
  if (button.dataset.action === "cancel-client-order") cancelClientOrder(card.dataset.clientOrderId);
  if (button.dataset.action === "sent-client-order") markClientOrderSent(card.dataset.clientOrderId);
  if (button.dataset.action === "delivered-client-order") markClientOrderDelivered(card.dataset.clientOrderId);
  if (button.dataset.action === "send-client-message") sendRestaurantChatMessage(card.dataset.clientOrderId, card);
});

elements.saveOrderButton.addEventListener("click", async () => {
  if (await upsertCurrentOrder()) {
    const syncMessage = needsCloudSync(currentOrder) ? " Guardado localmente; se subira cuando vuelva internet." : "";
    alert(`Pedido ${formatTicket(currentOrder.ticketNumber)} guardado.${syncMessage}`);
  }
});

elements.printOrderButton.addEventListener("click", printCurrentOrder);
elements.downloadTicketPdfButton.addEventListener("click", downloadCurrentTicketPdf);
elements.correctOrderButton.addEventListener("click", beginCorrectCurrentOrder);
elements.cancelOrderButton.addEventListener("click", cancelCurrentOrder);
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
elements.shiftButton.addEventListener("click", () => openShiftDialog());
elements.saveShiftButton.addEventListener("click", saveShiftFromDialog);
elements.shiftServerInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  saveShiftFromDialog();
});
elements.customerButton.addEventListener("click", openCustomerDialog);
elements.saveCustomerButton.addEventListener("click", saveCustomerFromDialog);

elements.dailyCloseButton.addEventListener("click", () => {
  renderDailyClose(todayKey);
  elements.dailyCloseDialog.showModal();
});

elements.closeDayInput.addEventListener("change", () => {
  renderDailyClose(elements.closeDayInput.value || todayKey);
});

elements.printDailyCloseButton.addEventListener("click", printDailyClose);

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
elements.saveCustomerSettingsButton.addEventListener("click", saveCurrencySymbol);
if (elements.useRestaurantLocationButton) {
  elements.useRestaurantLocationButton.addEventListener("click", useRestaurantCurrentLocation);
}

if (elements.businessLogoFileInput) {
  elements.businessLogoFileInput.addEventListener("change", async () => {
    const file = elements.businessLogoFileInput.files?.[0];
    if (!file) return;

    try {
      businessLogoUrl = await restaurantImageFileToDataUrl(file);
      elements.businessLogoUrlInput.value = businessLogoUrl;
      localStorage.setItem(STORAGE_KEYS.businessLogoUrl, businessLogoUrl);
      applyBusinessNameToUi();
      showToast("Logo optimizado. Presiona guardar ajustes para subirlo.");
    } catch (error) {
      alert(error.message || "No se pudo cargar el logo.");
      elements.businessLogoFileInput.value = "";
    }
  });
}

elements.productImageFileInput.addEventListener("change", async () => {
  const file = elements.productImageFileInput.files?.[0];
  if (!file) return;

  try {
    elements.productImageUrlInput.value = await restaurantImageFileToDataUrl(file);
    showToast("Foto optimizada. Presiona guardar para aplicar.");
  } catch (error) {
    alert(error.message || "No se pudo cargar la foto.");
    elements.productImageFileInput.value = "";
  }
});

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

window.addEventListener("beforeunload", () => {
  syncFormToOrder();
  saveCurrentOrderDraft();
});

let pullToRefreshStartY = 0;
window.addEventListener(
  "touchstart",
  (event) => {
    pullToRefreshStartY = event.touches?.[0]?.clientY || 0;
  },
  { passive: true }
);
window.addEventListener(
  "touchmove",
  (event) => {
    const currentY = event.touches?.[0]?.clientY || 0;
    if (window.scrollY <= 0 && currentY > pullToRefreshStartY + 8) {
      event.preventDefault();
    }
  },
  { passive: false }
);

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

applyBusinessNameToUi();
applyReceiptPrintStyle();
renderCategories();
renderMenu();
renderOrder();
renderHistory();
initializeCloud().catch((error) => {
  console.error(error);
  updateCloudStatus(navigator.onLine ? "Error nube" : "");
  elements.authMessage.textContent = error.message || "No se pudo iniciar Supabase.";
});
