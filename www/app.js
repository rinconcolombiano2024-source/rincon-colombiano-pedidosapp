function createLocalOrderUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

const STORAGE_KEYS = {
  nextTicket: "rc_ordera_next_ticket",
  ticketDate: "rc_ordera_ticket_date",
  ticketCounterPending: "rc_ordera_ticket_counter_pending",
  orders: "rc_ordera_orders",
  menu: "rc_ordera_menu",
  appLanguage: "rc_ordera_app_language",
  currencySymbol: "rc_ordera_currency_symbol",
  currencyPosition: "rc_ordera_currency_position",
  moneyFormat: "rc_ordera_money_format",
  receiptWidthMm: "rc_ordera_receipt_width_mm",
  shiftServerName: "rc_ordera_shift_server_name",
  settingsPending: "rc_ordera_settings_pending",
  menuPending: "rc_ordera_menu_pending",
  menuRevision: "rc_ordera_menu_revision",
  confirmedMenu: "rc_ordera_confirmed_menu",
confirmedSettings: "rc_ordera_confirmed_settings",
settingsRevision: "rc_ordera_settings_revision",
  cloudSession: "rc_ordera_cloud_session",
  deletedOrders: "rc_ordera_deleted_orders",
  deliveryFee: "rc_ordera_delivery_fee",
  restaurantAddress: "rc_ordera_restaurant_address",
  googleMapsApiKey: "rc_ordera_google_maps_api_key",
  bankAccount: "rc_ordera_bank_account",
  bankTransferNote: "rc_ordera_bank_transfer_note",
  onlinePaymentProvider: "rc_ordera_online_payment_provider",
  onlinePaymentNote: "rc_ordera_online_payment_note",
  clientAlarmEnabled: "rc_ordera_client_alarm_enabled",
  businessName: "rc_ordera_business_name",
  businessLogoUrl: "rc_ordera_business_logo_url",
  restaurantActive: "rc_ordera_restaurant_active",
  legalBusinessName: "rc_ordera_legal_business_name",
  taxId: "rc_ordera_tax_id",
  businessPhone: "rc_ordera_business_phone",
  businessEmail: "rc_ordera_business_email",
  legalAddress: "rc_ordera_legal_address",
  deliveryMinimumFee: "rc_ordera_delivery_minimum_fee",
  currentOrderDraft: "rc_ordera_current_order_draft",
  revisionConflictBackups: "rc_ordera_revision_conflict_backups",
  restaurantOperationalOpen: "rc_ordera_restaurant_operational_open",
  restaurantOperationalMode: "rc_ordera_restaurant_operational_mode",
  restaurantOpeningHours: "rc_ordera_restaurant_opening_hours",
  restaurantLatitude: "rc_ordera_restaurant_latitude",
  restaurantLongitude: "rc_ordera_restaurant_longitude",
};

const LOCAL_ORDER_CACHE_LIMIT = 250;
const CLIENT_ORDERS_POLL_MIN_MS = 120_000;
const CLIENT_ORDERS_POLL_MAX_MS = 300_000;
const CLIENT_ORDERS_REALTIME_RECONNECT_MIN_MS = 1_500;
const CLIENT_ORDERS_REALTIME_RECONNECT_MAX_MS = 60_000;
const CLIENT_ORDERS_REALTIME_STABLE_MS = 30_000;
const CENTRAL_REALTIME_RECONNECT_MIN_MS = 1_500;
const CENTRAL_REALTIME_RECONNECT_MAX_MS = 60_000;
const CENTRAL_REALTIME_STABLE_MS = 30_000;
const CENTRAL_REALTIME_ENABLED = false;
const CLOUD_RECOVERY_DEDUP_MS = 30_000;
const SYNC_INFRASTRUCTURE_BACKOFF_MS = 5 * 60_000;
const SYNC_ORDER_BATCH_SIZE = 5;
const SYNC_ORDER_BATCH_DELAY_MS = 15_000;
const MINIMUM_DATABASE_SCHEMA_VERSION = 91;
const MINIMUM_SYNC_CONTRACT_VERSION = 7;
const MINIMUM_RELEASE_CONTRACT_VERSION = 25;

const LEGACY_STORAGE_KEYS = {
  nextTicket: "rincon_colombiano_next_ticket",
  ticketDate: "rincon_colombiano_ticket_date",
  orders: "rincon_colombiano_orders",
  menu: "rincon_colombiano_menu",
  appLanguage: "rincon_colombiano_app_language",
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
function migrateLegacyRestaurantStorage() {
  try {
    Object.entries(LEGACY_STORAGE_KEYS).forEach(([name, legacyKey]) => {
      const nextKey = STORAGE_KEYS[name];

      if (!nextKey || nextKey === legacyKey) {
        return;
      }

      const legacyValue =
        localStorage.getItem(legacyKey);

      if (legacyValue === null) {
        return;
      }

      const currentValue =
        localStorage.getItem(nextKey);

      /*
       * Caso 1:
       * No existe todavía el dato nuevo.
       * Copiamos y verificamos antes de borrar.
       */
      if (currentValue === null) {
        localStorage.setItem(
          nextKey,
          legacyValue
        );

        if (
          localStorage.getItem(nextKey) ===
          legacyValue
        ) {
          localStorage.removeItem(
            legacyKey
          );
        } else {
          console.warn(
            `No se pudo verificar la migracion de ${nextKey}. El dato legacy se conserva.`
          );
        }

        return;
      }

      /*
       * Caso 2:
       * Ambos valores ya son iguales.
       * La clave antigua es redundante.
       */
      if (currentValue === legacyValue) {
        localStorage.removeItem(
          legacyKey
        );

        return;
      }

      /*
       * Caso 3:
       * Existen valores diferentes.
       * No sobreescribimos ni eliminamos nada.
       */
      console.warn(
        `Conflicto de almacenamiento en ${nextKey}. Se conservan ambos valores.`
      );
    });
  } catch (error) {
    console.error(
      "No fue posible completar la migracion segura del almacenamiento local:",
      error
    );
  }
}
migrateLegacyRestaurantStorage();

const DEFAULT_BUSINESS_NAME = "MI RESTAURANTE";
const DEFAULT_DELIVERY_MINIMUM_FEE = 20;
const APP_VERSION = "v91.0.4";
const PLATFORM_SCOPE_ID = "00000000-0000-0000-0000-000000000000";
const PLATFORM_APP_NAME = "RC ORDERA";
const RESTAURANT_MEDIA_BUCKET = "restaurant-media";
function appUiLanguage() {
  const language = String(document.documentElement.lang || localStorage.getItem(STORAGE_KEYS.appLanguage) || "es").toLowerCase();
  return ["es", "pl", "en"].includes(language) ? language : "es";
}

function appUiLocale() {
  return { es: "es-ES", pl: "pl-PL", en: "en-GB" }[appUiLanguage()];
}

function appUiText(source) {
  return window.RCOrderaAutoTranslate?.translate?.(source) || window.rcUiText?.(source) || String(source || "");
}
const RESTAURANT_WEEK_DAYS = [
  ["monday", "Lunes"],
  ["tuesday", "Martes"],
  ["wednesday", "Miercoles"],
  ["thursday", "Jueves"],
  ["friday", "Viernes"],
  ["saturday", "Sabado"],
  ["sunday", "Domingo"],
];
const RESTAURANT_REGIONS = {
  PL: [
    "Dolnośląskie", "Kujawsko-Pomorskie", "Lubelskie", "Lubuskie", "Łódzkie", "Małopolskie",
    "Mazowieckie", "Opolskie", "Podkarpackie", "Podlaskie", "Pomorskie", "Śląskie",
    "Świętokrzyskie", "Warmińsko-Mazurskie", "Wielkopolskie", "Zachodniopomorskie",
  ],
  CO: [
    "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas", "Caquetá",
    "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare",
    "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo",
    "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima",
    "Valle del Cauca", "Vaupés", "Vichada", "Bogotá D.C.",
  ],
};

function renderRestaurantRegionSuggestions(countryCode) {
  const datalist =
    document.querySelector(
      "#restaurantRegionOptions"
    );

  if (!datalist) return;

  datalist.textContent = "";

  const regions =
    RESTAURANT_REGIONS[countryCode] || [];

  const fragment =
    document.createDocumentFragment();

  regions.forEach((region) => {
    const option =
      document.createElement("option");

    option.value = region;

    fragment.appendChild(option);
  });

  datalist.appendChild(fragment);
}

function normalizedRestaurantRegion(countryCode, value) {
  const cleanValue =
    normalizeTextSetting(value);

  if (!cleanValue) {
    return "";
  }

  const comparable = (text) =>
    String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(
        /\b(wojewodztwo|voivodeship|departamento|department)\b/g,
        ""
      )
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const cleanComparable =
    comparable(cleanValue);

  /*
   * Si después de normalizar no queda
   * contenido significativo, conservamos
   * lo que escribió el usuario.
   */
  if (!cleanComparable) {
    return cleanValue;
  }

  const match =
    (
      RESTAURANT_REGIONS[countryCode] ||
      []
    ).find(
      (region) =>
        comparable(region) ===
        cleanComparable
    );

  return match || cleanValue;
}

function detectRegionalDefaults(coords = null) {
  const latitude = Number(coords?.latitude ?? coords?.lat);
  const longitude = Number(coords?.longitude ?? coords?.lng);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const browserLanguage = String(navigator.language || "es").toLowerCase();
  let countryCode = "";

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (latitude >= 49 && latitude <= 55.2 && longitude >= 14 && longitude <= 24.3) countryCode = "PL";
    if (latitude >= -5 && latitude <= 14.5 && longitude >= -82 && longitude <= -66) countryCode = "CO";
  }
  if (!countryCode && timezone === "Europe/Warsaw") countryCode = "PL";
  if (!countryCode && timezone === "America/Bogota") countryCode = "CO";
  if (!countryCode && /^pl(?:-|$)/.test(browserLanguage)) countryCode = "PL";
  if (!countryCode && /^es-co(?:-|$)/.test(browserLanguage)) countryCode = "CO";

  const preferredLanguage = browserLanguage.startsWith("pl")
    ? "pl"
    : browserLanguage.startsWith("en")
      ? "en"
      : "es";
  return {
    countryCode,
    country: countryCode === "PL" ? "Polonia" : countryCode === "CO" ? "Colombia" : "",
    city: "",
    region: "",
    postalCode: "",
    timezone,
    preferredLanguage,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

function registrationPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation || (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname))) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

let restaurantRegistrationRegion = detectRegionalDefaults();

const EMPTY_MENU_CATALOG = {};

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
  authCountryCodeInput: document.querySelector("#authCountryCodeInput"),
  authCityInput: document.querySelector("#authCityInput"),
  authRegionInput: document.querySelector("#authRegionInput"),
  authPostalCodeInput: document.querySelector("#authPostalCodeInput"),
  restaurantRegionOptions: document.querySelector("#restaurantRegionOptions"),
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
  restaurantServiceBar: document.querySelector(".restaurant-service-bar"),
  mainRestaurantStatusIndicator: document.querySelector("#mainRestaurantStatusIndicator"),
  mainRestaurantStatusText: document.querySelector("#mainRestaurantStatusText"),
  mainRestaurantStatusDetail: document.querySelector("#mainRestaurantStatusDetail"),
  mainRestaurantToggleButton: document.querySelector("#mainRestaurantToggleButton"),
  restaurantScheduleModeInput: document.querySelector("#restaurantScheduleModeInput"),
  restaurantDashboardDate: document.querySelector("#restaurantDashboardDate"),
  restaurantMetricReceived: document.querySelector("#restaurantMetricReceived"),
  restaurantMetricPending: document.querySelector("#restaurantMetricPending"),
  restaurantMetricPreparing: document.querySelector("#restaurantMetricPreparing"),
  restaurantMetricReady: document.querySelector("#restaurantMetricReady"),
  restaurantMetricSales: document.querySelector("#restaurantMetricSales"),
  restaurantDashboardSummary: document.querySelector(".restaurant-dashboard-summary"),
  appBusinessName: document.querySelector("#appBusinessName"),
  appLogoImage: document.querySelector("#appLogoImage"),
  refreshAppButton: document.querySelector("#refreshAppButton"),
  openSignInButton: document.querySelector("#openSignInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  qrButton: document.querySelector("#qrButton"),
  waiterTeamButton: document.querySelector("#waiterTeamButton"),
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
  ticketHistoryButton: document.querySelector("#ticketHistoryButton"),
  ticketHistoryDialog: document.querySelector("#ticketHistoryDialog"),
  ticketHistorySearchInput: document.querySelector("#ticketHistorySearchInput"),
  ticketHistoryDateInput: document.querySelector("#ticketHistoryDateInput"),
  ticketHistoryPaymentFilter: document.querySelector("#ticketHistoryPaymentFilter"),
  ticketHistoryList: document.querySelector("#ticketHistoryList"),
  refreshTicketHistoryButton: document.querySelector("#refreshTicketHistoryButton"),
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
  annualCloseButton: document.querySelector("#annualCloseButton"),
  annualCloseDialog: document.querySelector("#annualCloseDialog"),
  closeYearInput: document.querySelector("#closeYearInput"),
  annualCloseContent: document.querySelector("#annualCloseContent"),
  printAnnualCloseButton: document.querySelector("#printAnnualCloseButton"),
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
  waiterTeamDialog: document.querySelector("#waiterTeamDialog"),
  waiterLinkInput: document.querySelector("#waiterLinkInput"),
  copyWaiterLinkButton: document.querySelector("#copyWaiterLinkButton"),
  openWaiterLinkButton: document.querySelector("#openWaiterLinkButton"),
  waiterMemberEmailInput: document.querySelector("#waiterMemberEmailInput"),
  waiterMemberNameInput: document.querySelector("#waiterMemberNameInput"),
  waiterStationSelect: document.querySelector("#waiterStationSelect"),
  authorizeWaiterButton: document.querySelector("#authorizeWaiterButton"),
  waiterTeamMessage: document.querySelector("#waiterTeamMessage"),
  waiterMembersList: document.querySelector("#waiterMembersList"),
  employeeHoursList: document.querySelector("#employeeHoursList"),
  refreshWaiterMembersButton: document.querySelector("#refreshWaiterMembersButton"),
  installAppButton: document.querySelector("#installAppButton"),
  installHelpDialog: document.querySelector("#installHelpDialog"),
  editMenuButton: document.querySelector("#editMenuButton"),
  menuEditorDialog: document.querySelector("#menuEditorDialog"),
  restaurantInfoTabButton: document.querySelector("#restaurantInfoTabButton"),
restaurantHoursTabButton: document.querySelector("#restaurantHoursTabButton"),
restaurantMenuTabButton: document.querySelector("#restaurantMenuTabButton"),

restaurantInfoSection: document.querySelector("#restaurantInfoSection"),
restaurantHoursSection: document.querySelector("#restaurantHoursSection"),
restaurantMenuSection: document.querySelector("#restaurantMenuSection"),
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

productNamePlInput: document.querySelector("#productNamePlInput"),
productDescriptionPlInput: document.querySelector("#productDescriptionPlInput"),

  productNameEnInput: document.querySelector("#productNameEnInput"),
productDescriptionEnInput: document.querySelector("#productDescriptionEnInput"),
  productPriceInput: document.querySelector("#productPriceInput"),
  productStationSelect: document.querySelector("#productStationSelect"),
  productImageUrlInput: document.querySelector("#productImageUrlInput"),
  productImageFileInput: document.querySelector("#productImageFileInput"),
  productAvailableInput: document.querySelector("#productAvailableInput"),
  saveProductButton: document.querySelector("#saveProductButton"),
  cancelEditProductButton: document.querySelector("#cancelEditProductButton"),
  productList: document.querySelector("#productList"),
  resetMenuButton: document.querySelector("#resetMenuButton"),
  menuClearSecurityDialog: document.querySelector("#menuClearSecurityDialog"),
menuClearConfirmationInput: document.querySelector("#menuClearConfirmationInput"),
menuClearPasswordInput: document.querySelector("#menuClearPasswordInput"),
menuClearSecurityMessage: document.querySelector("#menuClearSecurityMessage"),
cancelMenuClearButton: document.querySelector("#cancelMenuClearButton"),
confirmMenuClearButton: document.querySelector("#confirmMenuClearButton"),
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
  connectThermalPrinterButton: document.querySelector("#connectThermalPrinterButton"),
  thermalPrinterStatus: document.querySelector("#thermalPrinterStatus"),
  saveCurrencyButton: document.querySelector("#saveCurrencyButton"),
  deliveryFeeInput: document.querySelector("#deliveryFeeInput"),
  deliveryMinimumFeeInput: document.querySelector("#deliveryMinimumFeeInput"),
  restaurantAddressInput: document.querySelector("#restaurantAddressInput"),
  restaurantCountryCodeInput: document.querySelector("#restaurantCountryCodeInput"),
  restaurantCityInput: document.querySelector("#restaurantCityInput"),
  restaurantRegionInput: document.querySelector("#restaurantRegionInput"),
  restaurantPostalCodeInput: document.querySelector("#restaurantPostalCodeInput"),
  useRestaurantLocationButton: document.querySelector("#useRestaurantLocationButton"),
  restaurantLocationStatus: document.querySelector("#restaurantLocationStatus"),
  googleMapsApiKeyInput: document.querySelector("#googleMapsApiKeyInput"),
  bankAccountInput: document.querySelector("#bankAccountInput"),
  bankTransferNoteInput: document.querySelector("#bankTransferNoteInput"),
  onlinePaymentProviderSelect: document.querySelector("#onlinePaymentProviderSelect"),
  onlinePaymentNoteInput: document.querySelector("#onlinePaymentNoteInput"),
  marketplaceAccountStatus: document.querySelector("#marketplaceAccountStatus"),
  marketplaceAccountButton: document.querySelector("#marketplaceAccountButton"),
  restaurantStatusText: document.querySelector("#restaurantStatusText"),
  restaurantHoursGrid: document.querySelector("#restaurantHoursGrid"),
  saveRestaurantHoursButton: document.querySelector("#saveRestaurantHoursButton"),
  closeRestaurantButton: document.querySelector("#closeRestaurantButton"),
  requestRestaurantDeletionButton: document.querySelector("#requestRestaurantDeletionButton"),
  restaurantDeletionDialog: document.querySelector("#restaurantDeletionDialog"),
  restaurantDeletionPasswordInput: document.querySelector("#restaurantDeletionPasswordInput"),
  restaurantDeletionConfirmationInput: document.querySelector("#restaurantDeletionConfirmationInput"),
  restaurantDeletionMessage: document.querySelector("#restaurantDeletionMessage"),
  cancelRestaurantDeletionButton: document.querySelector("#cancelRestaurantDeletionButton"),
  confirmRestaurantDeletionButton: document.querySelector("#confirmRestaurantDeletionButton"),
  saveCustomerSettingsButton: document.querySelector("#saveCustomerSettingsButton"),
  toastNotice: document.querySelector("#toastNotice"),
};

let menuCatalog = readMenuCatalog();
let activeCategory = Object.keys(menuCatalog)[0];
let menuSearchQuery = "";
let menuSearchTimer = null;
let menuCachePersistHandle = null;
let restaurantBusinessContext = null;
let todayKey = currentBusinessDate();
let nextTicket = initializeDailyTicket();
let savedOrders = readOrders();
let cloudClosureReports = new Map();
let shiftServerName = readShiftServerName();
let currentOrder = readCurrentOrderDraft();
let thermalPrinterPort = null;
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
let marketplaceAccountState = null;
let businessLogoUrl = readBusinessLogoUrl();
let restaurantActive = readRestaurantActive();
let restaurantOperationalOpen = readRestaurantOperationalOpen();
let restaurantOperationalMode = readRestaurantOperationalMode();
let restaurantOpeningHours = readRestaurantOpeningHours();
let restaurantLatitude = readCoordinate(STORAGE_KEYS.restaurantLatitude);
let restaurantLongitude = readCoordinate(STORAGE_KEYS.restaurantLongitude);
let legalBusinessName = readLegalBusinessName();
let taxId = readTaxId();
let businessPhone = readBusinessPhone();
let businessEmail = readBusinessEmail();
let legalAddress = readLegalAddress();
let editingNoteItemId = null;
let toastTimer = null;
let pendingClientOrders = [];
let clientDeliveryTrackingByOrderId = new Map();
let clientOrdersTimer = null;
let clientOrdersChannel = null;
let clientOrdersRealtimeStatus = "idle";
let centralSyncChannel = null;
let centralSyncStatus = "idle";
let centralSyncTimer = null;
let centralSyncInProgress = false;
let centralSyncRefreshPending = false;
let pendingDataSyncRequested = false;
let pendingDataSyncRetryTimer = null;
let pendingDataSyncRetryDueAt = 0;
let pendingDataSyncInFlight = null;
let pendingDataSyncRetryNotBefore = 0;
let centralRealtimeReconnectTimer = null;
let centralRealtimeStableTimer = null;
let centralRealtimeReconnectDelay = CENTRAL_REALTIME_RECONNECT_MIN_MS;
let centralRealtimeNeedsCatchup = false;

let clientOrdersRealtimeReconnectTimer = null;
let clientOrdersRealtimeStableTimer = null;
let clientOrdersRealtimeReconnectDelay =
  CLIENT_ORDERS_REALTIME_RECONNECT_MIN_MS;
let clientOrdersRealtimeNeedsCatchup = false;
let clientOrdersPollingDelay = CLIENT_ORDERS_POLL_MIN_MS;
let clientOrdersPollGeneration = 0;
let clientOrdersRefreshInFlight = null;
let clientOrdersRefreshPending = false;
let clientOrdersRefreshRetryNotBefore = 0;
let clientOrdersRefreshRetryDelay = CLIENT_ORDERS_POLL_MIN_MS;
let clientOrdersRefreshLastError = null;
let clientOrdersRefreshUserId = null;
let clientOrdersTrackingInFlight = null;
let orderCachePersistHandle = null;
let orderCachePersistMode = "";
let clientAlarmTimer = null;
let clientAlarmAudioContext = null;
let clientAlarmEnabled = readClientAlarmEnabled();
let restaurantMapsScriptPromise = null;
const restaurantPlaceAutocompletes = new Map();
let restaurantStatusSyncTimer = null;
let restaurantStatusSyncing = false;
let cloudRecoveryInFlight = null;
let cloudRecoveryLastCompletedAt = 0;
let menuSaveQueue = Promise.resolve();
let clientChatKnownMessageIds = new Set();
let clientChatLoadedOnce = false;
const cloudState = {
  client: null,
  configured: false,
  authChecked: false,
  ready: false,
  user: null,
  loading: false,
  syncing: false,
  recoveringPassword: false,
  lastError: "",
  lastErrorDetails: "",
  moduleWarning: "",
 schemaVersion: null,
schemaContractVersion: null,
releaseContractVersion: null,
schemaCompatible: false,
};

let databaseContractCheck = null;
let databaseContractValidatedClient = null;
let databaseContractValidatedUserId = null;

function invalidateDatabaseContract() {
  databaseContractCheck?.controller.abort();
  databaseContractCheck = null;
  databaseContractValidatedClient = null;
  databaseContractValidatedUserId = null;
  cloudState.schemaVersion = null;
  cloudState.schemaContractVersion = null;
  cloudState.releaseContractVersion = null;
  cloudState.schemaCompatible = false;
}

async function ensureMinimumDatabaseVersion(signal) {
  const aborted = () => signal?.reason || Object.assign(new Error("Solicitud cancelada."), { name: "AbortError" });
  if (signal?.aborted) throw aborted();
  const client = cloudState.client;
  const userId = cloudState.user?.id || null;
  if (databaseContractValidatedClient !== client || databaseContractValidatedUserId !== userId) {
    cloudState.schemaCompatible = false;
  }
if (
  Number(cloudState.schemaVersion) >= MINIMUM_DATABASE_SCHEMA_VERSION
  && Number(cloudState.schemaContractVersion) >= MINIMUM_SYNC_CONTRACT_VERSION
  && Number(cloudState.releaseContractVersion) >= MINIMUM_RELEASE_CONTRACT_VERSION
  && cloudState.schemaCompatible === true
) {
  return cloudState.schemaVersion;
}
  let check = databaseContractCheck;
  if (!check || check.client !== client || check.userId !== userId || check.controller.signal.aborted) {
    check?.controller.abort();
    check = { client, userId, controller: new AbortController(), waiters: 0, promise: null };
    databaseContractCheck = check;
    check.promise = Promise.resolve().then(() => withCloudTimeout(
      (requestSignal) => checkMinimumDatabaseVersion(requestSignal, check), undefined, 20000, check.controller.signal
    )).finally(() => {
      if (databaseContractCheck === check) databaseContractCheck = null;
    });
  }
  check.waiters += 1;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      check.waiters -= 1;
      if (!check.waiters) check.controller.abort();
      callback(value);
    };
    const onAbort = () => finish(reject, aborted());
    signal?.addEventListener("abort", onAbort, { once: true });
    check.promise.then(value => finish(resolve, value), error => finish(reject, error));
    if (signal?.aborted) onAbort();
  });
}

async function checkMinimumDatabaseVersion(signal, check) {
  const client = check.client;
  const assertSession = () => {
    if (signal?.aborted || databaseContractCheck !== check || client !== cloudState.client || check.userId !== (cloudState.user?.id || null)) {
      throw Object.assign(new Error("La sesion cambio durante la sincronizacion."), { name: "AbortError" });
    }
  };
  assertSession();
  const { data, error } = await client.rpc("get_rc_ordera_schema_version").abortSignal(signal);
  assertSession();
if (error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const status = Number(error?.status || 0);

  const isTemporaryCloudError =
    status === 503 ||
    code === "PGRST002" ||
    code === "PGRST003" ||
    /service unavailable/i.test(message) ||
    /schema cache/i.test(message) ||
    /connection pool/i.test(message) ||
    /timeout/i.test(message) ||
    /timed out/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /network/i.test(message);

  if (isTemporaryCloudError) {
    const cloudError = new Error(
      appUiText(
        "La nube de RC ORDERA no está respondiendo temporalmente. Intenta nuevamente en unos momentos."
      )
    );

    cloudError.code = "RC_ORDERA_CLOUD_TEMPORARILY_UNAVAILABLE";
    cloudError.cause = error;
    throw cloudError;
  }

  const schemaError = new Error(
    appUiText("No fue posible verificar la versión de la base de datos.")
  );

  schemaError.code = "RC_ORDERA_SCHEMA_CHECK_FAILED";
  schemaError.cause = error;
  throw schemaError;
}
  const row = Array.isArray(data) ? data[0] : data;
  const version = Number(row?.schema_version ?? row);
  if (!Number.isFinite(version) || version < MINIMUM_DATABASE_SCHEMA_VERSION) {
    const schemaError = new Error(appUiText("La version de la base de datos es anterior a V91."));
    schemaError.code = "RC_ORDERA_SCHEMA_OUTDATED";
    throw schemaError;
  }

  const { data: contractData, error: contractError } = await client.rpc(
    "get_rc_ordera_sync_contract"
  ).abortSignal(signal);
  assertSession();
  if (contractError) {
    if (["42883", "PGRST202"].includes(String(contractError?.code || ""))) {
      const schemaError = new Error(
        appUiText("La base de datos no tiene completo el contrato de sincronizacion V91.")
      );
      schemaError.code = "RC_ORDERA_SCHEMA_INCOMPLETE";
      schemaError.cause = contractError;
      throw schemaError;
    }
    if (isTemporarySyncInfrastructureError(contractError)) {
      const cloudError = new Error(
        appUiText(
          "La nube de RC ORDERA no está respondiendo temporalmente. Intenta nuevamente en unos momentos."
        )
      );
      cloudError.code = "RC_ORDERA_CLOUD_TEMPORARILY_UNAVAILABLE";
      cloudError.cause = contractError;
      throw cloudError;
    }
    const schemaError = new Error(
      appUiText("No fue posible verificar la versión de la base de datos.")
    );
    schemaError.code = "RC_ORDERA_SCHEMA_CHECK_FAILED";
    schemaError.cause = contractError;
    throw schemaError;
  }

  const contractRow = Array.isArray(contractData) ? contractData[0] : contractData;
  const contractVersion = Number(contractRow?.contract_version);
  const contractSchemaVersion = Number(contractRow?.schema_version);
  if (
    contractRow?.compatible !== true
    || !Number.isFinite(contractVersion)
    || contractVersion < MINIMUM_SYNC_CONTRACT_VERSION
    || !Number.isFinite(contractSchemaVersion)
    || contractSchemaVersion < MINIMUM_DATABASE_SCHEMA_VERSION
  ) {
    const schemaError = new Error(
      appUiText("La base de datos no tiene completo el contrato de sincronizacion V91.")
    );
    schemaError.code = "RC_ORDERA_SCHEMA_INCOMPLETE";
    schemaError.missingComponents = Array.isArray(contractRow?.missing_components)
      ? contractRow.missing_components
      : [];
    throw schemaError;
  }
const {
  data: releaseContractData,
  error: releaseContractError,
} = await client
  .rpc("get_rc_ordera_release_contract")
  .abortSignal(signal);
assertSession();

if (releaseContractError) {
  if (
    ["42883", "PGRST202"].includes(
      String(releaseContractError?.code || "")
    )
  ) {
    const schemaError = new Error(
      appUiText(
        "La base de datos no tiene completo el contrato de sincronizacion V91."
      )
    );

    schemaError.code = "RC_ORDERA_SCHEMA_INCOMPLETE";
    schemaError.cause = releaseContractError;
    throw schemaError;
  }

  if (isTemporarySyncInfrastructureError(releaseContractError)) {
    const cloudError = new Error(
      appUiText(
        "La nube de RC ORDERA no está respondiendo temporalmente. Intenta nuevamente en unos momentos."
      )
    );

    cloudError.code =
      "RC_ORDERA_CLOUD_TEMPORARILY_UNAVAILABLE";

    cloudError.cause = releaseContractError;
    throw cloudError;
  }

  const schemaError = new Error(
    appUiText(
      "No fue posible verificar la versión de la base de datos."
    )
  );

  schemaError.code = "RC_ORDERA_SCHEMA_CHECK_FAILED";
  schemaError.cause = releaseContractError;

  throw schemaError;
}

const releaseContractRow = Array.isArray(releaseContractData)
  ? releaseContractData[0]
  : releaseContractData;

const releaseContractVersion = Number(
  releaseContractRow?.release_contract_version
);

const releaseSchemaVersion = Number(
  releaseContractRow?.schema_version
);

if (
  releaseContractRow?.compatible !== true
  || !Number.isFinite(releaseContractVersion)
  || releaseContractVersion < MINIMUM_RELEASE_CONTRACT_VERSION
  || !Number.isFinite(releaseSchemaVersion)
  || releaseSchemaVersion < MINIMUM_DATABASE_SCHEMA_VERSION
) {
  const schemaError = new Error(
    appUiText(
      "La base de datos no tiene completo el contrato de sincronizacion V91."
    )
  );

  schemaError.code = "RC_ORDERA_SCHEMA_INCOMPLETE";

  schemaError.missingComponents = Array.isArray(
    releaseContractRow?.missing_components
  )
    ? releaseContractRow.missing_components
    : [];

  throw schemaError;
}
cloudState.schemaVersion = version;
cloudState.schemaContractVersion = contractVersion;
cloudState.releaseContractVersion = releaseContractVersion;
cloudState.schemaCompatible = true;
databaseContractValidatedClient = client;
databaseContractValidatedUserId = check.userId;

return version;
}

async function refreshRestaurantBusinessContext(options = {}) {
  const { force = false } = options;
  const refreshedRecently = restaurantBusinessContext?.loadedAt
    && Date.now() - restaurantBusinessContext.loadedAt < 60_000;
  if (!force && refreshedRecently) return restaurantBusinessContext;
  if (!cloudState.client || !cloudState.user || !navigator.onLine) return restaurantBusinessContext;

  const { data, error } = await withCloudTimeout(
    cloudState.client.rpc("get_current_restaurant_business_context"),
    undefined, 20000, options.signal
  );
  if (error) {
    if (["42883", "PGRST202"].includes(error.code)) return restaurantBusinessContext;
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.business_date) return restaurantBusinessContext;

  const previousDate = todayKey;
  restaurantBusinessContext = {
    businessDate: row.business_date,
    timezone: row.timezone_name || "UTC",
    dayStart: row.day_start || null,
    dayEnd: row.day_end || null,
    loadedAt: Date.now(),
  };
  todayKey = restaurantBusinessContext.businessDate;
  if (previousDate !== todayKey) {
    clearPendingTicketCounter();
    nextTicket = 1;
    if (!currentOrder.saved) {
      currentOrder.ticketNumber = null;
      currentOrder.businessDate = todayKey;
    }
    saveTicketState();
  }
  return restaurantBusinessContext;
}
function createBlankOrder() {
  return {
    id: null,
    ticketNumber: null,
    type: "Comer en el punto",
    paymentMethod: "Pago en caja",
    paymentStatus: "pending",
    customer: "",
    server: shiftServerName,
    cashier: shiftServerName,
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
  normalized.paymentStatus = normalizePaymentStatus(normalized.paymentStatus, normalized.saved ? "unverified" : "pending");
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

function currentBusinessDate(date = null) {
  if (!date && /^\d{4}-\d{2}-\d{2}$/.test(restaurantBusinessContext?.businessDate || "")) {
    return restaurantBusinessContext.businessDate;
  }
  const source = date instanceof Date ? date : new Date();
  const year = source.getFullYear();
  const month = String(source.getMonth() + 1).padStart(2, "0");
  const day = String(source.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initializeDailyTicket() {
  const storedDate = localStorage.getItem(STORAGE_KEYS.ticketDate);
  if (storedDate !== todayKey) {
    localStorage.removeItem(STORAGE_KEYS.ticketCounterPending);
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
  const contextIsFresh = restaurantBusinessContext?.loadedAt
    && Date.now() - restaurantBusinessContext.loadedAt < 60_000;
  const latestDate = contextIsFresh
    ? restaurantBusinessContext.businessDate
    : currentBusinessDate(new Date());
  if (latestDate === todayKey) return false;

  clearPendingTicketCounter();
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
      ? parsed.slice(0, LOCAL_ORDER_CACHE_LIMIT).map((order) =>
          normalizeOrderNotes({
            ...order,
            type: normalizeOrderType(order.type),
            paymentStatus: normalizePaymentStatus(order.paymentStatus, "unverified"),
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
  return savedOrders.filter(
    (order) =>
      orderBusinessDate(order) === todayKey &&
      !isCancelledSavedOrder(order)
  );
}

function ordersForDay(day) {
  return savedOrders.filter((order) => orderBusinessDate(order) === day && !isExcludedFromClosure(order));
}

function currentMonthKey(date = null) {
  return currentBusinessDate(date).slice(0, 7);
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(appUiLocale(), {
    month: "long",
    year: "numeric",
  });
}

function formatDayLabel(day) {
  const [year, monthNumber, dayNumber] = day.split("-").map(Number);
  return new Date(year, monthNumber - 1, dayNumber).toLocaleDateString(appUiLocale(), {
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
}

function ordersForMonth(month) {
  return savedOrders.filter((order) => orderBusinessDate(order).startsWith(`${month}-`) && !isExcludedFromClosure(order));
}

function currentYearKey(date = null) {
  return currentBusinessDate(date).slice(0, 4);
}

function ordersForYear(year) {
  return savedOrders.filter((order) => orderBusinessDate(order).startsWith(`${year}-`) && !isExcludedFromClosure(order));
}

function isExcludedFromClosure(order) {
  return ["cancelled", "rejected"].includes(String(order?.canonicalStatus || order?.status || "").toLowerCase());
}

function isCancelledSavedOrder(order) {
  return String(order?.canonicalStatus || order?.status || "").toLowerCase() === "cancelled";
}

function closureReportCacheKey(periodType, periodValue) {
  return `${cloudState.user?.id || "local"}:${String(periodType || "").toLowerCase()}:${String(periodValue || "")}`;
}

function normalizedCloudClosureReport(periodType, periodValue) {
  const report = cloudClosureReports.get(closureReportCacheKey(periodType, periodValue));
  if (!report) return null;
  const number = (value) => Number(value) || 0;
  return {
    ...report,
    tickets: number(report.tickets),
    items: number(report.items),
    total: number(report.total),
    average: number(report.average),
    firstTicket: report.firstTicket ? number(report.firstTicket) : null,
    lastTicket: report.lastTicket ? number(report.lastTicket) : null,
    cancelled: number(report.cancelled),
    days: (report.days || []).map((row) => ({ ...row, tickets: number(row.tickets), items: number(row.items), total: number(row.total) })),
    months: (report.months || []).map((row) => ({ ...row, tickets: number(row.tickets), items: number(row.items), total: number(row.total) })),
    products: (report.products || []).map((row) => ({ ...row, qty: number(row.qty), total: number(row.total) })),
    orderTypes: (report.orderTypes || []).map((row) => ({ label: orderTypeLabel(normalizeOrderType(row.name)), tickets: number(row.count), total: number(row.total) })),
    paymentMethods: (report.paymentMethods || []).map((row) => ({ label: paymentMethodLabel(row.name), tickets: number(row.count), total: number(row.total) })),
    servers: (report.servers || []).map((row) => ({ name: row.name || "No indicado", tickets: number(row.count), total: number(row.total) })),
  };
}

function buildDailyClose(day) {
  const cloudReport = normalizedCloudClosureReport("day", day);
  if (cloudReport) return { ...cloudReport, day, label: formatDayLabel(day) };
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
  const cloudReport = normalizedCloudClosureReport("month", month);
  if (cloudReport) return { ...cloudReport, month, label: formatMonthLabel(month) };
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

function persistOrdersCache() {
  orderCachePersistHandle = null;
  orderCachePersistMode = "";

  /*
   * Los pedidos que todavía dependen
   * del almacenamiento local tienen prioridad.
   */
  const criticalOrders =
    savedOrders.filter((order) =>
      order?.saved &&
      (
        order.syncStatus === "pending" ||
        order.syncStatus === "local" ||
        order.id === currentOrder?.id
      )
    );

  const criticalIds =
    new Set(
      criticalOrders.map(
        (order) => order.id
      )
    );

  /*
   * Completamos el cache con pedidos ya
   * sincronizados, sin desplazar pedidos críticos.
   */
  const availableSlots =
    Math.max(
      0,
      LOCAL_ORDER_CACHE_LIMIT -
        criticalOrders.length
    );

  const remainingOrders =
    savedOrders
      .filter(
        (order) =>
          !criticalIds.has(order.id)
      )
      .slice(0, availableSlots);

  /*
   * Conservamos el orden cronológico habitual
   * de la aplicación.
   */
  const ordersToPersist =
    [
      ...criticalOrders,
      ...remainingOrders,
    ].sort(
      (a, b) =>
        new Date(b.createdAt || 0) -
        new Date(a.createdAt || 0)
    );

  try {
    localStorage.setItem(
      STORAGE_KEYS.orders,
      JSON.stringify(
        ordersToPersist
      )
    );

    return true;
  } catch (error) {
    /*
     * MUY IMPORTANTE:
     * no eliminamos pedidos,
     * no borramos currentOrderDraft
     * y no hacemos podas destructivas.
     */
    console.error(
      "No fue posible persistir el cache local de pedidos. Los datos en memoria se conservan.",
      error
    );

    return false;
  }
}
function saveOrders(options = {}) {
  const { immediate = false } = options;
  if (immediate) {
    if (orderCachePersistHandle !== null) {
      if (orderCachePersistMode === "idle" && window.cancelIdleCallback) {
        window.cancelIdleCallback(orderCachePersistHandle);
      } else {
        window.clearTimeout(orderCachePersistHandle);
      }
    }
    persistOrdersCache();
    return;
  }

  if (orderCachePersistHandle !== null) return;
  if (window.requestIdleCallback) {
    orderCachePersistMode = "idle";
    orderCachePersistHandle = window.requestIdleCallback(persistOrdersCache, { timeout: 1200 });
  } else {
    orderCachePersistMode = "timeout";
    orderCachePersistHandle = window.setTimeout(persistOrdersCache, 120);
  }
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

function withCloudTimeout(
  operation,
  message =
    "La nube no respondio a tiempo.",
  timeoutMs = 20000,
  parentSignal = null
) {
  let timerId = null;
  let abortController = null;
  let pendingOperation = operation;
  const forwardAbort = () => abortController?.abort(parentSignal.reason);
  if (parentSignal?.aborted) {
    return Promise.reject(parentSignal.reason || Object.assign(new Error(message), { name: "AbortError" }));
  }

  /*
   * Las consultas PostgREST de Supabase
   * permiten AbortSignal.
   *
   * Si esta operación lo soporta,
   * el timeout cancela también la
   * solicitud real y no solamente
   * deja de esperarla.
   */
  if (
    typeof AbortController !==
      "undefined"
  ) {
    abortController =
      new AbortController();

  }
  parentSignal?.addEventListener("abort", forwardAbort, { once: true });
  const attachSignal = (request) =>
    abortController && typeof request?.abortSignal === "function"
      ? request.abortSignal(abortController.signal)
      : request;
  try {
    pendingOperation = typeof operation === "function"
      ? operation(abortController?.signal)
      : operation;
    pendingOperation = Array.isArray(pendingOperation)
      ? Promise.all(pendingOperation.map(attachSignal))
      : attachSignal(pendingOperation);
  } catch (error) {
    parentSignal?.removeEventListener("abort", forwardAbort);
    abortController?.abort();
    return Promise.reject(error);
  }

  const timeout =
    new Promise((_, reject) => {
      timerId = window.setTimeout(
        () => {
          /*
           * Cancelamos la petición
           * únicamente si esta operación
           * admite cancelación.
           */
          const error =
            new Error(message);

          error.name = "TimeoutError";
          error.code =
            "RC_ORDERA_CLOUD_TIMEOUT";

          reject(error);
          if (abortController && !abortController.signal.aborted) {
            abortController.abort();
          }
        },
        timeoutMs
      );
    });

  return Promise.race([
    Promise.resolve(
      pendingOperation
    ),
    timeout,
  ]).finally(() => {
    parentSignal?.removeEventListener("abort", forwardAbort);
    if (timerId !== null) {
      window.clearTimeout(timerId);
    }
  });
}
function isTemporarySyncInfrastructureError(error) {
  const status = Number(
    error?.status ??
    error?.statusCode ??
    error?.cause?.status ??
    error?.cause?.statusCode
  );

  const code = String(
    error?.code ||
    error?.cause?.code ||
    ""
  )
    .trim()
    .toUpperCase();

  const name = String(
    error?.name ||
    error?.cause?.name ||
    ""
  )
    .trim()
    .toUpperCase();

  const details = [
    error?.message,
    error?.details,
    error?.hint,
    error?.cause?.message,
    error?.cause?.details,
    error?.cause?.hint,
  ]
    .filter(Boolean)
    .join(" ");

  /*
   * Timeout o confirmación remota incompleta.
   * Se conserva el pendiente y se reintenta con el
   * mismo backoff de infraestructura, sin crear un bucle.
   */
  if (
    [
      "RC_ORDERA_CLOUD_TIMEOUT",
      "RC_ORDERA_ORDER_NOT_CONFIRMED",
      "RC_ORDERA_RECONCILIATION_NOT_CONFIRMED",
    ].includes(code)
  ) {
    return true;
  }

  /*
   * Una petición abortada por nuestro
   * timeout también es un fallo temporal.
   */
  if (name === "ABORTERROR") {
    return true;
  }

  /*
   * Errores HTTP típicamente transitorios.
   *
   * 408 = request timeout
   * 429 = rate limit
   * 502/503/504 = infraestructura upstream
   */
  if (
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  /*
   * Errores PostgREST asociados a
   * disponibilidad/conexiones.
   */
  if (
    code === "PGRST002" ||
    code === "PGRST003"
  ) {
    return true;
  }

  /*
   * Última defensa para errores de red
   * que no entregan status ni código fiable.
   */
  return (
    /\b502\b|\b503\b|\b504\b/i.test(
      details
    ) ||
    /schema cache/i.test(details) ||
    /connection pool/i.test(details) ||
    /timed?\s*out/i.test(details) ||
    /\btimeout\b/i.test(details) ||
    /failed to fetch/i.test(details) ||
    /fetch failed/i.test(details) ||
    /network error/i.test(details) ||
    /network request failed/i.test(
      details
    ) ||
    /load failed/i.test(details) ||
    /econnreset/i.test(details) ||
    /etimedout/i.test(details)
  );
}
function isOrderRevisionConflictError(error) {
  if (!error) {
    return false;
  }

  const codes = [
    error?.code,
    error?.cause?.code,
  ]
    .filter(Boolean)
    .map((value) =>
      String(value)
        .trim()
        .toUpperCase()
    );

  /*
   * En RC ORDERA un conflicto verdadero
   * debe llegar normalizado con este código.
   *
   * saveCloudOrder() ya se encarga antes de
   * distinguir entre:
   *
   * - confirmación perdida
   * - revisión requerida
   * - conflicto real entre dispositivos
   */
  if (
    codes.includes(
      "ORDER_REVISION_CONFLICT"
    )
  ) {
    return true;
  }

  /*
   * Defensa para errores serializados donde
   * el código pudiera venir dentro del mensaje,
   * details o hint.
   */
  const details = [
    error?.message,
    error?.details,
    error?.hint,
    error?.cause?.message,
    error?.cause?.details,
    error?.cause?.hint,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    /\bORDER_REVISION_CONFLICT\b/i
      .test(details)
  );
}
function isCancelledOrderOverwriteError(error) {
  if (!error) return false;

  const code = String(error?.code || error?.cause?.code || "").trim();
  const details = [
    error?.message,
    error?.details,
    error?.hint,
    error?.cause?.message,
    error?.cause?.details,
    error?.cause?.hint,
  ]
    .filter(Boolean)
    .join(" ");

  return code === "40001" && /cancelled order cannot be overwritten/i.test(details);
}

function needsCloudSync(order) {
  return Boolean(
    order?.saved &&
    order.syncStatus === "pending" &&
    !isCancelledSavedOrder(order)
  );
}
function isOrderRevisionSyncBlocked(order) {
  return Boolean(
    order?._syncBlockedReason === "revision_conflict"
  );
}

function needsAutomaticCloudSync(order) {
  return (
    needsCloudSync(order) &&
    !isOrderRevisionSyncBlocked(order)
  );
}
const REVISION_CONFLICT_BACKUP_LIMIT = 10;

function readRevisionConflictBackups() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEYS.revisionConflictBackups
      );

    if (!raw) {
      return {
        ok: true,
        backups: [],
      };
    }

    const parsed =
      JSON.parse(raw);

    /*
     * Si el contenido existe pero está corrupto
     * o no tiene el formato esperado, NO lo
     * sobrescribimos automáticamente.
     */
    if (!Array.isArray(parsed)) {
      console.error(
        "[RC ORDERA] El almacenamiento de respaldos de conflictos tiene un formato inválido. El valor original se conserva."
      );

      return {
        ok: false,
        backups: [],
      };
    }

    return {
      ok: true,
      backups: parsed,
    };
  } catch (error) {
    /*
     * Un error leyendo localStorage jamás debe
     * provocar pérdida del pedido ni crash del POS.
     */
    console.error(
      "[RC ORDERA] No fue posible leer los respaldos de conflictos de revisión.",
      error
    );

    return {
      ok: false,
      backups: [],
    };
  }
}

function saveRevisionConflictBackup(
  order,
  remoteRevision = null
) {
  if (!order?.id) {
    return false;
  }

  const stored =
    readRevisionConflictBackups();

  /*
   * Si el almacenamiento existente está corrupto
   * o no puede leerse, NO lo sobrescribimos.
   */
  if (!stored.ok) {
    return false;
  }

  const localRevision =
    Number.parseInt(
      order._syncRevision,
      10
    );

const parsedRemoteRevision =
  Number.parseInt(
    remoteRevision,
    10
  );

/*
 * IDEMPOTENCIA DEL RESPALDO.
 *
 * La misma edición local del mismo conflicto
 * debe guardarse una sola vez.
 *
 * Esto evita llenar los 10 espacios disponibles
 * con copias repetidas del mismo pedido.
 *
 * IMPORTANTE:
 * - no modifica el pedido;
 * - no llama a Supabase;
 * - no crea timers;
 * - no genera reintentos;
 * - no elimina respaldos existentes.
 */
const existingBackup =
  stored.backups.some(
    (backup) =>
      String(backup?.orderId || "") ===
        String(order.id) &&
      String(backup?.localUpdatedAt || "") ===
        String(order.updatedAt || "") &&
      (
        Number.parseInt(
          backup?.localRevision,
          10
        ) || 0
      ) ===
        (
          Number.isFinite(localRevision)
            ? localRevision
            : 0
        ) &&
      (
        Number.parseInt(
          backup?.remoteRevision,
          10
        ) || 0
      ) ===
        (
          Number.isFinite(parsedRemoteRevision)
            ? parsedRemoteRevision
            : 0
        ) &&
      backup?.order &&
      typeof backup.order === "object"
  );

if (existingBackup) {
  return true;
}

let orderSnapshot;

  try {
    orderSnapshot =
      structuredCloneOrder(order);
  } catch (error) {
    console.error(
      "[RC ORDERA] No fue posible crear una copia del pedido en conflicto.",
      error
    );

    return false;
  }

  const backup = {
    backupId: [
      String(order.id),
      String(order.updatedAt || ""),
      Number.isFinite(localRevision)
        ? localRevision
        : 0,
      Number.isFinite(parsedRemoteRevision)
        ? parsedRemoteRevision
        : 0,
      Date.now(),
    ].join(":"),

    orderId:
      String(order.id),

    localRevision:
      Number.isFinite(localRevision)
        ? localRevision
        : null,

    remoteRevision:
      Number.isFinite(parsedRemoteRevision)
        ? parsedRemoteRevision
        : null,

    localUpdatedAt:
      order.updatedAt || null,

    backedUpAt:
      new Date().toISOString(),

    order:
      orderSnapshot,
  };

  /*
   * Máximo 10 respaldos.
   *
   * Es deliberadamente pequeño para evitar
   * llenar localStorage con datos históricos.
   */
  const nextBackups = [
    backup,
    ...stored.backups,
  ].slice(
    0,
    REVISION_CONFLICT_BACKUP_LIMIT
  );

  try {
    localStorage.setItem(
      STORAGE_KEYS.revisionConflictBackups,
      JSON.stringify(nextBackups)
    );

    /*
     * Verificación posterior.
     *
     * No consideramos exitoso el respaldo
     * solamente porque setItem() no lanzó error.
     */
    const verificationRaw =
      localStorage.getItem(
        STORAGE_KEYS.revisionConflictBackups
      );

    const verification =
      JSON.parse(
        verificationRaw || "[]"
      );

    const confirmed =
      Array.isArray(verification) &&
      verification.some(
        (entry) =>
          entry?.backupId ===
          backup.backupId
      );

    if (!confirmed) {
      console.error(
        "[RC ORDERA] El respaldo del conflicto no pudo verificarse."
      );

      return false;
    }

    return true;
  } catch (error) {
    /*
     * Si localStorage está lleno, bloqueado
     * o falla por cualquier motivo,
     * informamos false.
     *
     * Más adelante usaremos este resultado
     * para impedir que se descarte la versión
     * local sin haberla respaldado.
     */
    console.error(
      "[RC ORDERA] No fue posible guardar el respaldo del pedido en conflicto.",
      error
    );

    return false;
  }
}
function blockOrderRevisionSync(
  order,
  remoteRevision = null
) {
  if (!order?.id) return;

  const parsedRemoteRevision =
    Number.parseInt(remoteRevision, 10);

  const patch = {
    syncStatus: "pending",
    _syncBlockedReason:
      "revision_conflict",
    _syncBlockedAt:
      new Date().toISOString(),
  };

  if (
    Number.isFinite(parsedRemoteRevision) &&
    parsedRemoteRevision > 0
  ) {
    patch._syncRemoteRevision =
      parsedRemoteRevision;
  }

  Object.assign(order, patch);

  savedOrders = savedOrders.map(
    (savedOrder) =>
      savedOrder.id === order.id
        ? {
            ...savedOrder,
            ...patch,
          }
        : savedOrder
  );

  if (currentOrder.id === order.id) {
    Object.assign(
      currentOrder,
      patch
    );
  }

  saveOrders({
    immediate: true,
  });

  saveCurrentOrderDraft();

  console.warn(
    "[RC ORDERA] Sincronización automática bloqueada por conflicto de revisión.",
    {
      orderId: order.id,
      localRevision:
        order._syncRevision || null,
      remoteRevision:
        parsedRemoteRevision || null,
    }
  );
}
function pendingOrdersCount() {
  return savedOrders.filter(needsCloudSync).length;
}

function readDeletedOrderIds() {
  const raw =
    localStorage.getItem(
      STORAGE_KEYS.deletedOrders
    );

  /*
   * No existe ninguna eliminación pendiente.
   */
  if (!raw) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(raw);

    /*
     * Nunca interpretamos un objeto,
     * string u otro tipo como una cola válida.
     *
     * IMPORTANTE:
     * no sobrescribimos el valor original.
     */
    if (!Array.isArray(parsed)) {
      console.error(
        "[RC ORDERA] La cola local de pedidos eliminados tiene un formato inválido. El valor original se conserva."
      );

      return [];
    }

    /*
     * Los IDs de pedidos de RC ORDERA son strings.
     *
     * - eliminamos entradas inválidas
     * - quitamos espacios
     * - eliminamos vacíos
     * - eliminamos duplicados
     *
     * No exigimos UUID porque existen IDs
     * legacy/fallback que también son válidos.
     */
    return Array.from(
      new Set(
        parsed
          .filter(
            (id) =>
              typeof id === "string"
          )
          .map(
            (id) => id.trim()
          )
          .filter(Boolean)
      )
    );
  } catch (error) {
    /*
     * Un JSON corrupto NO debe provocar:
     *
     * - crash de la caja
     * - borrado de la cola
     * - sobrescritura automática
     *
     * Conservamos intacto localStorage
     * para poder diagnosticar o recuperar.
     */
    console.error(
      "[RC ORDERA] No fue posible leer la cola local de pedidos eliminados. El dato original se conserva.",
      error
    );

    return [];
  }
}

function saveDeletedOrderIds(ids) {
  /*
   * Normalizamos antes de persistir.
   * La cola de eliminaciones solo acepta
   * identificadores de texto válidos.
   */
  const normalizedIds =
    Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .filter(
            (id) =>
              typeof id === "string"
          )
          .map(
            (id) => id.trim()
          )
          .filter(Boolean)
      )
    );

  try {
    const serialized =
      JSON.stringify(normalizedIds);

    localStorage.setItem(
      STORAGE_KEYS.deletedOrders,
      serialized
    );

    /*
     * Verificación posterior a la escritura.
     *
     * No damos por hecho que localStorage
     * guardó correctamente.
     */
    const persisted =
      localStorage.getItem(
        STORAGE_KEYS.deletedOrders
      );

    if (persisted !== serialized) {
      console.error(
        "[RC ORDERA] No fue posible verificar la cola local de pedidos eliminados."
      );

      return false;
    }

    return true;
  } catch (error) {
    /*
     * Nunca eliminamos ni limpiamos datos
     * como reacción a un fallo de escritura.
     */
    console.error(
      "[RC ORDERA] No fue posible guardar la cola local de pedidos eliminados.",
      error
    );

    return false;
  }
}

function queueDeletedOrderId(orderId) {
  const normalizedId =
    typeof orderId === "string"
      ? orderId.trim()
      : "";

  /*
   * Un ID inválido nunca entra
   * en la cola de eliminaciones.
   */
  if (!normalizedId) {
    return false;
  }

  /*
   * Si este dispositivo no necesita
   * sincronización cloud, no hay nada
   * remoto que poner en cola.
   */
  if (!shouldQueueForCloud()) {
    return true;
  }

  /*
   * Antes de modificar la cola verificamos
   * que el contenido existente sea válido.
   *
   * Esto evita sobrescribir una cola corrupta
   * que podría contener eliminaciones todavía
   * no sincronizadas.
   */
  const raw =
    localStorage.getItem(
      STORAGE_KEYS.deletedOrders
    );

  if (raw) {
    try {
      const parsed =
        JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        console.error(
          "[RC ORDERA] No se agregó el pedido a la cola de eliminaciones porque la cola existente tiene un formato inválido."
        );

        return false;
      }
    } catch (error) {
      console.error(
        "[RC ORDERA] No se agregó el pedido a la cola de eliminaciones porque la cola existente no pudo leerse.",
        error
      );

      return false;
    }
  }

  const currentIds =
    readDeletedOrderIds();

  /*
   * Operación idempotente:
   * si ya estaba pendiente de eliminación,
   * no escribimos nuevamente.
   */
  if (
    currentIds.includes(
      normalizedId
    )
  ) {
    return true;
  }

  const saved =
    saveDeletedOrderIds([
      ...currentIds,
      normalizedId,
    ]);

  if (!saved) {
    console.error(
      `[RC ORDERA] No fue posible poner el pedido ${normalizedId} en la cola de eliminaciones.`
    );

    return false;
  }

  return true;
}

function clearDeletedOrderId(orderId) {
  const normalizedId =
    typeof orderId === "string"
      ? orderId.trim()
      : "";

  if (!normalizedId) {
    return false;
  }

  const raw =
    localStorage.getItem(
      STORAGE_KEYS.deletedOrders
    );

  /*
   * Si no existe cola, el objetivo
   * ya está cumplido.
   */
  if (!raw) {
    return true;
  }

  /*
   * Nunca modificamos una cola que
   * no podamos interpretar con seguridad.
   */
  try {
    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.error(
        "[RC ORDERA] No se pudo retirar el pedido de la cola de eliminaciones porque la cola existente tiene un formato inválido."
      );

      return false;
    }
  } catch (error) {
    console.error(
      "[RC ORDERA] No se pudo retirar el pedido de la cola de eliminaciones porque la cola existente no pudo leerse.",
      error
    );

    return false;
  }

  const currentIds =
    readDeletedOrderIds();

  /*
   * Operación idempotente:
   * si ya no existe, consideramos
   * la limpieza completada.
   */
  if (
    !currentIds.includes(
      normalizedId
    )
  ) {
    return true;
  }

  const nextIds =
    currentIds.filter(
      (id) =>
        id !== normalizedId
    );

  const saved =
    saveDeletedOrderIds(
      nextIds
    );

  if (!saved) {
    console.error(
      `[RC ORDERA] No fue posible retirar el pedido ${normalizedId} de la cola de eliminaciones.`
    );

    return false;
  }

  return true;
}

function pendingDeletedOrdersCount() {
  return readDeletedOrderIds().length;
}

function hasPendingDataToSync() {
  return hasPendingSettings()
    || hasPendingMenu()
    || pendingTicketCounter() > 0
    || pendingDeletedOrdersCount() > 0
    || savedOrders.some(
      needsAutomaticCloudSync
    );
}

function hasPendingSettings() {
  return Boolean(
    localStorage.getItem(STORAGE_KEYS.settingsPending)
  );
}

function buildAnnualClose(year) {
  const cloudReport = normalizedCloudClosureReport("year", String(year));
  if (cloudReport) return { ...cloudReport, year: String(year) };
  const yearOrders = ordersForYear(year);
  const months = new Map();
  const products = new Map();

  yearOrders.forEach((order) => {
    const month = orderBusinessDate(order).slice(0, 7);
    const record = months.get(month) || { month, tickets: 0, items: 0, total: 0 };
    record.tickets += 1;
    record.items += orderItemsCount(order);
    record.total += orderTotal(order);
    months.set(month, record);
    orderItemsList(order).forEach((item) => {
      const key = itemReportKey(item);
      const product = products.get(key) || { name: itemReportName(item), qty: 0, total: 0 };
      product.qty += itemQuantity(item);
      product.total += itemLineTotal(item);
      products.set(key, product);
    });
  });

  const total = yearOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const items = yearOrders.reduce((sum, order) => sum + orderItemsCount(order), 0);
  return {
    year,
    tickets: yearOrders.length,
    items,
    total,
    average: yearOrders.length ? total / yearOrders.length : 0,
    months: Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)),
    products: Array.from(products.values()).sort((a, b) => b.qty - a.qty || b.total - a.total),
  };
}
function markSettingsPending() {
  if (!cloudState.configured) return null;

  const token = `${Date.now()}-${Math.random()}`;

  localStorage.setItem(
    STORAGE_KEYS.settingsPending,
    token
  );

  return token;
}

function currentSettingsPendingToken() {
  return localStorage.getItem(
    STORAGE_KEYS.settingsPending
  );
}

function clearSettingsPending(expectedToken = null) {
  if (
    expectedToken &&
    currentSettingsPendingToken() !== expectedToken
  ) {
    return false;
  }

  localStorage.removeItem(
    STORAGE_KEYS.settingsPending
  );

  return true;
}
function hasPendingMenu() {
  return Boolean(
    localStorage.getItem(STORAGE_KEYS.menuPending)
  );
}

function markMenuPending() {
  if (!cloudState.configured) return null;

  const token = `${Date.now()}-${Math.random()}`;

  localStorage.setItem(
    STORAGE_KEYS.menuPending,
    token
  );

  return token;
}

function currentMenuPendingToken() {
  return localStorage.getItem(
    STORAGE_KEYS.menuPending
  );
}

function clearMenuPending(expectedToken = null) {
  if (
    expectedToken &&
    currentMenuPendingToken() !== expectedToken
  ) {
    return false;
  }

  localStorage.removeItem(
    STORAGE_KEYS.menuPending
  );

  return true;
}

function storedCloudRevision(key) {
  const value = Number.parseInt(localStorage.getItem(key) || "0", 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function storeCloudRevision(key, value) {
  const revision = Number.parseInt(value, 10);
  if (Number.isFinite(revision) && revision >= 0) localStorage.setItem(key, String(revision));
}

function menuProductCount(menu = menuCatalog) {
  const normalized = normalizeMenuCatalog(menu);
  return Object.values(normalized).reduce((total, products) => total + (Array.isArray(products) ? products.length : 0), 0);
}

function menuCatalogsMatch(first, second) {
  return JSON.stringify(normalizeMenuCatalog(first)) === JSON.stringify(normalizeMenuCatalog(second));
}

function readConfirmedCloudMenu() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.confirmedMenu) || "null");
    if (!stored || stored.userId !== cloudState.user?.id || !stored.menu) return null;
    return normalizeMenuCatalog(stored.menu);
  } catch {
    return null;
  }
}

function storeConfirmedCloudMenu(menu) {
  if (!cloudState.user?.id) return;
  localStorage.setItem(STORAGE_KEYS.confirmedMenu, JSON.stringify({
    userId: cloudState.user.id,
    menu: normalizeMenuCatalog(menu),
  }));
}

function clearConfirmedCloudMenu() {
  localStorage.removeItem(STORAGE_KEYS.confirmedMenu);
}

function menuProductEntries(menu) {
  const entries = new Map();
  Object.entries(normalizeMenuCatalog(menu)).forEach(([category, products]) => {
    products.forEach((product, index) => {
      entries.set(product.id, { category, index, product });
    });
  });
  return entries;
}
function readConfirmedCloudSettings() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.confirmedSettings) || "null"
    );

    if (
      !stored ||
      stored.userId !== cloudState.user?.id ||
      !stored.settings
    ) {
      return null;
    }

    return structuredClone(stored.settings);
  } catch {
    return null;
  }
}

function storeConfirmedCloudSettings(settings) {
  if (!cloudState.user?.id || !settings) return;

  localStorage.setItem(
    STORAGE_KEYS.confirmedSettings,
    JSON.stringify({
      userId: cloudState.user.id,
      settings: structuredClone(settings),
    })
  );
}

function clearConfirmedCloudSettings() {
  localStorage.removeItem(STORAGE_KEYS.confirmedSettings);
}

function settingsValuesMatch(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function mergeConcurrentSettingsChanges(
  baseSettings,
  localSettings,
  remoteSettings
) {
  const isMergeableObject = (value) =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value);

  const mergeObjectChanges = (
    baseObject,
    localObject,
    remoteObject
  ) => {
    const base = isMergeableObject(baseObject)
      ? baseObject
      : {};

    const local = isMergeableObject(localObject)
      ? localObject
      : {};

    const remote = isMergeableObject(remoteObject)
      ? remoteObject
      : {};

    const merged =
      structuredClone(remote);

    const keys = new Set([
      ...Object.keys(base),
      ...Object.keys(local),
    ]);

    keys.forEach((key) => {
      const baseHas =
        Object.prototype.hasOwnProperty.call(
          base,
          key
        );

      const localHas =
        Object.prototype.hasOwnProperty.call(
          local,
          key
        );

      const baseValue =
        base[key];

      const localValue =
        local[key];

      const remoteValue =
        remote[key];

      if (
        settingsValuesMatch(
          baseValue,
          localValue
        )
      ) {
        return;
      }

      if (!localHas) {
        delete merged[key];
        return;
      }

      if (
        isMergeableObject(localValue) &&
        (
          isMergeableObject(baseValue) ||
          !baseHas
        )
      ) {
        merged[key] =
          mergeObjectChanges(
            baseValue,
            localValue,
            remoteValue
          );

        return;
      }

      merged[key] =
        structuredClone(localValue);
    });

    return merged;
  };

  return mergeObjectChanges(
    baseSettings,
    localSettings,
    remoteSettings
  );
}
function menuProductEntryMatches(first, second) {
  if (!first || !second) return first === second;
  return first.category === second.category
    && JSON.stringify(first.product) === JSON.stringify(second.product);
}

function mergeConcurrentMenuChanges(baseMenu, localMenu, remoteMenu) {
  const base = normalizeMenuCatalog(baseMenu);
  const local = normalizeMenuCatalog(localMenu);
  const remote = normalizeMenuCatalog(remoteMenu);
  const baseEntries = menuProductEntries(base);
  const localEntries = menuProductEntries(local);
  const remoteEntries = menuProductEntries(remote);

  const changedLocalIds = new Set();
  const deletedLocalIds = new Set();
  baseEntries.forEach((baseEntry, productId) => {
    const localEntry = localEntries.get(productId);
    if (!localEntry) deletedLocalIds.add(productId);
    else if (!menuProductEntryMatches(baseEntry, localEntry)) changedLocalIds.add(productId);
  });
  localEntries.forEach((_entry, productId) => {
    if (!baseEntries.has(productId)) changedLocalIds.add(productId);
  });

  const mergedEntries = new Map(remoteEntries);
  deletedLocalIds.forEach((productId) => mergedEntries.delete(productId));
  changedLocalIds.forEach((productId) => {
    const localEntry = localEntries.get(productId);
    if (localEntry) mergedEntries.set(productId, localEntry);
  });

  const merged = {};
  const categoryOrder = [...Object.keys(local), ...Object.keys(remote)]
    .filter((category, index, categories) => categories.indexOf(category) === index);
  categoryOrder.forEach((category) => {
    const products = Array.from(mergedEntries.values())
      .filter((entry) => entry.category === category)
      .sort((first, second) => first.index - second.index)
      .map((entry) => entry.product);
    const localAddedEmptyCategory = Object.hasOwn(local, category) && !Object.hasOwn(base, category);
    if (products.length || localAddedEmptyCategory) merged[category] = products;
  });
  return normalizeMenuCatalog(merged);
}

function pendingTicketCounter() {
  const value = Number.parseInt(localStorage.getItem(STORAGE_KEYS.ticketCounterPending) || "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function queueTicketCounter(value) {
  const number = Number.parseInt(value, 10);
  if (Number.isFinite(number) && number > 0 && shouldQueueForCloud()) {
    localStorage.setItem(STORAGE_KEYS.ticketCounterPending, String(number));
  }
}

function clearPendingTicketCounter(expectedValue = null) {
  if (expectedValue && pendingTicketCounter() !== expectedValue) return false;
  localStorage.removeItem(STORAGE_KEYS.ticketCounterPending);
  return true;
}

function setOrderSyncStatus(orderId, status) {
  savedOrders = savedOrders.map((order) => (order.id === orderId ? { ...order, syncStatus: status } : order));
  if (currentOrder.id === orderId) currentOrder.syncStatus = status;
  saveCurrentOrderDraft();
}

function confirmOrderSyncedIfUnchanged(orderId, expectedUpdatedAt) {
  const currentSavedOrder = savedOrders.find((order) => order.id === orderId);
  if (!currentSavedOrder || currentSavedOrder.updatedAt !== expectedUpdatedAt) return false;
  setOrderSyncStatus(orderId, "synced");
  return true;
}

function mergeOrders(cloudOrders, localOrders) {
  const ordersById = new Map();

  /*
   * Leemos los respaldos una sola vez por merge.
   *
   * No hacemos una lectura de localStorage
   * por cada pedido.
   */
  const backupState =
    readRevisionConflictBackups();

  const conflictBackups =
    backupState.ok &&
    Array.isArray(backupState.backups)
      ? backupState.backups
      : [];

  /*
   * Confirma que la versión local bloqueada
   * tiene un respaldo verificable antes de
   * permitir que una revisión remota superior
   * la sustituya.
   */
  const hasVerifiedConflictBackup = (
    order,
    remoteRevision
  ) => {
    if (!order?.id) {
      return false;
    }

    const localRevision =
      Number.parseInt(
        order._syncRevision,
        10
      );

    if (
      !Number.isFinite(localRevision) ||
      localRevision < 1 ||
      !Number.isFinite(remoteRevision) ||
      remoteRevision <= localRevision
    ) {
      return false;
    }

    return conflictBackups.some(
      (backup) => {
        if (
          String(backup?.orderId || "") !==
          String(order.id)
        ) {
          return false;
        }

        /*
         * El respaldo debe corresponder
         * exactamente a la edición local
         * que estamos a punto de sustituir.
         */
        if (
          String(
            backup?.localUpdatedAt || ""
          ) !==
          String(order.updatedAt || "")
        ) {
          return false;
        }

        const backupLocalRevision =
          Number.parseInt(
            backup?.localRevision,
            10
          );

        const backupRemoteRevision =
          Number.parseInt(
            backup?.remoteRevision,
            10
          );

        if (
          backupLocalRevision !==
          localRevision
        ) {
          return false;
        }

        /*
         * Supabase puede haber avanzado todavía
         * más desde que ocurrió el conflicto.
         *
         * Ejemplo:
         * respaldo detectó revisión 5
         * Supabase ahora está en revisión 7.
         *
         * Eso sigue siendo seguro porque
         * conservamos la misma edición local
         * original en el respaldo.
         */
        if (
          Number.isFinite(
            backupRemoteRevision
          ) &&
          backupRemoteRevision >
            remoteRevision
        ) {
          return false;
        }

        return true;
      }
    );
  };

  [
    ...(Array.isArray(cloudOrders)
      ? cloudOrders
      : []),

    ...(Array.isArray(localOrders)
      ? localOrders
      : []),
  ].forEach((order) => {
    if (!order?.id) {
      return;
    }

    const normalizedOrder =
      normalizeOrderNotes({
        ...order,
        type:
          normalizeOrderType(
            order.type
          ),
        businessDate:
          orderBusinessDate(
            order
          ),
      });

    const current =
      ordersById.get(
        normalizedOrder.id
      );

    /*
     * Primer pedido con ese ID.
     */
    if (!current) {
      ordersById.set(
        normalizedOrder.id,
        normalizedOrder
      );

      return;
    }

    /*
     * CASO ESPECIAL:
     *
     * La versión que llega ahora es una
     * edición local bloqueada por conflicto.
     *
     * Normalmente los pedidos de nube entraron
     * primero en el Map y los locales después.
     */
    if (
      isOrderRevisionSyncBlocked(
        normalizedOrder
      )
    ) {
      const localRevision =
        Number.parseInt(
          normalizedOrder._syncRevision,
          10
        );

      const remoteRevision =
        Number.parseInt(
          current._syncRevision,
          10
        );

      const remoteIsConfirmed =
        current.syncStatus ===
        "synced";

      const remoteIsNewer =
        Number.isFinite(
          localRevision
        ) &&
        localRevision > 0 &&
        Number.isFinite(
          remoteRevision
        ) &&
        remoteRevision >
          localRevision;

      const localBackupExists =
        remoteIsNewer &&
        hasVerifiedConflictBackup(
          normalizedOrder,
          remoteRevision
        );

      /*
       * ÚNICO caso donde dejamos ganar
       * a la nube sobre un pending local:
       *
       * 1. local está bloqueado por conflicto;
       * 2. nube está confirmada;
       * 3. revisión nube es superior;
       * 4. edición local tiene respaldo verificado.
       *
       * Si cualquiera falla:
       * conservamos la versión local bloqueada.
       */
      if (
        remoteIsConfirmed &&
        remoteIsNewer &&
        localBackupExists
      ) {
        console.info(
          "[RC ORDERA] Conflicto reconciliado durante merge: se conserva la revisión remota confirmada y la edición local permanece respaldada.",
          {
            orderId:
              normalizedOrder.id,
            localRevision,
            remoteRevision,
          }
        );

        /*
         * current ya contiene la versión remota.
         * No necesitamos escribir nada.
         */
        return;
      }

      /*
       * Sin respaldo o sin una revisión remota
       * inequívocamente superior:
       * NO descartamos la edición local.
       */
      ordersById.set(
        normalizedOrder.id,
        normalizedOrder
      );

      return;
    }

    /*
     * COMPORTAMIENTO ORIGINAL:
     *
     * Un pedido local pendiente normal
     * continúa teniendo prioridad.
     *
     * Esto protege el modo offline y evita
     * regresiones en pedidos todavía no
     * confirmados por Supabase.
     */
    if (
      needsCloudSync(
        normalizedOrder
      )
    ) {
      ordersById.set(
        normalizedOrder.id,
        normalizedOrder
      );

      return;
    }

    /*
     * Para pedidos sin cambios pendientes,
     * conservamos la versión más reciente.
     */
    const incomingUpdatedAt =
      new Date(
        normalizedOrder.updatedAt ||
        0
      ).getTime();

    const currentUpdatedAt =
      new Date(
        current.updatedAt ||
        0
      ).getTime();

    if (
      incomingUpdatedAt >
      currentUpdatedAt
    ) {
      ordersById.set(
        normalizedOrder.id,
        normalizedOrder
      );
    }
  });

  return Array.from(
    ordersById.values()
  ).sort(
    (a, b) =>
      new Date(
        b.createdAt || 0
      ) -
      new Date(
        a.createdAt || 0
      )
  );
}

function supabaseConfig() {
  const config = window.RC_ORDERA_SUPABASE || {};
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

function friendlyCloudError(error) {
  const code = String(error?.code || error?.status || "").trim();
  const message = String(error?.message || error?.error_description || "").toLowerCase();

  if (code === "42703" || message.includes("column") && message.includes("does not exist")) {
    return "La nube necesita una actualizacion antes de continuar. Contacta al soporte.";
  }
  if (code === "42P01" || code === "PGRST205" || message.includes("could not find the table")) {
    return "La nube necesita una actualizacion antes de continuar. Contacta al soporte.";
  }
  if (code === "42501" || code === "401" || code === "403" || message.includes("row-level security")) {
    return "No tienes autorizacion para completar esta operacion.";
  }
  if (message.includes("jwt") || message.includes("refresh token") || message.includes("session")) {
    return "La sesion de nube vencio. Cierra sesion y vuelve a ingresar.";
  }
  if (message.includes("fetch") || message.includes("network") || message.includes("internet")) {
    return "No fue posible conectar con la nube. Revisa internet e intenta nuevamente.";
  }
  if (message.includes("tiempo") || message.includes("timeout")) {
    return "La nube no respondio a tiempo. El pedido y los cambios siguen guardados localmente.";
  }
  return "No fue posible completar la carga de la nube. Los datos locales se conservaron.";
}

function setCloudError(error, options = {}) {
  const friendlyMessage = friendlyCloudError(error);

  const technicalDetails = [
    error?.code,
    error?.status,
    error?.message,
    error?.details,
    error?.hint,
    error?.cause?.message,
  ]
    .filter(Boolean)
    .join(" | ");

  if (options.moduleOnly) {
  cloudState.moduleWarning = friendlyMessage;
} else {
  cloudState.lastError = friendlyMessage;
  cloudState.lastErrorDetails = technicalDetails;
}
  updateCloudStatus(
    options.moduleOnly
      ? "Nube parcial"
      : "Revisar nube"
  );

  if (elements.cloudStatus) {
    elements.cloudStatus.title =
      technicalDetails
        ? `${friendlyMessage}\n${technicalDetails}`
        : friendlyMessage;
  }

  console.error(
    "[RC ORDERA CLOUD ERROR]",
    {
      friendlyMessage,
      technicalDetails,
      originalError: error,
    }
  );

  return friendlyMessage;
}
function clearCloudErrors() {
  cloudState.lastError = "";
  cloudState.lastErrorDetails = "";
  cloudState.moduleWarning = "";

  if (elements.cloudStatus) {
    elements.cloudStatus.title = "";
  }
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
    restaurantOperationalOpen,
    restaurantOperationalMode,
    openingHours: restaurantOpeningHours,
    restaurantLatitude,
    restaurantLongitude,
    legalBusinessName,
    taxId,
    businessPhone,
    businessEmail,
    legalAddress,
    restaurantCountryCode: restaurantRegistrationRegion.countryCode,
    restaurantCountry: restaurantRegistrationRegion.country,
    restaurantCity: restaurantRegistrationRegion.city,
    restaurantRegion: restaurantRegistrationRegion.region,
    restaurantPostalCode: restaurantRegistrationRegion.postalCode,
    restaurantTimezone: restaurantRegistrationRegion.timezone,
    restaurantPreferredLanguage: restaurantRegistrationRegion.preferredLanguage,
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
    operational_open: restaurantOperationalOpen,
    opening_hours: restaurantOpeningHours,
    latitude: restaurantLatitude,
    longitude: restaurantLongitude,
    country_code: restaurantRegistrationRegion.countryCode,
    city: restaurantRegistrationRegion.city,
    region: restaurantRegistrationRegion.region,
    postal_code: restaurantRegistrationRegion.postalCode,
    timezone: restaurantRegistrationRegion.timezone,
    preferred_language: restaurantRegistrationRegion.preferredLanguage,
    updated_at: new Date().toISOString(),
  };
}

function restaurantSignupProfileFromInputs(email = "") {
  return {
    businessName: normalizeBusinessName(elements.authRestaurantNameInput?.value || businessName),
    legalBusinessName: normalizeTextSetting(elements.authLegalNameInput?.value || ""),
    taxId: normalizeTextSetting(elements.authTaxIdInput?.value || ""),
    legalAddress: normalizeTextSetting(elements.authLegalAddressInput?.value || ""),
    countryCode: normalizeTextSetting(elements.authCountryCodeInput?.value || restaurantRegistrationRegion.countryCode).toUpperCase(),
    country:
      normalizeTextSetting(elements.authCountryCodeInput?.value || restaurantRegistrationRegion.countryCode).toUpperCase() === "PL"
        ? "Polonia"
        : normalizeTextSetting(elements.authCountryCodeInput?.value || restaurantRegistrationRegion.countryCode).toUpperCase() === "CO"
          ? "Colombia"
          : restaurantRegistrationRegion.country,
    city: normalizeTextSetting(elements.authCityInput?.value || restaurantRegistrationRegion.city),
    region: normalizeTextSetting(elements.authRegionInput?.value || restaurantRegistrationRegion.region),
    postalCode: normalizeTextSetting(elements.authPostalCodeInput?.value || restaurantRegistrationRegion.postalCode),
    businessPhone: normalizeTextSetting(elements.authBusinessPhoneInput?.value || ""),
    businessEmail: normalizeTextSetting(email || elements.authEmail?.value || ""),
    ownerName: normalizeTextSetting(elements.authOwnerNameInput?.value || ""),
    legalConsent: Boolean(elements.authLegalConsentInput?.checked),
    timezone: restaurantRegistrationRegion.timezone,
    preferredLanguage: restaurantRegistrationRegion.preferredLanguage,
    latitude: restaurantRegistrationRegion.latitude,
    longitude: restaurantRegistrationRegion.longitude,
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
    countryCode: profile.countryCode || metadata.country_code || "",
    country: profile.country || metadata.country || "",
    city: profile.city || metadata.city || "",
    region: profile.region || metadata.region || "",
    postalCode: profile.postalCode || metadata.postal_code || "",
    timezone: profile.timezone || metadata.timezone || "",
    preferredLanguage: profile.preferredLanguage || metadata.preferred_language || "es",
    latitude: Number.isFinite(Number(profile.latitude ?? metadata.registration_latitude))
      ? Number(profile.latitude ?? metadata.registration_latitude)
      : null,
    longitude: Number.isFinite(Number(profile.longitude ?? metadata.registration_longitude))
      ? Number(profile.longitude ?? metadata.registration_longitude)
      : null,
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
    country: normalizeTextSetting(profile.country || restaurantRegistrationRegion.country),
    city: normalizeTextSetting(profile.city || restaurantRegistrationRegion.city),
    country_code: normalizeTextSetting(profile.countryCode || restaurantRegistrationRegion.countryCode).toUpperCase(),
    region: normalizeTextSetting(profile.region || restaurantRegistrationRegion.region),
    postal_code: normalizeTextSetting(profile.postalCode || restaurantRegistrationRegion.postalCode),
    preferred_language: profile.preferredLanguage || restaurantRegistrationRegion.preferredLanguage || "es",
    registration_latitude: profile.latitude ?? restaurantRegistrationRegion.latitude,
    registration_longitude: profile.longitude ?? restaurantRegistrationRegion.longitude,
    detected_timezone: profile.timezone || restaurantRegistrationRegion.timezone,
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
    console.warn("No se pudo activar el rol de usuario en la nube.", error);
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
  restaurantRegistrationRegion = {
    ...restaurantRegistrationRegion,
    countryCode: profile.countryCode || restaurantRegistrationRegion.countryCode,
    country: profile.country || restaurantRegistrationRegion.country,
    city: profile.city || restaurantRegistrationRegion.city,
    region: profile.region || restaurantRegistrationRegion.region,
    postalCode: profile.postalCode || restaurantRegistrationRegion.postalCode,
    timezone: profile.timezone || restaurantRegistrationRegion.timezone,
    preferredLanguage: profile.preferredLanguage || restaurantRegistrationRegion.preferredLanguage,
    latitude: profile.latitude ?? restaurantRegistrationRegion.latitude,
    longitude: profile.longitude ?? restaurantRegistrationRegion.longitude,
  };

  localStorage.setItem(STORAGE_KEYS.businessName, businessName);
  localStorage.setItem(STORAGE_KEYS.legalBusinessName, legalBusinessName);
  localStorage.setItem(STORAGE_KEYS.taxId, taxId);
  localStorage.setItem(STORAGE_KEYS.legalAddress, legalAddress);
  localStorage.setItem(STORAGE_KEYS.restaurantAddress, restaurantAddress);
  localStorage.setItem(STORAGE_KEYS.businessPhone, businessPhone);
  localStorage.setItem(STORAGE_KEYS.businessEmail, businessEmail);
  applyBusinessNameToUi();
}

function applyPublicRestaurantProfileFallback(profile = {}, options = {}) {
  const onlyIfEmpty = Boolean(options.onlyIfEmpty);
  const assignText = (currentValue, nextValue) => {
    const cleanValue = normalizeTextSetting(nextValue);
    if (!cleanValue) return currentValue;
    if (onlyIfEmpty && normalizeTextSetting(currentValue)) return currentValue;
    return cleanValue;
  };
  const assignImage = (currentValue, nextValue) => {
    const cleanValue = normalizeProductImageUrl(nextValue);
    if (!cleanValue) return currentValue;
    if (onlyIfEmpty && normalizeProductImageUrl(currentValue)) return currentValue;
    return cleanValue;
  };

  const publicName = normalizeTextSetting(profile.business_name);
  if (publicName && (!onlyIfEmpty || !normalizeTextSetting(businessName) || businessName === DEFAULT_BUSINESS_NAME)) {
    businessName = normalizeBusinessName(publicName);
  }
  businessLogoUrl = assignImage(businessLogoUrl, profile.logo_url);
  restaurantAddress = assignText(restaurantAddress, profile.public_address);
  businessPhone = assignText(businessPhone, profile.phone);
  if (typeof profile.active === "boolean") restaurantActive = profile.active;
  if (typeof profile.operational_open === "boolean") restaurantOperationalOpen = profile.operational_open;
  if (profile.operational_mode !== undefined) {
    restaurantOperationalMode = normalizeRestaurantOperationalMode(profile.operational_mode);
  }
  if (profile.opening_hours && typeof profile.opening_hours === "object") {
    restaurantOpeningHours = normalizeOpeningHours(profile.opening_hours);
  }
  if (profile.latitude !== null && profile.latitude !== undefined) restaurantLatitude = normalizeCoordinate(profile.latitude);
  if (profile.longitude !== null && profile.longitude !== undefined) restaurantLongitude = normalizeCoordinate(profile.longitude);
  restaurantRegistrationRegion = {
    ...restaurantRegistrationRegion,
    countryCode: normalizeTextSetting(profile.country_code) || restaurantRegistrationRegion.countryCode,
    city: normalizeTextSetting(profile.city) || restaurantRegistrationRegion.city,
    region: normalizeTextSetting(profile.region) || restaurantRegistrationRegion.region,
    postalCode: normalizeTextSetting(profile.postal_code) || restaurantRegistrationRegion.postalCode,
    timezone: normalizeTextSetting(profile.timezone) || restaurantRegistrationRegion.timezone,
    preferredLanguage: normalizeTextSetting(profile.preferred_language) || restaurantRegistrationRegion.preferredLanguage,
  };

  localStorage.setItem(STORAGE_KEYS.businessName, businessName);
  localStorage.setItem(STORAGE_KEYS.businessLogoUrl, businessLogoUrl);
  localStorage.setItem(STORAGE_KEYS.restaurantAddress, restaurantAddress);
  localStorage.setItem(STORAGE_KEYS.businessPhone, businessPhone);
  localStorage.setItem(STORAGE_KEYS.restaurantActive, restaurantActive ? "1" : "0");
  localStorage.setItem(STORAGE_KEYS.restaurantOperationalOpen, restaurantOperationalOpen ? "1" : "0");
  localStorage.setItem(STORAGE_KEYS.restaurantOperationalMode, restaurantOperationalMode);
  localStorage.setItem(STORAGE_KEYS.restaurantOpeningHours, JSON.stringify(restaurantOpeningHours));
  storeCoordinate(STORAGE_KEYS.restaurantLatitude, restaurantLatitude);
  storeCoordinate(STORAGE_KEYS.restaurantLongitude, restaurantLongitude);
  applyBusinessNameToUi();
}

function preserveTextSetting(nextValue, currentValue, options = {}) {
  const cleanValue = normalizeTextSetting(nextValue);
  const cleanCurrent = normalizeTextSetting(currentValue);
  if (!cleanValue && options.preserveExisting !== false && cleanCurrent) return cleanCurrent;
  return cleanValue;
}

function preserveImageSetting(nextValue, currentValue, options = {}) {
  const cleanValue = normalizeProductImageUrl(nextValue);
  const cleanCurrent = normalizeProductImageUrl(currentValue);
  if (!cleanValue && options.preserveExisting !== false && cleanCurrent) return cleanCurrent;
  return cleanValue;
}

function readTextInputPreservingValue(input, currentValue, options = {}) {
  if (!input) return normalizeTextSetting(currentValue);
  return preserveTextSetting(input.value, currentValue, options);
}

function readImageInputPreservingValue(input, currentValue, options = {}) {
  if (!input) return normalizeProductImageUrl(currentValue);
  return preserveImageSetting(input.value, currentValue, options);
}

function localStoreCurrentSettings() {
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
  localStorage.setItem(STORAGE_KEYS.restaurantOperationalOpen, restaurantOperationalOpen ? "1" : "0");
  localStorage.setItem(STORAGE_KEYS.restaurantOperationalMode, restaurantOperationalMode);
  localStorage.setItem(STORAGE_KEYS.restaurantOpeningHours, JSON.stringify(restaurantOpeningHours));
  storeCoordinate(STORAGE_KEYS.restaurantLatitude, restaurantLatitude);
  storeCoordinate(STORAGE_KEYS.restaurantLongitude, restaurantLongitude);
}

function applySettingsPayload(settings = {}) {
  const cleanBusinessName = normalizeTextSetting(settings.businessName);
  if (cleanBusinessName) businessName = normalizeBusinessName(cleanBusinessName);
  businessLogoUrl = preserveImageSetting(settings.businessLogoUrl, businessLogoUrl);
  legalBusinessName = preserveTextSetting(settings.legalBusinessName, legalBusinessName);
  taxId = preserveTextSetting(settings.taxId, taxId);
  businessPhone = preserveTextSetting(settings.businessPhone, businessPhone);
  businessEmail = preserveTextSetting(settings.businessEmail, businessEmail);
  legalAddress = preserveTextSetting(settings.legalAddress, legalAddress);
  currencySymbol = settings.currencySymbol || currencySymbol || "$";
  currencyPosition = settings.currencyPosition ? (settings.currencyPosition === "after" ? "after" : "before") : currencyPosition;
  moneyFormat = settings.moneyFormat ? (settings.moneyFormat === "eu" ? "eu" : "us") : moneyFormat;
  receiptWidthMm = normalizeReceiptWidth(settings.receiptWidthMm ?? receiptWidthMm);
  deliveryFee = normalizeMoneyValue(settings.deliveryFee ?? deliveryFee);
  deliveryMinimumFee = normalizeDeliveryMinimumFee(settings.deliveryMinimumFee ?? deliveryMinimumFee);
  restaurantAddress = preserveTextSetting(settings.restaurantAddress, restaurantAddress);
  restaurantRegistrationRegion = {
    ...restaurantRegistrationRegion,
    countryCode: normalizeTextSetting(settings.restaurantCountryCode) || restaurantRegistrationRegion.countryCode,
    country: normalizeTextSetting(settings.restaurantCountry) || restaurantRegistrationRegion.country,
    city: normalizeTextSetting(settings.restaurantCity) || restaurantRegistrationRegion.city,
    region: normalizeTextSetting(settings.restaurantRegion) || restaurantRegistrationRegion.region,
    postalCode: normalizeTextSetting(settings.restaurantPostalCode) || restaurantRegistrationRegion.postalCode,
    timezone: normalizeTextSetting(settings.restaurantTimezone) || restaurantRegistrationRegion.timezone,
    preferredLanguage:
      normalizeTextSetting(settings.restaurantPreferredLanguage) || restaurantRegistrationRegion.preferredLanguage,
  };
  googleMapsApiKey = preserveTextSetting(settings.googleMapsApiKey, googleMapsApiKey);
  bankAccount = preserveTextSetting(settings.bankAccount, bankAccount);
  bankTransferNote = preserveTextSetting(settings.bankTransferNote, bankTransferNote);
  onlinePaymentProvider = normalizeOnlinePaymentProvider(settings.onlinePaymentProvider ?? onlinePaymentProvider);
  onlinePaymentNote = preserveTextSetting(settings.onlinePaymentNote, onlinePaymentNote);
  if (typeof settings.restaurantActive === "boolean") restaurantActive = settings.restaurantActive;
  if (typeof settings.restaurantOperationalOpen === "boolean") restaurantOperationalOpen = settings.restaurantOperationalOpen;
  if (settings.restaurantOperationalMode !== undefined) {
    restaurantOperationalMode = normalizeRestaurantOperationalMode(settings.restaurantOperationalMode);
  }
  if (settings.openingHours && typeof settings.openingHours === "object") {
    restaurantOpeningHours = normalizeOpeningHours(settings.openingHours);
  }
  if (settings.restaurantLatitude !== null && settings.restaurantLatitude !== undefined) {
    restaurantLatitude = normalizeCoordinate(settings.restaurantLatitude);
  }
  if (settings.restaurantLongitude !== null && settings.restaurantLongitude !== undefined) {
    restaurantLongitude = normalizeCoordinate(settings.restaurantLongitude);
  }
  localStoreCurrentSettings();
  applyBusinessNameToUi();
}

function updateCloudStatus(message = "") {
  if (!cloudState.configured) {
    elements.cloudStatus.textContent = "Modo local";
    elements.cloudStatus.title = "La conexion con la nube no esta configurada.";
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

  if (cloudState.lastError) {
  elements.cloudStatus.textContent = "Revisar nube";

  elements.cloudStatus.title =
    cloudState.lastErrorDetails
      ? `${cloudState.lastError}\n${cloudState.lastErrorDetails}`
      : cloudState.lastError;

  return;
}

  if (pending || hasPendingSettings() || hasPendingMenu() || pendingTicketCounter()) {
    elements.cloudStatus.textContent = pending ? `Pendiente nube (${pending})` : "Pendiente nube";
    const details = [];
    if (pendingOrdersCount()) details.push(`${pendingOrdersCount()} pedido(s)`);
    if (pendingDeletedOrdersCount()) details.push(`${pendingDeletedOrdersCount()} anulacion(es) antigua(s)`);
    if (hasPendingSettings()) details.push("ajustes");
    if (hasPendingMenu()) details.push("menu");
    if (pendingTicketCounter()) details.push("contador de tickets");
    elements.cloudStatus.title = `Pendiente de sincronizar: ${details.join(", ")}. Pulsa Actualizar.`;
    return;
  }

  if (cloudState.moduleWarning) {
    elements.cloudStatus.textContent = "Nube parcial";
    elements.cloudStatus.title = cloudState.moduleWarning;
    return;
  }

  elements.cloudStatus.title = "";
  elements.cloudStatus.textContent = cloudState.user ? "Sincronizado" : "Iniciar sesion";
}

function setAuthScreenVisible(visible) {
  elements.authScreen.hidden = !visible;
  document.body.classList.toggle("auth-mode", Boolean(visible));
}

function renderCloudState(message = "") {
  document.body.classList.toggle("auth-checking", !cloudState.authChecked);
  if (!cloudState.authChecked) return;

  if (!cloudState.configured) {
    setAuthScreenVisible(false);
    elements.openSignInButton.hidden = true;
    elements.signOutButton.hidden = true;
    elements.qrButton.hidden = true;
    if (elements.waiterTeamButton) elements.waiterTeamButton.hidden = true;
    elements.clientAlarmButton.hidden = true;
    elements.clientOrdersButton.hidden = true;
    stopClientAlarm();
    updateCloudStatus();
    return;
  }

  const canWorkOffline = !cloudState.user && hasKnownCloudSession() && !navigator.onLine;
  setAuthScreenVisible(cloudState.recoveringPassword ? true : !(Boolean(cloudState.user) || canWorkOffline));
  if ((cloudState.user || canWorkOffline) && elements.restaurantAuthDialog?.open) closeRestaurantAuthDialog();
  elements.openSignInButton.hidden = Boolean(cloudState.user) || cloudState.recoveringPassword;
  elements.signOutButton.hidden = !cloudState.user;
  elements.qrButton.hidden = false;
  if (elements.waiterTeamButton) elements.waiterTeamButton.hidden = !cloudState.user;
  elements.clientAlarmButton.hidden = !cloudState.user;
  elements.clientOrdersButton.hidden = false;
  updateClientOrdersBadge();
  updateClientAlarmButton();
  updateCloudStatus(canWorkOffline ? "" : message);
  if (elements.authMessage) elements.authMessage.textContent = message;
  renderRestaurantStatus();
  updateRestaurantStatusSync();
}

function setRestaurantAuthMode(mode = "login") {
  const normalizedMode = mode === "register" ? "register" : "login";
  elements.authForm.dataset.mode = normalizedMode;
  if (elements.restaurantAuthTitle) {
    const title = normalizedMode === "register" ? "Registrar restaurante" : "Iniciar sesion";
    elements.restaurantAuthTitle.textContent = window.rcUiText?.(title) || title;
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
  setAuthScreenVisible(true);
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
    let settled = false;
    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(Boolean(loaded));
    };
    const timeoutId = window.setTimeout(() => finish(false), 12000);
    const existingScript = document.querySelector("script[data-supabase-loader]");
    if (existingScript) {
      existingScript.addEventListener("load", () => finish(window.supabase?.createClient), { once: true });
      existingScript.addEventListener("error", () => finish(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "vendor/supabase-2.57.4.js";
    script.async = true;
    script.dataset.supabaseLoader = "true";
    script.addEventListener("load", () => finish(window.supabase?.createClient), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    document.head.appendChild(script);
  });
}

async function initializeCloud() {
  cloudState.configured = hasSupabaseConfig();
  if (!cloudState.configured) {
    cloudState.authChecked = true;
    renderCloudState();
    return;
  }

  if (!window.supabase?.createClient && !(await loadSupabaseLibrary())) {
    cloudState.authChecked = true;
    renderCloudState(hasKnownCloudSession() ? "" : "No se pudo cargar la nube. Revisa la conexion a internet.");
    return;
  }

  const config = supabaseConfig();
  cloudState.client = window.supabase.createClient(
  config.url,
  config.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "rc-ordera-restaurant-auth",
    },
  }
);
  if (
  typeof cloudState.client.removeAllChannels ===
  "function"
) {
  await cloudState.client
    .removeAllChannels()
    .catch((error) => {
      console.warn(
        "[RC ORDERA] No fue posible limpiar canales Realtime anteriores.",
        error
      );
    });
}
  const { data, error } = await withCloudTimeout(cloudState.client.auth.getSession());
  if (error) throw error;
  cloudState.user = data.session?.user || null;
  cloudState.authChecked = true;
  if (cloudState.user) rememberCloudSession(cloudState.user);
  renderCloudState();

cloudState.client.auth.onAuthStateChange((event, session) => {
  const previousUserId =
    cloudState.user?.id || null;

  const nextUser =
    session?.user || null;

  const nextUserId =
    nextUser?.id || null;

  const userActuallyChanged =
    Boolean(nextUserId) &&
    nextUserId !== previousUserId;

  cloudState.user = nextUser;
  if (previousUserId !== nextUserId) invalidateDatabaseContract();

  if (cloudState.user) {
    rememberCloudSession(cloudState.user);
  }

  if (event === "PASSWORD_RECOVERY") {
    showPasswordRecoveryForm();
    return;
  }

  if (event === "INITIAL_SESSION") {
    return;
  }

  renderCloudState();

  if (cloudState.user) {
    if (userActuallyChanged) {
      window.setTimeout(() => {
        loadCloudData().catch((error) => {
          console.error(
            "No fue posible cargar la nube despues del inicio de sesion.",
            error
          );

          setCloudError(error);
          renderCloudState();
        });
      }, 0);
    }

    return;
  }

  cloudState.schemaVersion = null;
  cloudState.schemaContractVersion = null;
  cloudState.releaseContractVersion = null;
  cloudState.schemaCompatible = false;

  pendingClientOrders = [];

  clearConfirmedCloudMenu();
  clearConfirmedCloudSettings();

  stopClientOrdersPolling();
  stopClientOrdersRealtime();
  stopCentralRealtime();
  stopClientAlarm();

  updateClientOrdersBadge();
});

  if (cloudState.user) {
    await loadCloudData();
    const paymentsReturn = new URLSearchParams(window.location.search).get("payments");
    if (paymentsReturn === "return" || paymentsReturn === "refresh") {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.delete("payments");
      window.history.replaceState(window.history.state, "", returnUrl.href);
      await refreshMarketplaceAccountState(paymentsReturn === "refresh" ? "onboarding" : "status");
    }
  }
}

async function loadCloudData() {
  if (!cloudState.client || !cloudState.user) return { ok: false, reason: "no-session" };
  if (cloudState.loading) return { ok: false, reason: "busy" };
  cloudState.loading = true;
  elements.cloudStatus.textContent = "Cargando nube...";
  const localOrdersBeforeLoad = savedOrders.map(structuredCloneOrder);
  const currentOrderBeforeLoad = normalizeCurrentOrderDraft(currentOrder);
  const localDeletedOrderIds = readDeletedOrderIds();
  const localPendingOrders = localOrdersBeforeLoad.filter(
  (order) =>
    needsCloudSync(order) &&
    !localDeletedOrderIds.includes(order.id)
);

let syncPendingAfterLoad = false;

/*
 * POS LOCAL-FIRST:
 * nunca esperamos a Supabase para mostrar
 * el menú y los pedidos que ya existen
 * en este dispositivo.
 */
renderCurrencySettings();
renderCategories();
renderMenu();
renderOrder();
renderHistory();

/*
 * ARRANQUE DE EMERGENCIA:
 * si esta tablet no tiene menu local,
 * recuperamos SOLO el menu de Supabase
 * antes de cargar pedidos, perfil o cualquier otra cosa.
 */
if (menuProductCount(menuCatalog) === 0) {
  try {
    const {
      data: startupSettingsRow,
      error: startupMenuError,
    } = await withCloudTimeout(
      cloudState.client
        .from("app_settings")
        .select("menu, menu_revision")
        .eq("user_id", cloudState.user.id)
        .maybeSingle(),
      "El menu tardo demasiado en cargar.",
      8000
    );

    if (startupMenuError) {
      throw startupMenuError;
    }

    const startupMenu =
      normalizeMenuCatalog(
        startupSettingsRow?.menu ||
        EMPTY_MENU_CATALOG
      );

    if (menuProductCount(startupMenu) > 0) {
      menuCatalog = startupMenu;

      activeCategory =
        Object.keys(menuCatalog)[0] || "";

      saveMenuCache({
        immediate: true,
      });

      storeConfirmedCloudMenu(
        menuCatalog
      );

      if (
        startupSettingsRow?.menu_revision !==
        undefined
      ) {
        storeCloudRevision(
          STORAGE_KEYS.menuRevision,
          startupSettingsRow.menu_revision
        );
      }

      renderCategories();
      renderMenu();
    }
  } catch (error) {
    console.error(
      "No fue posible recuperar el menu durante el arranque.",
      error
    );
  }
}


try {
    try {
  await withCloudTimeout((signal) => ensureMinimumDatabaseVersion(signal));
} catch (error) {
  if (
    ["RC_ORDERA_SCHEMA_OUTDATED", "RC_ORDERA_SCHEMA_INCOMPLETE"].includes(error?.code)
  ) {
    throw error;
  }

  console.warn(
    "No fue posible verificar temporalmente la version de la base de datos. Se intentara cargar el menu y los datos disponibles.",
    error
  );
}
    const settingsRequest = cloudState.client
      .from("app_settings")
      .select("menu, settings, menu_revision, settings_revision, menu_updated_at, settings_updated_at")
      .eq("user_id", cloudState.user.id)
      .maybeSingle();
    const profileRequest = cloudState.client
      .from("restaurant_profiles")
      .select("business_name, logo_url, public_address, phone, active, operational_open, operational_mode, opening_hours, latitude, longitude, country_code, city, region, postal_code, timezone, preferred_language, deleted_at")
      .eq("user_id", cloudState.user.id)
      .maybeSingle();
    const ownerRoleRequest = cloudState.client
      .from("user_roles")
      .select("status")
      .eq("user_id", cloudState.user.id)
      .eq("role", "restaurant_owner")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    const ordersRequest = cloudState.client
      .from("orders")
      .select("order_json, revision")
      .eq("user_id", cloudState.user.id)
      .order("created_at", { ascending: false })
      .limit(LOCAL_ORDER_CACHE_LIMIT);
    /*
 * EMERGENCIA POS:
 * cargamos primero el menú.
 * Los pedidos y demás datos nunca pueden impedir
 * que la caja muestre los productos.
 */
const settingsResponse = await withCloudTimeout(
  settingsRequest,
  "El menú tardó demasiado en responder.",
  8000
).catch((error) => ({
  data: null,
  error,
}));

const {
  data: settingsRow,
  error: settingsError,
} = settingsResponse;

if (
  !settingsError &&
  !hasPendingMenu() &&
  menuProductCount(settingsRow?.menu) > 0
) {
  const startupMenu =
    normalizeMenuCatalog(
      settingsRow.menu
    );

  menuCatalog = startupMenu;

  saveMenuCache({
    immediate: true,
  });

  storeConfirmedCloudMenu(
    startupMenu
  );

  if (
    settingsRow?.menu_revision !==
    undefined
  ) {
    storeCloudRevision(
      STORAGE_KEYS.menuRevision,
      settingsRow.menu_revision
    );
  }

  activeCategory =
    Object.keys(menuCatalog)[0] ||
    activeCategory;

  renderCategories();
  renderMenu();
}

/*
 * Después del menú intentamos cargar
 * lo demás. Si falla, el menú ya está visible.
 */
const [
  profileResponse,
  ownerRoleResponse,
  ordersResponse,
] = await Promise.all([
  withCloudTimeout(
    profileRequest,
    "El perfil del restaurante tardó demasiado en responder.",
    10000
  ).catch((error) => ({ data: null, error })),
  withCloudTimeout(
    ownerRoleRequest,
    "El rol del restaurante tardó demasiado en responder.",
    10000
  ).catch((error) => ({ data: null, error })),
  withCloudTimeout(
    ordersRequest,
    "Los pedidos tardaron demasiado en responder.",
    10000
  ).catch((error) => ({ data: null, error })),
]);

const {
  data: publicProfileRow,
  error: publicProfileError,
} = profileResponse;

const {
  data: ownerRole,
  error: ownerRoleError,
} = ownerRoleResponse;

const {
  data: cloudOrders,
  error: ordersError,
} = ordersResponse;
    const temporaryLoadSyncError = [
      settingsError,
      publicProfileError,
      ownerRoleError,
      ordersError,
    ]
      .find((error) => error && isTemporarySyncInfrastructureError(error));
    if (temporaryLoadSyncError) {
      pendingDataSyncRetryNotBefore = Date.now() + SYNC_INFRASTRUCTURE_BACKOFF_MS;
    }

  if (settingsError) {
  console.warn(
    "No fue posible cargar app_settings desde la nube. Se intentara conservar el ultimo menu valido disponible.",
    settingsError
  );

  const confirmedMenu =
    readConfirmedCloudMenu();

  if (
    menuProductCount(menuCatalog) === 0 &&
    confirmedMenu &&
    menuProductCount(confirmedMenu) > 0
  ) {
    menuCatalog = confirmedMenu;

    saveMenuCache({
      immediate: true,
    });
  }

  renderCategories();
  renderMenu();
}

if (ordersError) {
  console.warn(
    "No fue posible cargar los pedidos desde la nube. El menu continuara cargando.",
    ordersError
  );
}

  const restaurantProfile =
  restaurantProfileFromUserMetadata();

if (publicProfileError) {
  console.warn(
    "No se pudo leer el estado publico del restaurante.",
    publicProfileError
  );
}

if (ownerRoleError) {
  console.warn(
    "No se pudo comprobar el rol del restaurante.",
    ownerRoleError
  );
}

const accountType = normalizeTextSetting(
  cloudState.user?.user_metadata?.account_type
).toLowerCase();

if (
  !publicProfileError &&
  !ownerRoleError &&
  !settingsRow &&
  !publicProfileRow &&
  !ownerRole &&
  accountType !== "restaurant"
) {
  const accessMessage =
    "Esta cuenta no tiene un restaurante registrado. Entra desde Cliente o completa el registro de restaurante.";

  elements.authMessage.textContent =
    accessMessage;

  await cloudState.client.auth.signOut();

  return {
    ok: false,
    reason: "not-restaurant",
    message: accessMessage,
  };
}

if (
  hasRestaurantOwnerRegistration(
    restaurantProfile,
    settingsRow
  )
) {
  await ensureRestaurantOwnerIdentity(
    restaurantProfile
  );
}

/*
 * Importante:
 * comprobar el pendiente DESPUES de las esperas anteriores.
 * Así protegemos cambios hechos mientras cargaba la nube.
 */
const localSettingsPending =
  hasPendingSettings();

if (
  !localSettingsPending &&
  typeof publicProfileRow?.active === "boolean"
) {
  restaurantActive =
    publicProfileRow.active;

  localStorage.setItem(
    STORAGE_KEYS.restaurantActive,
    restaurantActive ? "1" : "0"
  );
}

let localMenuPending =
  hasPendingMenu();

if (!settingsError) {

const remoteMenu =
  normalizeMenuCatalog(
    settingsRow?.menu ||
      EMPTY_MENU_CATALOG
  );

const legacyPendingCouldContainMenu =
  localSettingsPending &&
  !hasPendingMenu();

if (
  legacyPendingCouldContainMenu &&
  !menuCatalogsMatch(
    menuCatalog,
    remoteMenu
  ) &&
  menuProductCount(menuCatalog) > 0
) {
  markMenuPending();
}

const confirmedMenuBeforeLoad =
  readConfirmedCloudMenu();

const remoteMenuRevision =
  Number.parseInt(
    settingsRow?.menu_revision,
    10
  );

const remoteMenuHasNewerRevision =
  Number.isFinite(remoteMenuRevision) &&
  remoteMenuRevision >
    storedCloudRevision(
      STORAGE_KEYS.menuRevision
    );

const protectLocalMenuFromEmptyCloud =
  !localMenuPending &&
  menuProductCount(menuCatalog) > 0 &&
  menuProductCount(remoteMenu) === 0 &&
  (
    confirmedMenuBeforeLoad === null ||
    menuProductCount(confirmedMenuBeforeLoad) > 0
  ) &&
  !(
    confirmedMenuBeforeLoad !== null &&
    remoteMenuHasNewerRevision
  );

if (protectLocalMenuFromEmptyCloud) {
  markMenuPending();
  localMenuPending = hasPendingMenu();
  saveMenuCache({ immediate: true });
}

if (
  localMenuPending &&
  menuProductCount(menuCatalog) === 0 &&
  menuProductCount(remoteMenu) > 0
) {
  menuCatalog = remoteMenu;

  saveMenuCache();
  clearMenuPending();

  localMenuPending = false;

  showToast(
    "El menu valido de la nube fue protegido. No se reemplazo por un menu local vacio."
  );
} else if (!localMenuPending) {
  menuCatalog = remoteMenu;

  saveMenuCache();
  storeConfirmedCloudMenu(
    remoteMenu
  );
}

if (
  !localMenuPending &&
  menuHasInlineRestaurantImages(
    remoteMenu
  )
) {
  menuCatalog = remoteMenu;
  markMenuPending();
  localMenuPending = true;
}

if (
  settingsRow?.menu_revision !==
    undefined &&
  !localMenuPending
) {
  storeCloudRevision(
    STORAGE_KEYS.menuRevision,
    settingsRow.menu_revision
  );
}
renderCategories();
renderMenu();
if (
  settingsRow?.settings_revision !==
    undefined &&
  !localSettingsPending
) {
  storeCloudRevision(
    STORAGE_KEYS.settingsRevision,
    settingsRow.settings_revision
  );
}

if (
  settingsRow &&
  !localSettingsPending
) {
  applySettingsPayload(
    settingsRow.settings || {}
  );

  storeConfirmedCloudSettings(
    settingsRow.settings || {}
  );
}
}

/*
 * Si existen ajustes locales pendientes,
 * no permitimos que perfiles antiguos de nube
 * sobrescriban estado, horarios ni apertura local.
 */
if (!localSettingsPending) {
  applyRestaurantProfile(
    restaurantProfile,
    {
      onlyIfEmpty:
        Boolean(!settingsError && settingsRow),
    }
  );

  applyPublicRestaurantProfileFallback(
    publicProfileRow || {},
    {
      onlyIfEmpty: true,
    }
  );
}

if (!settingsError) {
if (
  !settingsRow ||
  localSettingsPending
) {
  const settingsTokenToClear =
    currentSettingsPendingToken();

  await saveCloudSettings();

  if (settingsTokenToClear) {
    clearSettingsPending(
      settingsTokenToClear
    );
  }
}

if (
  localMenuPending ||
  (
    !settingsRow &&
    menuProductCount(menuCatalog) > 0
  )
) {
  const menuTokenToClear =
    currentMenuPendingToken();

  await saveCloudMenu();

  if (menuTokenToClear) {
    clearMenuPending(
      menuTokenToClear
    );
  }
}
}

if (!ordersError) {
    const normalizedCloudOrders = (cloudOrders || [])
      .map((row) => ({
  ...row.order_json,
  type: normalizeOrderType(row.order_json?.type),
  businessDate: orderBusinessDate(row.order_json),
  _syncRevision: Number.parseInt(row.revision, 10) || null,
  syncStatus: "synced",
}))
      .filter((order) => !localDeletedOrderIds.includes(order.id));
    savedOrders = mergeOrders(normalizedCloudOrders, localPendingOrders);
    saveOrders();
}

    try {
  await refreshRestaurantBusinessContext({ force: true });
} catch (error) {
  console.warn(
    "No fue posible actualizar el contexto del restaurante. Se conservara la fecha local y el menu ya cargado.",
    error
  );
}

todayKey =
  restaurantBusinessContext?.businessDate ||
  currentBusinessDate();
    const { data: counterRow, error: counterError } = await cloudState.client
      .from("ticket_counters")
      .select("next_ticket")
      .eq("user_id", cloudState.user.id)
      .eq("business_date", todayKey)
      .maybeSingle();

  if (counterError) {
  console.warn(
    "No fue posible cargar el contador de tickets desde la nube. Se conservara el contador local y el menu ya cargado.",
    counterError
  );
}

nextTicket =
  pendingTicketCounter() ||
  counterRow?.next_ticket ||
  nextTicket ||
  1;
    saveTicketState();

/*
 * RECONCILIACION SEGURA DEL PEDIDO ABIERTO.
 *
 * Regla:
 * - borradores nuevos se conservan;
 * - pendientes normales se conservan;
 * - solo un revision_conflict ya reconciliado
 *   en savedOrders puede adoptar la version remota;
 * - la version local debe tener respaldo verificable.
 */
const orderBeforeCurrentReconciliation =
  currentOrderHasContent(currentOrderBeforeLoad)
    ? currentOrderBeforeLoad
    : createBlankOrder();

let reconciledCurrentOrder =
  orderBeforeCurrentReconciliation;

if (
  orderBeforeCurrentReconciliation?.saved &&
  orderBeforeCurrentReconciliation?.id &&
  isOrderRevisionSyncBlocked(
    orderBeforeCurrentReconciliation
  )
) {
  const reconciledSavedOrder =
    savedOrders.find(
      (savedOrder) =>
        String(savedOrder?.id || "") ===
        String(
          orderBeforeCurrentReconciliation.id
        )
    ) || null;

  const localRevision =
    Number.parseInt(
      orderBeforeCurrentReconciliation._syncRevision,
      10
    );

  const reconciledRevision =
    Number.parseInt(
      reconciledSavedOrder?._syncRevision,
      10
    );

  const backupState =
    readRevisionConflictBackups();

  const hasMatchingConflictBackup =
    backupState.ok &&
    Array.isArray(backupState.backups) &&
    backupState.backups.some(
      (backup) => {
        if (
          String(backup?.orderId || "") !==
          String(
            orderBeforeCurrentReconciliation.id
          )
        ) {
          return false;
        }

        if (
          String(
            backup?.localUpdatedAt || ""
          ) !==
          String(
            orderBeforeCurrentReconciliation.updatedAt ||
              ""
          )
        ) {
          return false;
        }

        const backupLocalRevision =
          Number.parseInt(
            backup?.localRevision,
            10
          );

        const backupRemoteRevision =
          Number.parseInt(
            backup?.remoteRevision,
            10
          );

        if (
          backupLocalRevision !==
          localRevision
        ) {
          return false;
        }

        if (
          Number.isFinite(
            backupRemoteRevision
          ) &&
          Number.isFinite(
            reconciledRevision
          ) &&
          backupRemoteRevision >
            reconciledRevision
        ) {
          return false;
        }

        return true;
      }
    );

  const canAdoptReconciledOrder =
    Boolean(
      reconciledSavedOrder &&
      reconciledSavedOrder.syncStatus ===
        "synced" &&
      !isOrderRevisionSyncBlocked(
        reconciledSavedOrder
      ) &&
      Number.isFinite(localRevision) &&
      localRevision > 0 &&
      Number.isFinite(
        reconciledRevision
      ) &&
      reconciledRevision >
        localRevision &&
      hasMatchingConflictBackup
    );

  if (canAdoptReconciledOrder) {
    reconciledCurrentOrder =
      normalizeCurrentOrderDraft(
        structuredCloneOrder(
          reconciledSavedOrder
        )
      );

    console.info(
      "[RC ORDERA] Pedido abierto reconciliado con la revision remota confirmada.",
      {
        orderId:
          reconciledCurrentOrder.id,
        localRevision,
        remoteRevision:
          reconciledRevision,
      }
    );
  }
}

currentOrder =
  reconciledCurrentOrder;
    renderCurrencySettings();
    renderCategories();
    renderMenu();
    renderOrder();
    renderHistory();
cloudState.ready = true;
clearCloudErrors();
const partialLoadError = [
  settingsError,
  publicProfileError,
  ownerRoleError,
  ordersError,
].find(Boolean);

if (partialLoadError) {
  setCloudError(partialLoadError, {
    moduleOnly: true,
  });
}
  
syncPendingAfterLoad =
  hasPendingDataToSync();
try {
  await withCloudTimeout(
    (signal) => refreshClientOrders({ silent: true, signal }),
    "Los pedidos de clientes tardaron demasiado en actualizarse.",
    8000
  );
    } catch (moduleError) {
      console.warn("El modulo de pedidos de clientes necesita revision.", moduleError);
      setCloudError(moduleError, { moduleOnly: true });
    }
startCentralRealtime();
startClientOrdersRealtime();
updateRestaurantStatusSync();
    if (restaurantOperationalMode === "schedule") {
  await withCloudTimeout(
    syncRestaurantOperationalStatus({ silent: true }),
    "El estado del restaurante tardó demasiado en actualizarse.",
    8000
  ).catch((error) => {
    console.warn(
      "No se pudo actualizar el estado operativo durante la carga.",
      error
    );
  });
}
    updateCloudStatus();
    maybeAskShiftServer();
    return { ok: true, warning: cloudState.moduleWarning };
  } catch (error) {
    console.error(error);
    const friendlyMessage = navigator.onLine ? setCloudError(error) : "Sin internet. Los datos locales siguen disponibles.";
    elements.authMessage.textContent = friendlyMessage;
  renderCurrencySettings();
renderCategories();
renderMenu();
renderOrder();
renderHistory();
    return { ok: false, error, message: friendlyMessage };
  } finally {
  cloudState.loading = false;
  updateCloudStatus();

  /*
   * Solo DESPUES de liberar la carga inicial
   * intentamos enviar lo pendiente.
   *
   * Si Supabase esta lento, la caja sigue funcionando.
   */
  if (
    syncPendingAfterLoad &&
    cloudState.client &&
    cloudState.user &&
    navigator.onLine
  ) {
  schedulePendingDataSyncRetry(
  Math.max(
    500,
    pendingDataSyncRetryNotBefore -
      Date.now()
  )
);
  }
}
}

function closureReportRange(periodType, periodValue) {
  const clean = String(periodValue || "").trim();
  let start;
  let end;
  if (periodType === "day" && /^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    start = new Date(`${clean}T00:00:00.000Z`);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (periodType === "month" && /^\d{4}-\d{2}$/.test(clean)) {
    start = new Date(`${clean}-01T00:00:00.000Z`);
    end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else if (periodType === "year" && /^\d{4}$/.test(clean)) {
    start = new Date(`${clean}-01-01T00:00:00.000Z`);
    end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    throw new Error("Periodo de cierre no valido.");
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function loadCloudOrdersForReport(periodType, periodValue) {
  const cacheKey = closureReportCacheKey(periodType, periodValue);
  cloudClosureReports.delete(cacheKey);
  if (!cloudState.client || !cloudState.user || !navigator.onLine) {
    throw new Error("Se necesita conexion para obtener el cierre completo.");
  }
  const client = cloudState.client;
  const userId = cloudState.user.id;
  closureReportRange(periodType, periodValue);
  await withCloudTimeout((signal) => ensureMinimumDatabaseVersion(signal));
  if (client !== cloudState.client || userId !== cloudState.user?.id) throw new Error("La sesion cambio durante el cierre.");
  const { data, error } = await withCloudTimeout((signal) => client.rpc("get_restaurant_closure_report", {
    p_period_type: periodType,
    p_period_value: String(periodValue || ""),
  }).abortSignal(signal));
  if (error) throw error;
  if (client !== cloudState.client || userId !== cloudState.user?.id) throw new Error("La sesion cambio durante el cierre.");
  const report = Array.isArray(data) ? data[0] : data;
  if (!report || typeof report !== "object" || report.periodType !== periodType
      || report.periodValue !== String(periodValue) || !Number.isFinite(Number(report.tickets))
      || Number(report.tickets) < 0 || !Number.isFinite(Number(report.total))) {
    throw new Error("La nube no devolvio un cierre valido.");
  }
  cloudClosureReports.set(cacheKey, report);
  return Number(report.tickets) || 0;
}

async function prepareCloudPeriodClosure(periodType, periodValue) {
  const client = cloudState.client;
  const userId = cloudState.user?.id;
  if (!client || !userId || !navigator.onLine) throw new Error("Se necesita conexion para obtener el cierre completo.");
  await syncPendingData({ silent: true, allowWhileLoading: true });
  if (client !== cloudState.client || userId !== cloudState.user?.id) throw new Error("La sesion cambio durante el cierre.");
  if (pendingOrdersCount() || pendingDeletedOrdersCount()) throw new Error("Hay pedidos pendientes de sincronizar. No se puede confirmar un cierre incompleto.");
  await loadCloudOrdersForReport(periodType, periodValue);
}

function currentRestaurantRpcProfilePayload() {
  const profile = currentRestaurantPublicProfilePayload();
  return {
    businessName: profile.business_name,
    logoUrl: profile.logo_url,
    publicAddress: profile.public_address,
    phone: profile.phone,
    description: profile.description,
    active: profile.active,
    operationalOpen: profile.operational_open,
    operationalMode: restaurantOperationalMode,
    openingHours: profile.opening_hours,
    latitude: profile.latitude,
    longitude: profile.longitude,
    countryCode: profile.country_code,
    city: profile.city,
    region: profile.region,
    postalCode: profile.postal_code,
    timezone: profile.timezone,
    preferredLanguage: profile.preferred_language,
  };
}

async function readCurrentCloudSettingsRow() {
  const response = await cloudState.client
    .from("app_settings")
    .select("menu, settings, menu_revision, settings_revision")
    .eq("user_id", cloudState.user.id)
    .maybeSingle();
  if (response.error) throw response.error;
  return response.data || null;
}

async function saveCloudSettings() {
  if (!cloudState.client || !cloudState.user) {
    return null;
  }

  if (
    isInlineRestaurantImage(businessLogoUrl) &&
    navigator.onLine
  ) {
    businessLogoUrl = await uploadRestaurantImageDataUrl(
      businessLogoUrl,
      "profile",
      "logo"
    );

    localStorage.setItem(
      STORAGE_KEYS.businessLogoUrl,
      businessLogoUrl
    );

    if (elements.businessLogoUrlInput) {
      elements.businessLogoUrlInput.value =
        businessLogoUrl;
    }

    applyBusinessNameToUi();
  }

  let payload = currentSettingsPayload();
  let profile = currentRestaurantRpcProfilePayload();

  let expectedRevision =
    storedCloudRevision(
      STORAGE_KEYS.settingsRevision
    ) || null;

  let {
    data: rpcData,
    error: rpcError,
  } = await cloudState.client.rpc(
    "save_current_restaurant_settings",
    {
      p_settings: payload,
      p_profile: profile,
      p_expected_revision: expectedRevision,
    }
  );

  if (
    rpcError &&
    /SETTINGS_REVISION_CONFLICT/i.test(
      String(
        rpcError?.message ||
        rpcError?.details ||
        ""
      )
    )
  ) {
    const latestRow =
      await readCurrentCloudSettingsRow();

    if (!latestRow?.settings) {
      throw rpcError;
    }

    const baseSettings =
      readConfirmedCloudSettings();

    if (!baseSettings) {
      const conflictError = new Error(
        appUiText("No existe una versión base confirmada para combinar los ajustes de forma segura.")
      );

      conflictError.code =
        "SETTINGS_SAFE_MERGE_REQUIRED";

      throw conflictError;
    }

    payload =
      mergeConcurrentSettingsChanges(
        baseSettings,
        payload,
        latestRow.settings
      );

    applySettingsPayload(payload);

    profile =
      currentRestaurantRpcProfilePayload();

    expectedRevision =
      Number(
        latestRow.settings_revision
      ) || null;

    const retry =
      await cloudState.client.rpc(
        "save_current_restaurant_settings",
        {
          p_settings: payload,
          p_profile: profile,
          p_expected_revision:
            expectedRevision,
        }
      );

    rpcData = retry.data;
    rpcError = retry.error;
  }

  if (!rpcError) {
    const confirmed =
      Array.isArray(rpcData)
        ? rpcData[0]
        : rpcData;

    if (
      !confirmed?.settings ||
      !confirmed?.profile
    ) {
      throw new Error(
        "La nube no devolvio la confirmacion completa de los ajustes."
      );
    }

    applySettingsPayload(
      confirmed.settings
    );

    applyPublicRestaurantProfileFallback(
      confirmed.profile
    );

    const confirmedRevision =
      confirmed.settingsRevision ??
      confirmed.settings_revision;

    storeCloudRevision(
      STORAGE_KEYS.settingsRevision,
      confirmedRevision
    );

    storeConfirmedCloudSettings(
      confirmed.settings
    );

    return confirmed;
  }

  if (isMissingRestaurantRpc(rpcError)) {
    const schemaError = new Error(
      appUiText(
        "La base de datos necesita la migracion V91 antes de guardar ajustes."
      )
    );

    schemaError.code =
      "RC_ORDERA_SCHEMA_OUTDATED";

    throw schemaError;
  }

  throw rpcError;
}

function isMenuRevisionConflict(error) {
  return /MENU_REVISION_CONFLICT/i.test(String(error?.message || error?.details || ""));
}

async function verifyPublicMenuProjection(expectedMenu, expectedRevision = null) {
  const { data, error } = await cloudState.client
    .from("restaurant_public_catalogs")
    .select("menu, menu_revision")
    .eq("restaurant_user_id", cloudState.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const projectionError = new Error(appUiText("No se pudo confirmar la publicacion del menu. Intenta nuevamente."));
    projectionError.code = "PUBLIC_MENU_PROJECTION_MISSING";
    throw projectionError;
  }
  if (!menuCatalogsMatch(data.menu, expectedMenu)) {
    const projectionError = new Error(appUiText("El menu se guardo, pero no quedo disponible para los clientes."));
    projectionError.code = "PUBLIC_MENU_PROJECTION_MISMATCH";
    throw projectionError;
  }
  const revision = Number.parseInt(expectedRevision, 10);
  const publicRevision = Number.parseInt(data.menu_revision, 10);
  if (Number.isFinite(revision) && revision > 0 && publicRevision !== revision) {
    const projectionError = new Error(appUiText("La version del menu para clientes no coincide con la version guardada."));
    projectionError.code = "PUBLIC_MENU_REVISION_MISMATCH";
    throw projectionError;
  }
  return data;
}

async function confirmSavedCloudMenu(confirmed, fallbackMenu) {
  const confirmedMenu = normalizeMenuCatalog(confirmed?.menu || fallbackMenu || EMPTY_MENU_CATALOG);
  if (!confirmed?.menu && !fallbackMenu) throw new Error("La nube no confirmo el menu guardado.");
  const revision = confirmed?.menuRevision ?? confirmed?.menu_revision;
  menuCatalog = confirmedMenu;
  saveMenuCache();
  storeCloudRevision(STORAGE_KEYS.menuRevision, revision);
  storeConfirmedCloudMenu(menuCatalog);
  queueMicrotask(() => {
    verifyPublicMenuProjection(menuCatalog, revision).catch((error) => {
      console.error("No fue posible confirmar el catalogo publico en segundo plano.", error);
      markMenuPending();
      updateCloudStatus("Menu pendiente de verificacion");
      showToast(appUiText("El menu se guardo, pero la publicacion para clientes necesita reintento."));
    });
  });
  return { ...(confirmed || {}), menu: menuCatalog, menuRevision: revision };
}

async function saveCloudMenu() {
  if (!cloudState.client || !cloudState.user) return null;
  const nextMenu = await materializeMenuImagesForCloud(menuCatalog);
  if (!menuCatalogsMatch(menuCatalog, nextMenu)) {
    menuCatalog = nextMenu;
    saveMenuCache();
    renderMenu();
    if (elements.menuEditorDialog?.open) renderMenuEditor();
  }
  let { data: rpcData, error: rpcError } = await cloudState.client.rpc("save_current_restaurant_menu", {
    p_menu: nextMenu,
    p_expected_revision: storedCloudRevision(STORAGE_KEYS.menuRevision) || null,
  });
  if (rpcError && isMenuRevisionConflict(rpcError)) {
    const baseMenu = readConfirmedCloudMenu();
    if (!baseMenu) {
      const conflictError = new Error(appUiText("El menu cambio en otro equipo. Actualiza la nube y vuelve a editar para conservar ambos cambios."));
      conflictError.code = "MENU_CONFLICT_REQUIRES_REFRESH";
      throw conflictError;
    }
    const currentRow = await readCurrentCloudSettingsRow();
    const remoteMenu = normalizeMenuCatalog(currentRow?.menu || EMPTY_MENU_CATALOG);
    const mergedMenu = mergeConcurrentMenuChanges(baseMenu, nextMenu, remoteMenu);
    const remoteRevision = currentRow?.menu_revision;
    menuCatalog = mergedMenu;
    saveMenuCache();
    storeCloudRevision(STORAGE_KEYS.menuRevision, remoteRevision);
    if (menuCatalogsMatch(mergedMenu, remoteMenu)) {
      return confirmSavedCloudMenu({ menu: remoteMenu, menu_revision: remoteRevision }, remoteMenu);
    }
    ({ data: rpcData, error: rpcError } = await cloudState.client.rpc("save_current_restaurant_menu", {
      p_menu: mergedMenu,
      p_expected_revision: remoteRevision ?? null,
    }));
  }
  if (!rpcError) {
    const confirmed = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return confirmSavedCloudMenu(confirmed);
  }
  if (isMissingRestaurantRpc(rpcError)) {
    const schemaError = new Error(appUiText("La base de datos necesita la migracion V91 antes de guardar el menu."));
    schemaError.code = "RC_ORDERA_SCHEMA_OUTDATED";
    throw schemaError;
  }
  throw rpcError;
}

async function saveRestaurantPublicProfile() {
  if (!cloudState.client || !cloudState.user) return;

  let payload = currentRestaurantPublicProfilePayload();
  try {
    const { data: currentProfile, error: currentProfileError } = await cloudState.client
      .from("restaurant_profiles")
      .select("business_name, logo_url, public_address, phone, description, active, operational_open, operational_mode, opening_hours, latitude, longitude, country_code, city, region, postal_code, timezone, preferred_language")
      .eq("user_id", cloudState.user.id)
      .maybeSingle();
    if (!currentProfileError && currentProfile) {
      const currentPublicName = normalizeTextSetting(currentProfile.business_name);
      const nextPublicName = normalizeTextSetting(payload.business_name);
      payload = {
        ...payload,
        business_name:
          nextPublicName && !(nextPublicName === DEFAULT_BUSINESS_NAME && currentPublicName && currentPublicName !== DEFAULT_BUSINESS_NAME)
            ? normalizeBusinessName(nextPublicName)
            : normalizeBusinessName(currentPublicName || nextPublicName),
        logo_url: preserveImageSetting(payload.logo_url, currentProfile.logo_url),
        public_address: preserveTextSetting(payload.public_address, currentProfile.public_address),
        phone: preserveTextSetting(payload.phone, currentProfile.phone),
        description: preserveTextSetting(payload.description, currentProfile.description, { preserveExisting: true }),
        active: typeof payload.active === "boolean" ? payload.active : currentProfile.active !== false,
        operational_open:
          typeof payload.operational_open === "boolean" ? payload.operational_open : currentProfile.operational_open === true,
        opening_hours: payload.opening_hours || currentProfile.opening_hours || normalizeOpeningHours(),
        latitude: payload.latitude ?? currentProfile.latitude ?? null,
        longitude: payload.longitude ?? currentProfile.longitude ?? null,
        country_code: preserveTextSetting(payload.country_code, currentProfile.country_code),
        city: preserveTextSetting(payload.city, currentProfile.city),
        region: preserveTextSetting(payload.region, currentProfile.region),
        postal_code: preserveTextSetting(payload.postal_code, currentProfile.postal_code),
        timezone: preserveTextSetting(payload.timezone, currentProfile.timezone),
        preferred_language: preserveTextSetting(payload.preferred_language, currentProfile.preferred_language),
      };
    }
  } catch (error) {
    console.warn("No se pudo leer el perfil publico actual antes de guardar.", error);
  }

  const { data, error } = await cloudState.client
    .from("restaurant_profiles")
    .upsert(payload)
    .select("user_id, business_name, logo_url, public_address, phone, description, active, operational_open, operational_mode, opening_hours, latitude, longitude, country_code, city, region, postal_code, timezone, preferred_language, updated_at")
    .single();

  if (error) {
    throw error;
  }
  if (!data || data.user_id !== cloudState.user.id || data.active !== payload.active) {
    throw new Error("La nube no confirmo el estado del restaurante.");
  }
  return data;
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

function isMissingRestaurantRpc(error) {
  const code = String(error?.code || error?.status || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST202" || code === "42883" || message.includes("could not find the function");
}

async function verifyRestaurantActiveInCloud(expectedActive) {
  const { data, error } = await cloudState.client
    .from("restaurant_profiles")
    .select("user_id, active, updated_at")
    .eq("user_id", cloudState.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.active !== Boolean(expectedActive)) {
    throw new Error("La nube no confirmo el cambio de estado del restaurante.");
  }
  return data;
}

async function persistRestaurantActiveInCloud(nextActive) {
  const expectedActive = Boolean(nextActive);
  const { error: rpcError } = await cloudState.client.rpc("set_current_restaurant_active", {
    p_active: expectedActive,
  });

  if (rpcError && !isMissingRestaurantRpc(rpcError)) throw rpcError;

  if (rpcError) {
    const changedAt = new Date().toISOString();
    const { data: updatedProfile, error: updateError } = await cloudState.client
      .from("restaurant_profiles")
      .update({ active: expectedActive, updated_at: changedAt })
      .eq("user_id", cloudState.user.id)
      .select("user_id")
      .maybeSingle();
    if (updateError) throw updateError;

    if (!updatedProfile) {
      const payload = {
        ...currentRestaurantPublicProfilePayload(),
        active: expectedActive,
        updated_at: changedAt,
      };
      const { error: insertError } = await cloudState.client
        .from("restaurant_profiles")
        .insert(payload);
      if (insertError) throw insertError;
    }
  }

  return verifyRestaurantActiveInCloud(expectedActive);
}

async function persistRestaurantDeletionRequestInCloud() {
  const { error: rpcError } = await cloudState.client.rpc("request_current_restaurant_deletion");
  if (!rpcError) {
    await verifyRestaurantActiveInCloud(false);
    return { requestRecorded: true };
  }
  if (!isMissingRestaurantRpc(rpcError)) throw rpcError;

  await persistRestaurantActiveInCloud(false);
  const { error: requestError } = await cloudState.client.from("account_privacy_requests").insert({
    user_id: cloudState.user.id,
    request_type: "restaurant_deletion",
    role_context: "restaurant_owner",
    status: "requested",
    details: {
      businessName,
      requestedAt: new Date().toISOString(),
    },
  });
  if (requestError) {
    console.warn("El restaurante se desactivo, pero la solicitud administrativa quedo pendiente.", requestError);
    return { requestRecorded: false };
  }
  return { requestRecorded: true };
}

async function verifyRestaurantOperationalOpenInCloud(expectedOpen, expectedMode = null) {
  const { data, error } = await cloudState.client
    .from("restaurant_profiles")
    .select("user_id, operational_open, operational_mode, updated_at")
    .eq("user_id", cloudState.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.operational_open !== Boolean(expectedOpen)) {
    throw new Error("La nube no confirmo el estado operativo del restaurante.");
  }
  if (expectedMode && normalizeRestaurantOperationalMode(data.operational_mode) !== expectedMode) {
    throw new Error("La nube no confirmo el modo operativo del restaurante.");
  }
  return data;
}

async function persistRestaurantOperationalOpenInCloud(nextOpen) {
  const expectedOpen = Boolean(nextOpen);
  const { error } = await cloudState.client.rpc("set_current_restaurant_operational_open", {
    p_open: expectedOpen,
  });
  if (error) throw error;
  return verifyRestaurantOperationalOpenInCloud(expectedOpen, "manual");
}

function setRestaurantStatusControlsDisabled(disabled) {
  const automatic = restaurantOperationalMode === "schedule";
  if (elements.closeRestaurantButton) elements.closeRestaurantButton.disabled = disabled || automatic || !restaurantActive;
  if (elements.mainRestaurantToggleButton) {
    elements.mainRestaurantToggleButton.disabled = disabled || automatic || !restaurantActive || !cloudState.user;
  }
  if (elements.restaurantScheduleModeInput) {
    elements.restaurantScheduleModeInput.disabled = disabled || !restaurantActive || !cloudState.user;
  }
}

async function persistRestaurantOperationalModeInCloud(nextMode) {
  const expectedMode = normalizeRestaurantOperationalMode(nextMode);
  const { data, error } = await cloudState.client.rpc("set_current_restaurant_operational_mode", {
    p_mode: expectedMode,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || normalizeRestaurantOperationalMode(result.operational_mode) !== expectedMode) {
    throw new Error("La nube no confirmo el modo operativo del restaurante.");
  }
  return verifyRestaurantOperationalOpenInCloud(result.operational_open === true, expectedMode);
}

async function syncRestaurantOperationalStatus(options = {}) {
  const { silent = false } = options;
  if (
    restaurantStatusSyncing ||
    restaurantOperationalMode !== "schedule" ||
    !cloudState.client ||
    !cloudState.user ||
    !navigator.onLine
  ) return null;

  restaurantStatusSyncing = true;
  if (!silent && elements.mainRestaurantStatusDetail) {
    elements.mainRestaurantStatusDetail.textContent = "Comprobando el horario en la nube...";
  }
  try {
    const { data, error } = await cloudState.client.rpc("sync_current_restaurant_operational_status");
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || normalizeRestaurantOperationalMode(result.operational_mode) !== "schedule") {
      throw new Error("La nube no devolvio el estado automatico esperado.");
    }
    restaurantOperationalOpen = result.operational_open === true;
    localStoreCurrentSettings();
    renderRestaurantStatus();
    return result;
  } catch (error) {
    if (!silent) {
      console.error(error);
      showToast("No se pudo comprobar el horario en la nube. Se conserva el ultimo estado confirmado.");
    }
    return null;
  } finally {
    restaurantStatusSyncing = false;
  }
}

function stopRestaurantStatusSync() {
  if (restaurantStatusSyncTimer) window.clearInterval(restaurantStatusSyncTimer);
  restaurantStatusSyncTimer = null;
}

function updateRestaurantStatusSync() {
  const shouldSync = Boolean(
    cloudState.user && restaurantActive && restaurantOperationalMode === "schedule" && navigator.onLine
  );
  if (!shouldSync) {
    stopRestaurantStatusSync();
    return;
  }
  if (!restaurantStatusSyncTimer) {
    restaurantStatusSyncTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") syncRestaurantOperationalStatus({ silent: true });
    }, 60000);
  }
}

async function setRestaurantOperationalMode(nextMode) {
  if (!cloudState.client || !cloudState.user) {
    showToast("Inicia sesion para cambiar el control de atencion.");
    renderRestaurantStatus();
    return false;
  }

  const expectedMode = normalizeRestaurantOperationalMode(nextMode);
  if (expectedMode === restaurantOperationalMode) return true;
  const message = expectedMode === "schedule"
    ? "Activar la apertura automatica segun el horario guardado?"
    : "Volver al control manual? El restaurante conservara por ahora su ultimo estado confirmado.";
  if (!confirm(message)) {
    renderRestaurantStatus();
    return false;
  }

  const previousMode = restaurantOperationalMode;
  const previousOpen = restaurantOperationalOpen;
  setRestaurantStatusControlsDisabled(true);
  try {
    const confirmed = await persistRestaurantOperationalModeInCloud(expectedMode);
    restaurantOperationalMode = expectedMode;
    restaurantOperationalOpen = confirmed.operational_open === true;
    localStoreCurrentSettings();
    renderRestaurantStatus();
    updateRestaurantStatusSync();
    showToast(
      expectedMode === "schedule"
        ? "Horario automatico activado y confirmado en la nube."
        : "Control manual activado y confirmado en la nube."
    );
    return true;
  } catch (error) {
    console.error(error);
    restaurantOperationalMode = previousMode;
    restaurantOperationalOpen = previousOpen;
    localStoreCurrentSettings();
    renderRestaurantStatus();
    alert("No se pudo confirmar el modo de atencion. Contacta al soporte e intenta nuevamente.");
    return false;
  } finally {
    setRestaurantStatusControlsDisabled(false);
  }
}

async function setRestaurantOperationalOpen(nextOpen) {
  if (!cloudState.client || !cloudState.user) {
    showToast("Inicia sesion para cambiar el estado del restaurante.");
    return;
  }

  const message = nextOpen
    ? "Abrir la atencion y permitir nuevos pedidos de clientes?"
    : "Cerrar la atencion? El menu seguira visible, pero el cliente no podra enviar pedidos nuevos.";
  if (!confirm(message)) return;

  const previousMode = restaurantOperationalMode;
  const previousOpen = restaurantOperationalOpen;
  setRestaurantStatusControlsDisabled(true);
  if (elements.restaurantStatusText) elements.restaurantStatusText.textContent = "Actualizando estado en la nube...";
  try {
    await persistRestaurantOperationalOpenInCloud(nextOpen);
    restaurantOperationalMode = "manual";
    restaurantOperationalOpen = Boolean(nextOpen);
    localStoreCurrentSettings();
    renderRestaurantStatus();
    showToast(restaurantOperationalOpen ? "Atencion abierta y sincronizada con clientes." : "Atencion cerrada y sincronizada con clientes.");
  } catch (error) {
    console.error(error);
    restaurantOperationalMode = previousMode;
    restaurantOperationalOpen = previousOpen;
    localStoreCurrentSettings();
    renderRestaurantStatus();
    alert("No se pudo confirmar el cambio. La atencion conserva su estado anterior.");
  } finally {
    setRestaurantStatusControlsDisabled(false);
  }
}

async function toggleRestaurantOperationalOpen() {
  await setRestaurantOperationalOpen(!restaurantOperationalOpen);
}

function setRestaurantDeletionMessage(message = "", type = "") {
  if (!elements.restaurantDeletionMessage) return;
  elements.restaurantDeletionMessage.textContent = message;
  elements.restaurantDeletionMessage.dataset.type = type;
  elements.restaurantDeletionMessage.hidden = !message;
}

function requestRestaurantDeletion() {
  if (!cloudState.client || !cloudState.user) {
    showToast("Inicia sesion para eliminar la cuenta.");
    return;
  }
  if (elements.restaurantDeletionPasswordInput) elements.restaurantDeletionPasswordInput.value = "";
  if (elements.restaurantDeletionConfirmationInput) elements.restaurantDeletionConfirmationInput.value = "";
  setRestaurantDeletionMessage("");
  elements.restaurantDeletionDialog?.showModal();
  window.setTimeout(() => elements.restaurantDeletionPasswordInput?.focus(), 50);
}

function clearRestaurantLocalData() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

async function confirmRestaurantDeletion() {
  const password = elements.restaurantDeletionPasswordInput?.value || "";
  const confirmation = normalizeTextSetting(elements.restaurantDeletionConfirmationInput?.value).toUpperCase();
  if (!password) {
    setRestaurantDeletionMessage("Escribe la contrasena actual.", "error");
    elements.restaurantDeletionPasswordInput?.focus();
    return;
  }
  if (confirmation !== "ELIMINAR") {
    setRestaurantDeletionMessage("Escribe ELIMINAR para confirmar.", "error");
    elements.restaurantDeletionConfirmationInput?.focus();
    return;
  }

  elements.confirmRestaurantDeletionButton.disabled = true;
  elements.cancelRestaurantDeletionButton.disabled = true;
  setRestaurantDeletionMessage("Verificando identidad y eliminando la cuenta...", "");
  try {
    const email = normalizeTextSetting(cloudState.user?.email);
    const { error: authError } = await cloudState.client.auth.signInWithPassword({ email, password });
    if (authError) throw new Error("La contrasena no es correcta. La cuenta no fue eliminada.");

    const { data, error } = await cloudState.client.functions.invoke("delete-own-restaurant-account", {
      body: { confirmation: "ELIMINAR" },
    });
    if (error) throw error;
    if (!data?.deleted) throw new Error(data?.message || "La nube no confirmo la eliminacion.");

    clearRestaurantLocalData();
    try {
      await cloudState.client.auth.signOut({ scope: "local" });
    } catch {
      // La cuenta ya fue eliminada en el servidor; se limpia el navegador igualmente.
    }
    elements.restaurantDeletionDialog?.close();
    alert("El restaurante fue cerrado, retirado del directorio y sus accesos fueron revocados. Los pedidos y pagos historicos se conservaron de forma segura.");
    window.location.replace(`index.html?app=${APP_VERSION}`);
  } catch (error) {
    console.error(error);
    const rawMessage = String(error?.message || "");
    const message = /failed to send|function|404/i.test(rawMessage)
      ? "No se aplicaron cambios parciales. El servicio de eliminacion no esta disponible; contacta al soporte e intenta nuevamente."
      : /La contrasena no es correcta|La nube no confirmo la eliminacion/i.test(rawMessage)
        ? rawMessage
        : "No se pudo confirmar la eliminacion. La cuenta sigue intacta.";
    setRestaurantDeletionMessage(message, "error");
  } finally {
    elements.confirmRestaurantDeletionButton.disabled = false;
    elements.cancelRestaurantDeletionButton.disabled = false;
  }
}

async function claimCloudTicket(signal = null) {
  if (!cloudState.client || !cloudState.user) return null;

  await refreshRestaurantBusinessContext({ force: true, signal });

  const { data, error } = await withCloudTimeout(cloudState.client.rpc("claim_next_ticket", {
    p_business_date: todayKey,
  }), undefined, 20000, signal);

  if (error) throw error;
  return data;
}

async function setCloudNextTicket(number, signal = null) {
  if (!cloudState.client || !cloudState.user) return;

  const { error } = await withCloudTimeout(cloudState.client.rpc("set_next_ticket", {
    p_business_date: todayKey,
    p_next_ticket: number,
  }), undefined, 20000, signal);

  if (error) throw error;

}

const cloudOrderSaveInFlight = new Map();
let cloudOrderSaveQueue = Promise.resolve();

async function saveCloudOrder(order, signal = null) {
  const orderId =
    `${cloudState.user?.id || ""}:${order?.id || ""}`;
  const edition = String(order?.updatedAt || "");
  const client = cloudState.client;
  const userId = cloudState.user?.id;
  const unconfirmed = () => Object.assign(
    new Error("La nube no confirmo completamente el pedido. Permanecera pendiente."),
    { code: "RC_ORDERA_ORDER_NOT_CONFIRMED" }
  );

  if (
    orderId &&
    cloudOrderSaveInFlight.has(orderId)
  ) {
    const active = cloudOrderSaveInFlight.get(orderId);
    if (active.edition !== edition) throw unconfirmed();
    await active.operation;
    if (String(order.updatedAt || "") !== edition) throw unconfirmed();
    return;
  }

  const operation =
    cloudOrderSaveQueue
      .catch(() => {})
      .then(() => {
        if (signal?.aborted) {
          throw signal.reason || Object.assign(new Error("Solicitud cancelada."), { name: "AbortError" });
        }
        if (client !== cloudState.client || userId !== cloudState.user?.id) throw unconfirmed();
        return saveCloudOrderInternal(order, signal);
      });

  if (orderId) {
    cloudOrderSaveInFlight.set(
      orderId,
      { operation, edition }
    );
  }

  cloudOrderSaveQueue =
    operation.catch(() => {});

  try {
    return await operation;
  } finally {
    if (
      orderId &&
      cloudOrderSaveInFlight.get(orderId)?.operation ===
        operation
    ) {
      cloudOrderSaveInFlight.delete(
        orderId
      );
    }
  }
}
async function saveCloudOrderInternal(
  order,
  signal = null
) {
  if (
    !cloudState.client ||
    !cloudState.user ||
    !order.saved
  ) {
    return;
  }
  const requestClient = cloudState.client;
  const requestUserId = cloudState.user.id;

  /*
   * PROTECCIÓN CENTRAL CONTRA CONFLICTOS DE REVISIÓN.
   *
   * Un pedido cuya revisión local quedó obsoleta
   * NO puede volver a llamar al RPC hasta que exista
   * una reconciliación real con Supabase.
   *
   * Esto protege todas las rutas:
   * - Guardar
   * - Imprimir
   * - PDF
   * - Cambio de estado de pago
   * - Cola automática
   */
  if (isOrderRevisionSyncBlocked(order)) {
    const blockedError = new Error(
      appUiText(
        "Este pedido cambió en otro dispositivo y requiere reconciliación antes de volver a sincronizarse."
      )
    );

    blockedError.code =
      "ORDER_REVISION_CONFLICT";

    const remoteRevision =
      Number.parseInt(
        order._syncRemoteRevision,
        10
      );
const localRevision =
  Number.parseInt(
    order._syncRevision,
    10
  );

/*
 * Si el usuario modificó nuevamente un pedido
 * que ya estaba bloqueado, updatedAt cambia.
 *
 * Antes de rechazar otro intento de sincronización
 * protegemos exactamente esa nueva edición local.
 *
 * No hacemos RPC, fetch, timer ni reintento.
 */
const backupState =
  readRevisionConflictBackups();

const currentEditionAlreadyBackedUp =
  backupState.ok &&
  Array.isArray(backupState.backups) &&
  backupState.backups.some(
    (backup) =>
      String(backup?.orderId || "") ===
        String(order.id) &&
      String(backup?.localUpdatedAt || "") ===
        String(order.updatedAt || "") &&
      Number.parseInt(
        backup?.localRevision,
        10
      ) === localRevision &&
      Number.parseInt(
        backup?.remoteRevision,
        10
      ) === remoteRevision
  );

if (!currentEditionAlreadyBackedUp) {
  const currentEditionBackupSaved =
    saveRevisionConflictBackup(
      order,
      remoteRevision
    );

  if (!currentEditionBackupSaved) {
    console.error(
      "[RC ORDERA] No fue posible respaldar la edición local actual del pedido bloqueado.",
      {
        orderId: order.id,
        localRevision:
          Number.isFinite(localRevision)
            ? localRevision
            : null,
        remoteRevision:
          Number.isFinite(remoteRevision)
            ? remoteRevision
            : null,
        localUpdatedAt:
          order.updatedAt || null,
      }
    );
  }
}
    blockedError.remoteRevision =
      Number.isFinite(remoteRevision)
        ? remoteRevision
        : null;

    console.warn(
      "[RC ORDERA] RPC bloqueado: pedido con conflicto de revisión.",
      {
        orderId: order.id,
        localRevision:
          order._syncRevision || null,
        remoteRevision:
          blockedError.remoteRevision,
      }
    );

    throw blockedError;
  }

  const applyConfirmedCloudState = (result = {}) => {
  if (requestClient !== cloudState.client || requestUserId !== cloudState.user?.id) {
    throw Object.assign(new Error("La sesion cambio durante la sincronizacion."), { name: "AbortError" });
  }
  const parsedRevision = Number.parseInt(
    result?.revision,
    10
  );

  const customerOrderId =
    result?.customer_order_id ||
    result?.customerOrderId ||
    null;

  const patch = {};
   patch._syncBlockedReason = null;
patch._syncBlockedAt = null;
patch._syncRemoteRevision = null;

  if (
    Number.isFinite(parsedRevision) &&
    parsedRevision > 0
  ) {
    patch._syncRevision = parsedRevision;
  }

  if (customerOrderId) {
    patch.customerOrderId = customerOrderId;
  }

  if (!Object.keys(patch).length) {
    return;
  }

  Object.assign(order, patch);

  savedOrders = savedOrders.map(
    (savedOrder) =>
      savedOrder.id === order.id
        ? {
            ...savedOrder,
            ...patch,
          }
        : savedOrder
  );

  if (currentOrder.id === order.id) {
    Object.assign(
      currentOrder,
      patch
    );
  }

  saveOrders({
    immediate: true,
  });

  saveCurrentOrderDraft();
};
  const saveOrderRow = async () => {
    const orderForCloud = structuredCloneOrder(order);
    orderForCloud.syncStatus = "synced";

    const parsedRevision = Number.parseInt(
  order._syncRevision,
  10
);

const expectedRevision =
  Number.isFinite(parsedRevision) && parsedRevision > 0
    ? parsedRevision
    : null;
const rpcRequest =
  cloudState.client.rpc(
    "save_and_publish_restaurant_order_atomic",
    {
      p_id: order.id,
      p_ticket_number:
        order.ticketNumber,
      p_business_date:
        orderBusinessDate(order),
      p_order_json:
        orderForCloud,
      p_total:
        orderTotal(order),
      p_created_at:
        order.createdAt || null,
      p_customer_order_id:
        order.customerOrderId || null,
      p_expected_revision:
        expectedRevision,
    }
  );

const { data, error } =
  await (
    signal &&
    typeof rpcRequest.abortSignal ===
      "function"
      ? rpcRequest.abortSignal(signal)
      : rpcRequest
  );
if (!error) {
  const result =
    Array.isArray(data)
      ? data[0]
      : data;

  const confirmedOrderId =
    result?.order_id ||
    result?.orderId ||
    null;

  const confirmedRevision =
    Number.parseInt(
      result?.revision,
      10
    );

  const confirmedCustomerOrderId =
    result?.customer_order_id ||
    result?.customerOrderId ||
    null;

  /*
   * Un RPC sin error pero sin confirmación completa
   * no demuestra que el pedido se haya guardado
   * y publicado correctamente en las estaciones.
   */
  if (
    String(confirmedOrderId || "") !==
      String(order.id) ||
    !Number.isFinite(confirmedRevision) ||
    confirmedRevision < 1 ||
    !confirmedCustomerOrderId
  ) {
    const confirmationError =
      new Error(
        appUiText(
          "La nube no confirmo completamente el pedido. Permanecera pendiente."
        )
      );

    confirmationError.code =
      "RC_ORDERA_ORDER_NOT_CONFIRMED";

    return {
      data,
      error: confirmationError,
    };
  }

  applyConfirmedCloudState(result);
  if (order.updatedAt !== orderForCloud.updatedAt) {
    throw Object.assign(
      new Error("La nube no confirmo completamente el pedido. Permanecera pendiente."),
      { code: "RC_ORDERA_ORDER_NOT_CONFIRMED" }
    );
  }
}

return { data, error };
  };

  let { error } = await saveOrderRow();

  const ticketCollision = error?.code === "23505"
    && /ticket|order_ticket_reservations|already assigned/i.test(String(error.message || ""));

  if (ticketCollision) {
    const offlineTicketNumber = Number(order.ticketNumber) || null;
    await refreshRestaurantBusinessContext({ force: true, signal });

    order.offlineTicketNumber = order.offlineTicketNumber || offlineTicketNumber;
    order.ticketNumber = await claimCloudTicket(signal);
    order.businessDate = todayKey;
    order.updatedAt = new Date().toISOString();

    ({ error } = await saveOrderRow());

    if (!error) {
      nextTicket = Math.max(nextTicket, Number(order.ticketNumber) + 1);
      showToast(
        `El ticket local ${formatTicket(offlineTicketNumber)} se sincronizo como ${formatTicket(order.ticketNumber)}.`
      );
    }
  }

  if (error) {
        if (isCancelledOrderOverwriteError(error)) {
      const cancellationPatch = {
        status: "cancelled",
        canonicalStatus: "cancelled",
        syncStatus: "synced",
      };

      Object.assign(order, cancellationPatch);

      savedOrders = savedOrders.map((savedOrder) =>
        savedOrder.id === order.id
          ? { ...savedOrder, ...cancellationPatch }
          : savedOrder
      );

      if (currentOrder.id === order.id) {
        Object.assign(currentOrder, cancellationPatch);
      }

      saveOrders({ immediate: true });
      saveCurrentOrderDraft();
      return;
    }
    if (
  error.code === "40001" ||
  /ORDER_REVISION_(?:CONFLICT|REQUIRED)/i.test(
    String(error.message || "")
  )
) {
  /*
   * Antes de declarar un conflicto real comprobamos
   * si el servidor ya contiene exactamente la misma
   * edición local.
   *
   * Esto cubre el caso:
   *
   * servidor guarda correctamente
   * -> respuesta se pierde / timeout
   * -> navegador conserva revision anterior
   * -> siguiente intento recibe conflicto.
   */

  let remoteRevision = null;

try {
  const [
    remoteOrderResponse,
    remoteCustomerOrderResponse,
  ] = await withCloudTimeout(
      [
        cloudState.client
          .from("orders")
          .select(
            "order_json, revision, updated_at"
          )
          .eq(
            "id",
            order.id
          )
          .eq(
            "user_id",
            cloudState.user.id
          )
          .maybeSingle(),

        cloudState.client
          .from("customer_orders")
          .select("id")
          .eq(
            "user_id",
            cloudState.user.id
          )
          .eq(
            "restaurant_order_id",
            order.id
          )
          .limit(1)
          .maybeSingle(),
      ],
      "No fue posible verificar el pedido en nube a tiempo.",
      8000,
      signal
    );

    if (remoteOrderResponse.error) {
      throw remoteOrderResponse.error;
    }

    const remoteRow =
      remoteOrderResponse.data;
remoteRevision =
  Number.parseInt(
    remoteRow?.revision,
    10
  );
/*
 * Si no recibimos una fila completa, no existe
 * evidencia suficiente para declarar un conflicto.
 * El pedido debe permanecer pendiente.
 */
if (
  !remoteRow ||
  !Number.isFinite(remoteRevision) ||
  remoteRevision < 1
) {
  const unconfirmedReconciliationError =
    new Error(
      appUiText(
        "La nube no devolvio una confirmacion valida. El pedido permanecera pendiente."
      )
    );

  unconfirmedReconciliationError.code =
    "RC_ORDERA_RECONCILIATION_NOT_CONFIRMED";

  throw unconfirmedReconciliationError;
}
    const localUpdatedAt =
      String(
        order.updatedAt ||
        ""
      );

    const remoteUpdatedAt =
      String(
        remoteRow?.order_json?.updatedAt ||
        ""
      );

    /*
     * Si updatedAt coincide, es la misma edición que
     * esta tablet intentó enviar anteriormente.
     *
     * Por tanto NO es un conflicto real.
     * Simplemente se perdió la confirmación.
     */
    if (
  localUpdatedAt &&
  remoteUpdatedAt === localUpdatedAt
) {
  /*
   * La fila principal existe, pero también debemos
   * confirmar que el pedido fue publicado para
   * caja y estaciones.
   */
  if (remoteCustomerOrderResponse.error) {
    throw remoteCustomerOrderResponse.error;
  }

  const recoveredCustomerOrderId =
    remoteCustomerOrderResponse
      ?.data?.id ||
    null;

  if (recoveredCustomerOrderId) {
    applyConfirmedCloudState({
      revision:
        remoteRow.revision,

      customer_order_id:
        recoveredCustomerOrderId,
    });

    console.info(
      "[RC ORDERA] Pedido recuperado después de una confirmación perdida.",
      {
        orderId: order.id,
        revision: remoteRow.revision,
        customerOrderId:
          recoveredCustomerOrderId,
      }
    );

    return;
  }

  /*
   * La edición llegó a orders, pero no encontramos
   * su publicación en customer_orders.
   *
   * Actualizamos únicamente la revisión confirmada
   * y repetimos una sola vez la operación atómica.
   */
  applyConfirmedCloudState({
    revision:
      remoteRow.revision,
  });

  const publicationRetry =
    await saveOrderRow();

  if (publicationRetry.error) {
    throw publicationRetry.error;
  }

  console.info(
    "[RC ORDERA] Pedido republicado correctamente en las estaciones.",
    {
      orderId: order.id,
      revision: remoteRow.revision,
    }
  );

  return;
}
  } catch (reconciliationError) {
  console.warn(
    "[RC ORDERA] No fue posible reconciliar automáticamente el conflicto.",
    reconciliationError
  );

  /*
   * Si no pudimos consultar Supabase con certeza,
   * NO podemos afirmar que exista un conflicto real.
   *
   * Propagamos el error original para que
   * runPendingDataSync() lo clasifique correctamente
   * como red, timeout, infraestructura, etc.
   */
  throw reconciliationError;
}

  /*
   * Si updatedAt es diferente, entonces sí existe
   * una modificación verdadera de otro dispositivo.
   * No sobrescribimos nada.
   */
      const conflictBackupSaved =
  saveRevisionConflictBackup(
    order,
    remoteRevision
  );

if (!conflictBackupSaved) {
  console.error(
    "[RC ORDERA] No fue posible respaldar el pedido antes de bloquear el conflicto de revisión.",
    {
      orderId: order.id,
      localRevision:
        Number.parseInt(
          order._syncRevision,
          10
        ) || null,
      remoteRevision,
    }
  );
}
blockOrderRevisionSync(
  order,
  remoteRevision
);

const conflictError =
  new Error(
    appUiText(
      "Este pedido cambio en otro dispositivo. Actualiza la nube antes de volver a modificarlo."
    )
  );

conflictError.code =
  "ORDER_REVISION_CONFLICT";

conflictError.cause =
  error;

throw conflictError;
    }
    throw error;
  }
}
async function voidCloudOrder(orderId, reason = "Cancelado por el restaurante") {
  if (!cloudState.client || !cloudState.user || !orderId) return;
  const { error } = await cloudState.client.rpc("void_restaurant_order", {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) throw error;
}

async function advanceCloudTicketCounter(minimumNextTicket, signal = null) {
  if (!cloudState.client || !cloudState.user || !Number.isFinite(minimumNextTicket)) return;

  const { data, error } = await withCloudTimeout(cloudState.client
    .from("ticket_counters")
    .select("next_ticket")
    .eq("user_id", cloudState.user.id)
    .eq("business_date", todayKey)
    .maybeSingle(), undefined, 20000, signal);

  if (error) throw error;
  if (!data || data.next_ticket < minimumNextTicket) {
    await setCloudNextTicket(minimumNextTicket, signal);
  }
}

function canUseCustomerModule() {
  return Boolean(cloudState.configured && cloudState.client && cloudState.user);
}

function pendingClientOrdersCount() {
  return pendingClientOrders.filter((order) => order.status === "pending").length;
}

function renderRestaurantDashboard() {
  if (!elements.restaurantDashboardSummary) return;
  const localToday = todaysOrders();
  const pending = pendingClientOrders.filter((order) => order.status === "pending").length;
  const preparing = pendingClientOrders.filter((order) => order.status === "accepted").length;
  const ready = pendingClientOrders.filter((order) => order.status === "sent").length;
  const sales = localToday.reduce((sum, order) => sum + orderTotal(order), 0);
  const received = localToday.length + pending;

  elements.restaurantDashboardDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  elements.restaurantMetricReceived.textContent = String(received);
  elements.restaurantMetricPending.textContent = String(pending);
  elements.restaurantMetricPreparing.textContent = String(preparing);
  elements.restaurantMetricReady.textContent = String(ready);
  elements.restaurantMetricSales.textContent = formatMoney(sales);
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

  const hasPending =
    pendingClientOrdersCount() > 0;

  /*
   * La alarma del restaurante permanece
   * obligatoriamente activa.
   */
  elements.clientAlarmButton.textContent =
    hasPending
      ? "🔔 Alarma activa · pedido pendiente"
      : "🔔 Alarma activa";

  elements.clientAlarmButton.classList.add(
    "alarm-active"
  );

  elements.clientAlarmButton.classList.toggle(
    "alarm-pending",
    hasPending
  );

  elements.clientAlarmButton.setAttribute(
    "aria-pressed",
    "true"
  );

  elements.clientAlarmButton.title =
    "La alarma de pedidos permanece siempre activa. Pulsa aquí para comprobar o reactivar el sonido.";
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
  /*
   * La alarma de pedidos del restaurante
   * es obligatoria y no puede apagarse.
   *
   * Esta función se conserva para evitar
   * errores si alguna parte antigua del
   * código intenta llamarla.
   */
  clientAlarmEnabled = true;

  localStorage.setItem(
    STORAGE_KEYS.clientAlarmEnabled,
    "1"
  );

  updateClientAlarmButton();
  syncClientAlarm();

  showToast(
    "La alarma de pedidos permanece siempre activa."
  );
}

function toggleClientAlarm() {
  /*
   * El botón no apaga la alarma.
   *
   * Sirve para comprobar/reactivar
   * el permiso de audio del navegador.
   */
  enableClientAlarm().catch(() => {
    clientAlarmEnabled = true;

    localStorage.setItem(
      STORAGE_KEYS.clientAlarmEnabled,
      "1"
    );

    updateClientAlarmButton();
    syncClientAlarm();

    showToast(
      "La alarma sigue activa, pero el navegador no permitió reproducir el sonido."
    );
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

function startClientOrdersPolling(options = {}) {
  const { immediate = false } = options;
  stopClientOrdersPolling();
  if (!canUseCustomerModule() || clientOrdersRealtimeStatus === "SUBSCRIBED") return;

  const generation = clientOrdersPollGeneration;
  const pollDelay = () => Math.min(CLIENT_ORDERS_POLL_MAX_MS, Math.max(
    CLIENT_ORDERS_POLL_MIN_MS, clientOrdersPollingDelay * (0.9 + Math.random() * 0.2)
  ));
  const poll = async () => {
    if (generation !== clientOrdersPollGeneration) return;
    clientOrdersTimer = null;
    if (!canUseCustomerModule() || clientOrdersRealtimeStatus === "SUBSCRIBED") return;

    if (document.visibilityState === "visible" && navigator.onLine) {
      try {
        await refreshClientOrders({ silent: true, reconcileAfterInFlight: false });
        if (generation !== clientOrdersPollGeneration) return;
        clientOrdersPollingDelay = CLIENT_ORDERS_POLL_MIN_MS;
      } catch (error) {
        if (generation !== clientOrdersPollGeneration) return;
        console.error("No fue posible actualizar los pedidos mediante el respaldo temporal.", error);
        clientOrdersPollingDelay = Math.min(
          clientOrdersPollingDelay * 2,
          CLIENT_ORDERS_POLL_MAX_MS
        );
      }
    }

    if (generation === clientOrdersPollGeneration && canUseCustomerModule() && clientOrdersRealtimeStatus !== "SUBSCRIBED") {
      clientOrdersTimer = window.setTimeout(poll, pollDelay());
    }
  };

  clientOrdersTimer = window.setTimeout(poll, immediate ? 0 : pollDelay());
}

function stopClientOrdersPolling() {
  clientOrdersPollGeneration++;
  if (clientOrdersTimer) {
    window.clearTimeout(clientOrdersTimer);
    clientOrdersTimer = null;
  }
}

function stopClientOrdersRealtime() {
  if (clientOrdersRealtimeReconnectTimer) {
    clearTimeout(
      clientOrdersRealtimeReconnectTimer
    );

    clientOrdersRealtimeReconnectTimer = null;
  }

  if (clientOrdersRealtimeStableTimer) {
    clearTimeout(
      clientOrdersRealtimeStableTimer
    );

    clientOrdersRealtimeStableTimer = null;
  }

  const channel = clientOrdersChannel;
  clientOrdersChannel = null;
  clientOrdersRealtimeStatus = "idle";

  if (channel && cloudState.client?.removeChannel) {
    cloudState.client
      .removeChannel(channel)
      .catch((error) => {
        console.warn(
          "No fue posible cerrar inmediatamente el canal de pedidos.",
          error
        );
      });
  }
}

function activeClientOrderStatus(status) {
  return ["pending", "accepted", "sent"].includes(String(status || "").toLowerCase());
}

function mergeRealtimeClientOrder(row) {
  const existing = pendingClientOrders.find((order) => order.id === row?.id) || null;
  return {
    ...(existing || {}),
    ...(row || {}),
    messages: existing?.messages || [],
    chatLoaded: existing?.chatLoaded === true,
    unreadMessages: Number(existing?.unreadMessages) || 0,
    deliveryTracking:
      clientDeliveryTrackingByOrderId.get(String(row?.id || "")) ||
      existing?.deliveryTracking ||
      null,
  };
}

function notifyRealtimeClientOrder(order, wasKnown) {
  if (wasKnown || order?.status !== "pending") return;
  const isWaiterOrder = order.source === "waiter" || order.order_json?.source === "waiter";
  showToast(isWaiterOrder ? "Pedido de mesero nuevo." : "Pedido recibido.");
  showRestaurantNotification(
    isWaiterOrder ? "Pedido de mesero nuevo" : "Pedido nuevo",
    "Hay un pedido pendiente esperando aceptacion e impresion."
  );
  syncClientAlarm();
}

function handleClientOrderRealtimePayload(payload) {
  const row = payload?.new || payload?.old || {};
  const orderId = String(row.id || "");
  if (!orderId) {
    clientOrdersRefreshPending = true;
    return;
  }

  const existingIndex = pendingClientOrders.findIndex((order) => order.id === orderId);
  const wasKnown = existingIndex >= 0;
  if (payload.eventType === "DELETE" || !activeClientOrderStatus(row.status)) {
    if (wasKnown) pendingClientOrders.splice(existingIndex, 1);
    updateClientOrdersBadge();
    renderClientOrderPatch(orderId);
    syncClientAlarm();
    return;
  }

  const merged = mergeRealtimeClientOrder(row);
  if (wasKnown) {
    pendingClientOrders[existingIndex] = merged;
  } else {
    pendingClientOrders.unshift(merged);
  }
  pendingClientOrders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  updateClientOrdersBadge();
  renderClientOrderPatch(orderId);
  notifyRealtimeClientOrder(merged, wasKnown);
}

function handleDeliveryAssignmentRealtimePayload(payload) {
  const assignment = payload?.new || payload?.old || {};
  const orderId = String(assignment.customer_order_id || "");
  const index = pendingClientOrders.findIndex((order) => order.id === orderId);
  if (index < 0) return;

  const order = pendingClientOrders[index];
  const tracking = {
    ...(order.deliveryTracking || {}),
    courier_lat: assignment.courier_lat ?? order.deliveryTracking?.courier_lat,
    courier_lng: assignment.courier_lng ?? order.deliveryTracking?.courier_lng,
    courier_location_updated_at: assignment.updated_at || order.deliveryTracking?.courier_location_updated_at,
    estimated_pickup_at: assignment.estimated_pickup_at || order.deliveryTracking?.estimated_pickup_at,
    estimated_delivery_at: assignment.estimated_delivery_at || order.deliveryTracking?.estimated_delivery_at,
  };
  pendingClientOrders[index] = {
    ...order,
    assigned_courier_user_id: assignment.courier_user_id || order.assigned_courier_user_id,
    courier_assignment_status: assignment.status || order.courier_assignment_status,
    deliveryTracking: tracking,
  };
  clientDeliveryTrackingByOrderId.set(orderId, tracking);
  renderClientOrderPatch(orderId);
}

function handleClientMessageRealtimePayload(payload) {
  if (payload?.eventType !== "INSERT") return;
  const message = payload.new || {};
  const orderId = String(message.order_id || "");
  const index = pendingClientOrders.findIndex((order) => order.id === orderId);
  if (index < 0) return;

  const order = pendingClientOrders[index];
  if (order.chatLoaded) {
    const known = new Set((order.messages || []).map((entry) => entry.id));
    if (!known.has(message.id)) order.messages = [...(order.messages || []), message];
  } else {
    order.unreadMessages = (Number(order.unreadMessages) || 0) + 1;
  }
  pendingClientOrders[index] = { ...order };
  renderClientOrderPatch(orderId);
  if (message.sender === "customer") {
    showToast("Nuevo mensaje de cliente en chat.");
    showRestaurantNotification("Mensaje de cliente", "Hay una respuesta o comprobante en un pedido.");
  }
}
let centralOrderRenderTimer = null;
function handleCentralOrderRealtimePayload(payload) {
  if (!["INSERT", "UPDATE"].includes(payload?.eventType)) return;
  const row = payload.new;
  if (!cloudState.user || row?.user_id !== cloudState.user.id) return;
  const revision = Number(row.revision);
  if (
    centralSyncInProgress || cloudState.loading ||
    !row.id || !row.order_json || row.order_json.id !== row.id ||
    !Number.isSafeInteger(revision) || revision < 1
  ) {
    scheduleCentralRefresh({ orders: true });
    return;
  }
  if (readDeletedOrderIds().includes(row.id)) return;
  const current = savedOrders.find((order) => order.id === row.id);
  // Never acknowledge or overwrite a local pending edit from a notification.
  if (current && (needsCloudSync(current) || Number(current._syncRevision) >= revision)) return;
  const incoming = normalizeOrderNotes({
    ...row.order_json,
    type: normalizeOrderType(row.order_json.type),
    businessDate: orderBusinessDate(row.order_json),
    _syncRevision: revision,
    syncStatus: "synced",
  });
  savedOrders = mergeOrders([incoming], savedOrders.filter((order) => order.id !== row.id));
  saveOrders();
  if (centralOrderRenderTimer !== null) return;
  centralOrderRenderTimer = setTimeout(() => {
    centralOrderRenderTimer = null;
    renderHistory();
    updateCloudStatus();
  }, 100);
}
function stopCentralRealtime() {
  if (centralOrderRenderTimer !== null) {
    clearTimeout(centralOrderRenderTimer);
    centralOrderRenderTimer = null;
  }
  if (centralSyncTimer) {
    clearTimeout(centralSyncTimer);
    centralSyncTimer = null;
  }

  if (centralRealtimeReconnectTimer) {
    clearTimeout(centralRealtimeReconnectTimer);
    centralRealtimeReconnectTimer = null;
  }

  if (centralRealtimeStableTimer) {
    clearTimeout(centralRealtimeStableTimer);
    centralRealtimeStableTimer = null;
  }

  const channel = centralSyncChannel;

  centralSyncChannel = null;
  centralSyncStatus = "idle";

  if (channel && cloudState.client?.removeChannel) {
    cloudState.client
      .removeChannel(channel)
      .catch((error) => {
        console.warn(
          "No se pudo cerrar el canal central de sincronización.",
          error
        );
      });
  }
}

// Bound full-list reads during bursts without postponing them indefinitely.
const CENTRAL_REFRESH_MIN_INTERVAL_MS = 5000;
let centralRefreshLastStartedAt = 0;
let centralRefreshRetryNotBefore = 0;
function deferCentralRefreshAfterError(
  error,
  scopes
) {
  if (
    !CENTRAL_REALTIME_ENABLED ||
    !isTemporarySyncInfrastructureError(
      error
    )
  ) {
    return;
  }
  centralRefreshRetryNotBefore = Math.max(
    centralRefreshRetryNotBefore, Date.now() + 30000
  );
  scheduleCentralRefresh(scopes);
}
let centralSyncRequestedScopes = {
  settings: false,
  profile: false,
  orders: false,
};

function scheduleCentralRefresh(options = {}) {
  if (!CENTRAL_REALTIME_ENABLED) {
    return;
  }

  const {
    settings = false,
    profile = false,
    orders = false,
  } = options;

  centralSyncRequestedScopes.settings ||= settings;
  centralSyncRequestedScopes.profile ||= profile;
  centralSyncRequestedScopes.orders ||= orders;

  if (centralSyncTimer) {
    return;
  }

  const delayMs = Math.max(
    250,
    CENTRAL_REFRESH_MIN_INTERVAL_MS - (Date.now() - centralRefreshLastStartedAt),
    centralRefreshRetryNotBefore - Date.now()
  );
  centralSyncTimer = setTimeout(() => {
    centralSyncTimer = null;

    const requestedScopes = {
      ...centralSyncRequestedScopes,
    };

    centralSyncRequestedScopes = {
      settings: false,
      profile: false,
      orders: false,
    };

    if (
      !requestedScopes.settings &&
      !requestedScopes.profile &&
      !requestedScopes.orders
    ) {
      requestedScopes.settings = true;
      requestedScopes.profile = true;
      requestedScopes.orders = true;
    }

    refreshCentralCloudState(
      requestedScopes
    ).catch((error) => {
      console.error(
        "Error resincronizando el estado central.",
        error
      );
    });
  }, delayMs);
}
async function refreshCentralCloudState(options = {}) {
  const {
    settings = true,
    profile = true,
    orders = true,
  } = options;
  if (
  !cloudState.client ||
  !cloudState.user ||
  !navigator.onLine
) {
  return false;
}

if (Date.now() < Math.max(
  centralRefreshLastStartedAt + CENTRAL_REFRESH_MIN_INTERVAL_MS,
  centralRefreshRetryNotBefore
)) {
  scheduleCentralRefresh({ settings, profile, orders });
  return false;
}

if (centralSyncInProgress) {
  centralSyncRefreshPending = true;

  centralSyncRequestedScopes.settings ||= settings;
  centralSyncRequestedScopes.profile ||= profile;
  centralSyncRequestedScopes.orders ||= orders;

  return false;
}

centralSyncInProgress = true;
centralSyncRefreshPending = false;
centralRefreshLastStartedAt = Date.now();

  try {
    const [
  settingsResponse,
  profileResponse,
  ordersResponse,
] = await Promise.all([
  settings
    ? withCloudTimeout(
        cloudState.client
          .from("app_settings")
          .select(
            "menu, settings, menu_revision, settings_revision, menu_updated_at, settings_updated_at"
          )
          .eq("user_id", cloudState.user.id)
          .maybeSingle(),
        "Los ajustes tardaron demasiado en actualizarse.",
        8000
      ).catch((error) => ({ data: null, error }))
    : Promise.resolve({
        data: null,
        error: null,
      }),

  profile
    ? withCloudTimeout(
        cloudState.client
          .from("restaurant_profiles")
          .select(
            "business_name, logo_url, public_address, phone, active, operational_open, operational_mode, opening_hours, latitude, longitude, country_code, city, region, postal_code, timezone, preferred_language, deleted_at"
          )
          .eq("user_id", cloudState.user.id)
          .maybeSingle(),
        "El perfil tardó demasiado en actualizarse.",
        8000
      ).catch((error) => ({ data: null, error }))
    : Promise.resolve({
        data: null,
        error: null,
      }),

  orders
    ? withCloudTimeout(
        cloudState.client
          .from("orders")
          .select("order_json, revision")
          .eq("user_id", cloudState.user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(LOCAL_ORDER_CACHE_LIMIT),
        "Los pedidos tardaron demasiado en actualizarse.",
        8000
      ).catch((error) => ({ data: null, error }))
    : Promise.resolve({
        data: [],
        error: null,
      }),
]);

    const refreshErrors = [
      settingsResponse.error,
      profileResponse.error,
      ordersResponse.error,
    ].filter(Boolean);

    if (refreshErrors.some(isTemporarySyncInfrastructureError)) {
      deferCentralRefreshAfterError(
        refreshErrors.find(isTemporarySyncInfrastructureError),
        {
          settings: Boolean(settings && settingsResponse.error),
          profile: Boolean(profile && profileResponse.error),
          orders: Boolean(orders && ordersResponse.error),
        }
      );
    }

    refreshErrors.forEach((error) => {
      console.warn(
        "Una parte de la actualización central no pudo confirmarse. Se conservarán los datos locales de ese módulo.",
        error
      );
    });

    const settingsRow = settingsResponse.data;
    const profileRow = profileResponse.data;

    /*
 * REVISIONES
 *
 * Nunca avanzamos la revisión local mientras
 * exista un cambio local pendiente.
 *
 * La revisión guardada representa la última
 * versión que este dispositivo confirmó realmente.
 */
if (
  settingsRow?.settings_revision !== undefined &&
  !hasPendingSettings()
) {
  storeCloudRevision(
    STORAGE_KEYS.settingsRevision,
    settingsRow.settings_revision
  );
}

if (
  settingsRow?.menu_revision !== undefined &&
  !hasPendingMenu()
) {
  storeCloudRevision(
    STORAGE_KEYS.menuRevision,
    settingsRow.menu_revision
  );
}
    /*
     * AJUSTES
     *
     * Si existe un cambio local pendiente,
     * no lo pisamos.
     */
   if (
  settingsRow?.settings &&
  !hasPendingSettings()
) {
  applySettingsPayload(
    settingsRow.settings
  );

  storeConfirmedCloudSettings(
    settingsRow.settings
  );
}

    /*
     * MENÚ
     */
    if (
      settingsRow?.menu &&
      !hasPendingMenu()
    ) {
      const remoteMenu =
        normalizeMenuCatalog(
          settingsRow.menu
        );

      if (
        !menuCatalogsMatch(
          menuCatalog,
          remoteMenu
        )
      ) {
        menuCatalog = remoteMenu;

        saveMenuCache({
          immediate: true
        });

        storeConfirmedCloudMenu(
          remoteMenu
        );

        renderCategories();
        renderMenu();

        if (
          elements.menuEditorDialog?.open
        ) {
          renderMenuEditor();
        }
      }
    }

  /*
 * PERFIL / HORARIO / ABIERTO-CERRADO
 *
 * Si este dispositivo tiene ajustes pendientes,
 * no permitimos que una actualización remota
 * pise esos valores antes de resolver el conflicto.
 */
if (
  profileRow &&
  !hasPendingSettings()
) {
  applyPublicRestaurantProfileFallback(
    profileRow
  );

  if (
    typeof profileRow.active === "boolean"
  ) {
    restaurantActive =
      profileRow.active;

    localStorage.setItem(
      STORAGE_KEYS.restaurantActive,
      restaurantActive ? "1" : "0"
    );
  }
}
    /*
     * PEDIDOS INTERNOS
     *
     * Conservamos pedidos locales pendientes
     * y adoptamos los confirmados de Supabase.
     */
    if (orders && !ordersResponse.error) {
  const deletedIds =
    readDeletedOrderIds();

  const localPending =
    savedOrders.filter(
      (order) =>
        needsCloudSync(order) &&
        !deletedIds.includes(order.id)
    );

  const cloudOrders =
    (ordersResponse.data || [])
      .map((row) => ({
        ...row.order_json,
        type: normalizeOrderType(
          row.order_json?.type
        ),
        businessDate:
          orderBusinessDate(
            row.order_json
          ),
        _syncRevision: Number.parseInt(row.revision, 10) || null,
        syncStatus: "synced",
      }))
      .filter(
        (order) =>
          !deletedIds.includes(
            order.id
          )
      );

  savedOrders = mergeOrders(
    cloudOrders,
    localPending
  );

  saveOrders({
    immediate: true
  });
}
    
    if (settings || profile) {
  renderCurrencySettings();
  renderRestaurantStatus();
  updateRestaurantStatusSync();
}

if (orders) {
  renderHistory();
}

updateCloudStatus();

    return refreshErrors.length === 0;
  } catch (error) {
    console.error(
      "Fallo de sincronización central.",
      error
    );

    deferCentralRefreshAfterError(error, { settings, profile, orders });
    return false;
  } finally {
  centralSyncInProgress = false;

  if (
    centralSyncRefreshPending &&
    cloudState.client &&
    cloudState.user &&
    navigator.onLine
  ) {
    centralSyncRefreshPending = false;
    scheduleCentralRefresh();
  }
}
}
function scheduleCentralRealtimeReconnect() {
  if (
    centralRealtimeReconnectTimer ||
    !navigator.onLine ||
    !cloudState.client ||
    !cloudState.user
  ) {
    return;
  }

  const retryDelay = centralRealtimeReconnectDelay;

  centralRealtimeReconnectTimer = setTimeout(() => {
    centralRealtimeReconnectTimer = null;

    if (
      !navigator.onLine ||
      !cloudState.client ||
      !cloudState.user
    ) {
      return;
    }

    console.info(
      "Reconectando canal central Realtime..."
    );

    centralRealtimeReconnectDelay = Math.min(
      retryDelay * 2,
      CENTRAL_REALTIME_RECONNECT_MAX_MS
    );

    startCentralRealtime();
  }, retryDelay);
}
function startCentralRealtime() {
  if (!CENTRAL_REALTIME_ENABLED) {
    centralRealtimeNeedsCatchup = false;
    stopCentralRealtime();
    return;
  }

  if (
    centralSyncChannel &&
    ["connecting", "SUBSCRIBED"].includes(centralSyncStatus)
  ) {
    return;
  }
  if (
    centralSyncChannel &&
    ["connecting", "SUBSCRIBED"].includes(centralSyncStatus)
  ) {
    return;
  }

  stopCentralRealtime();

  if (
    !cloudState.client ||
    !cloudState.user ||
    !cloudState.client.channel
  ) {
    return;
  }

  centralSyncStatus = "connecting";

 const channel =
    cloudState.client
      .channel(
        `restaurant-central-${cloudState.user.id}`
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter:
            `user_id=eq.${cloudState.user.id}`,
        },
        () =>
          scheduleCentralRefresh({
            settings: true,
            profile: false,
            orders: false,
          })
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_profiles",
          filter:
            `user_id=eq.${cloudState.user.id}`,
        },
        () =>
          scheduleCentralRefresh({
            settings: false,
            profile: true,
            orders: false,
          })
      )

     .on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "orders",
    filter:
      `user_id=eq.${cloudState.user.id}`,
  },
  handleCentralOrderRealtimePayload
)
.on(
  "postgres_changes",
  {
    event: "UPDATE",
    schema: "public",
    table: "orders",
    filter:
      `user_id=eq.${cloudState.user.id}`,
  },
  handleCentralOrderRealtimePayload
)

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "restaurant_public_catalogs",
          filter:
            `restaurant_user_id=eq.${cloudState.user.id}`,
        },
        () =>
          scheduleCentralRefresh({
            settings: true,
            profile: false,
            orders: false,
          })
      );
  centralSyncChannel = channel;

  channel.subscribe((status) => {
    if (
      channel !== centralSyncChannel
    ) {
      return;
    }

    centralSyncStatus = status;

   if (status === "SUBSCRIBED") {
  if (centralRealtimeStableTimer) {
    clearTimeout(centralRealtimeStableTimer);
  }

  centralRealtimeStableTimer = setTimeout(() => {
    centralRealtimeStableTimer = null;

    if (
      channel === centralSyncChannel &&
      centralSyncStatus === "SUBSCRIBED"
    ) {
      centralRealtimeReconnectDelay =
        CENTRAL_REALTIME_RECONNECT_MIN_MS;
    }
  }, CENTRAL_REALTIME_STABLE_MS);

if (centralRealtimeNeedsCatchup) {
  refreshCentralCloudState({
    settings: true,
    profile: true,
    orders: true,
  })
    .then((recovered) => {
      if (
        recovered &&
        channel === centralSyncChannel &&
        centralSyncStatus === "SUBSCRIBED"
      ) {
        centralRealtimeNeedsCatchup = false;
      }
    })
    .catch((error) => {
      console.error(
        "No fue posible resincronizar el estado central al reconectar Realtime.",
        error
      );
    });
}

return;
   
}

  if (
  status === "CHANNEL_ERROR" ||
  status === "TIMED_OUT" ||
  status === "CLOSED"
) {
  centralRealtimeNeedsCatchup = true;
  stopCentralRealtime();
  console.warn(
    "Canal central Realtime:",
    status
  );

  scheduleCentralRealtimeReconnect();
}
  });
}
function scheduleClientOrdersRealtimeReconnect() {
  if (
    clientOrdersRealtimeReconnectTimer ||
    !navigator.onLine ||
    !cloudState.client ||
    !cloudState.user
  ) {
    return;
  }

  const retryDelay =
    clientOrdersRealtimeReconnectDelay;

   clientOrdersRealtimeReconnectTimer =
    setTimeout(() => {
      clientOrdersRealtimeReconnectTimer = null;

      if (
        !navigator.onLine ||
        !cloudState.client ||
        !cloudState.user
      ) {
        return;
      }

      console.info(
        "Reconectando Realtime de pedidos..."
      );

      clientOrdersRealtimeReconnectDelay =
        Math.min(
          retryDelay * 2,
          CLIENT_ORDERS_REALTIME_RECONNECT_MAX_MS
        );

startClientOrdersRealtime();
    }, retryDelay);
}
function startClientOrdersRealtime() {
  if (
    clientOrdersChannel &&
    ["connecting", "SUBSCRIBED"].includes(clientOrdersRealtimeStatus)
  ) {
    return;
  }

  stopClientOrdersRealtime();
  if (!canUseCustomerModule()) return;
 clientOrdersRealtimeStatus = "connecting";

const channel = cloudState.client
  .channel(`restaurant-incoming-orders-${cloudState.user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "customer_orders",
        filter: `user_id=eq.${cloudState.user.id}`,
      },
      handleClientOrderRealtimePayload
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "delivery_assignments",
        filter: `restaurant_user_id=eq.${cloudState.user.id}`,
      },
      handleDeliveryAssignmentRealtimePayload
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "customer_order_messages",
        filter: `user_id=eq.${cloudState.user.id}`,
      },
            handleClientMessageRealtimePayload
    );

  clientOrdersChannel = channel;

  channel.subscribe((status) => {
        if (channel !== clientOrdersChannel) {
      return;
    }
      clientOrdersRealtimeStatus = status;
      if (status === "SUBSCRIBED") {
  if (clientOrdersRealtimeReconnectTimer) {
    clearTimeout(
      clientOrdersRealtimeReconnectTimer
    );
    clientOrdersRealtimeReconnectTimer = null;
  }
if (clientOrdersRealtimeStableTimer) {
  clearTimeout(
    clientOrdersRealtimeStableTimer
  );
}

clientOrdersRealtimeStableTimer = setTimeout(() => {
  clientOrdersRealtimeStableTimer = null;

  if (
    channel === clientOrdersChannel &&
    clientOrdersRealtimeStatus === "SUBSCRIBED"
  ) {
    clientOrdersRealtimeReconnectDelay =
      CLIENT_ORDERS_REALTIME_RECONNECT_MIN_MS;
  }
}, CLIENT_ORDERS_REALTIME_STABLE_MS);

  stopClientOrdersPolling();
  clientOrdersPollingDelay = CLIENT_ORDERS_POLL_MIN_MS;
      if (clientOrdersRealtimeNeedsCatchup) {
  refreshClientOrders({ silent: true, reconcileAfterInFlight: true })
    .then(() => {
      if (
        channel === clientOrdersChannel &&
        clientOrdersRealtimeStatus === "SUBSCRIBED"
      ) {
        clientOrdersRealtimeNeedsCatchup = false;
      }
    })
    .catch((error) => {
      console.error(
        "No fue posible resincronizar los pedidos al reconectar Realtime.",
        error
      );
    });
}
        return;
      }
     if (
  ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)
) {
       clientOrdersRealtimeNeedsCatchup = true;
  stopClientOrdersRealtime();
  startClientOrdersPolling({
    immediate: clientOrdersPollingDelay === CLIENT_ORDERS_POLL_MIN_MS
  });

  scheduleClientOrdersRealtimeReconnect();
}
    });
  startClientOrdersPolling();
}

async function loadCurrentRestaurantDeliveryTracking(signal = null) {
  if (!cloudState.client || !cloudState.user || !navigator.onLine) {
    return clientDeliveryTrackingByOrderId instanceof Map
      ? clientDeliveryTrackingByOrderId
      : new Map();
  }
  if (clientOrdersTrackingInFlight) return clientOrdersTrackingInFlight;
  clientOrdersTrackingInFlight = (async () => {
    const { data, error } = await withCloudTimeout(
      cloudState.client.rpc("get_current_restaurant_delivery_tracking"),
      undefined, 8000, signal
    );
   if (error) {
  const missingFunction =
    /PGRST202|could not find the function|42883/i.test(
      `${error.code || ""} ${error.message || ""}`
    );

  if (missingFunction) {
    return clientDeliveryTrackingByOrderId instanceof Map
      ? clientDeliveryTrackingByOrderId
      : new Map();
  }

  console.error(
    "No se pudo actualizar el seguimiento de domicilios:",
    error.code || error.message
  );

  throw error;
}
    return new Map((Array.isArray(data) ? data : []).map((row) => [String(row.customer_order_id), row]));
  })();
  try {
    return await clientOrdersTrackingInFlight;
  } finally {
    clientOrdersTrackingInFlight = null;
  }
}

async function refreshClientOrders(options = {}) {
  if (clientOrdersRefreshInFlight) {
    if (
      options.reconcileAfterInFlight === true
    ) {
      clientOrdersRefreshPending = true;
    }

    return clientOrdersRefreshInFlight;
  }
  const userId = cloudState.user?.id || null;
  if (clientOrdersRefreshUserId !== userId) {
    clientOrdersRefreshUserId = userId;
    clientOrdersRefreshRetryNotBefore = 0;
    clientOrdersRefreshRetryDelay = CLIENT_ORDERS_POLL_MIN_MS;
    clientOrdersRefreshLastError = null;
  }
  if (Date.now() < clientOrdersRefreshRetryNotBefore) throw clientOrdersRefreshLastError;

  clientOrdersRefreshInFlight =
    performClientOrdersRefresh(options);

  let refreshSucceeded = false;

  try {
    const result =
      await clientOrdersRefreshInFlight;

    refreshSucceeded = result !== false;
    if (refreshSucceeded) {
      clientOrdersRefreshRetryNotBefore = 0;
      clientOrdersRefreshRetryDelay = CLIENT_ORDERS_POLL_MIN_MS;
      clientOrdersRefreshLastError = null;
    }

    return result;
  } catch (error) {
    clientOrdersRefreshLastError = error;
    clientOrdersRefreshRetryDelay = Math.min(
      clientOrdersRefreshRetryDelay * 2, CLIENT_ORDERS_POLL_MAX_MS
    );
    clientOrdersRefreshRetryNotBefore = Date.now() + Math.min(
      CLIENT_ORDERS_POLL_MAX_MS,
      clientOrdersRefreshRetryDelay * (0.9 + Math.random() * 0.2)
    );
    clientOrdersRealtimeNeedsCatchup = true;
    throw error;
  } finally {
    clientOrdersRefreshInFlight = null;

    const shouldReconcile =
      clientOrdersRefreshPending;

    clientOrdersRefreshPending = false;

    /*
     * Solo reconciliamos inmediatamente si
     * la consulta anterior terminó correctamente.
     *
     * Si Supabase falló o está saturado,
     * NO lanzamos otra consulta inmediatamente.
     * El polling/reconnect existente se encargará
     * del siguiente intento con su propio intervalo.
     */
    if (
      shouldReconcile &&
      refreshSucceeded
    ) {
      queueMicrotask(() => {
        refreshClientOrders({
          silent: true,
        }).catch((error) => {
          console.error(
            "No fue posible completar la actualizacion pendiente de pedidos.",
            error
          );
        });
      });
    }
  }
}
async function performClientOrdersRefresh(options = {}) {
  const { silent = false } = options;
  const requestClient = cloudState.client;
  const requestUserId = cloudState.user?.id;
  const previousIds = new Set(pendingClientOrders.filter((order) => order.status === "pending").map((order) => order.id));
  if (!canUseCustomerModule()) {
    pendingClientOrders = [];
    updateClientOrdersBadge();
    if (elements.clientOrdersDialog.open) {
      elements.clientOrdersList.innerHTML = `<div class="monthly-empty">Inicia sesion para recibir pedidos de clientes y meseros.</div>`;
    }
    return;
  }

  if (!navigator.onLine) {
    if (!silent || elements.clientOrdersDialog.open) {
      elements.clientOrdersList.innerHTML = `<div class="monthly-empty">Sin internet. Los pedidos recibidos necesitan conexion.</div>`;
    }
    return;
  }

  const previousById = new Map(pendingClientOrders.map((order) => [String(order.id), order]));
  const ordersRequest = (async () => {
    const pageSize = 100;
    const ordersById = new Map();
    let cursor = null;
    while (true) {
      if (requestClient !== cloudState.client || requestUserId !== cloudState.user?.id) return { data: [], error: null };
      let query = requestClient
        .from("customer_orders")
        .select("id, status, table_label, customer_name, order_type, order_json, total, created_at, assigned_courier_user_id, courier_assignment_status, source, created_by_user_id, server_name, station_status, payment_method, payment_status, payment_provider")
        .eq("user_id", requestUserId)
        .in("status", ["pending", "accepted", "sent"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize);
      if (cursor) {
        query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      }
      const response = await withCloudTimeout(query, undefined, 8000, options.signal);
      if (response.error) return response;
      if (!Array.isArray(response.data)) throw new Error("La consulta de pedidos devolvio datos invalidos.");
      for (const order of response.data) ordersById.set(String(order.id), order);
      if (response.data.length < pageSize) return { data: [...ordersById.values()], error: null };
      const last = response.data[response.data.length - 1];
      if (!last?.id || !last?.created_at || (cursor && cursor.id === last.id && cursor.created_at === last.created_at)) {
        throw new Error("La paginacion de pedidos no avanzo; se conservaran los pedidos anteriores.");
      }
      cursor = { id: last.id, created_at: last.created_at };
    }
  })();
  const trackingRequest = loadCurrentRestaurantDeliveryTracking(options.signal).catch((trackingError) => {
    console.warn(
      "No fue posible confirmar el seguimiento de domicilios. Se conservara el ultimo estado valido.",
      trackingError
    );

    return clientDeliveryTrackingByOrderId instanceof Map
      ? clientDeliveryTrackingByOrderId
      : new Map();
  });
  const [ordersResponse, tracking] = await Promise.all([
    ordersRequest,
    trackingRequest,
  ]);
  const { data, error } = ordersResponse;
  if (requestClient !== cloudState.client || requestUserId !== cloudState.user?.id) return false;

  if (error) {
    if (!silent || elements.clientOrdersDialog.open) {
      elements.clientOrdersList.innerHTML = `<div class="monthly-empty">No se pudieron cargar los pedidos recibidos. Revisa internet, inicia sesion y vuelve a intentar.</div>`;
    }
    throw error;
  }

  const orders = data || [];
  clientDeliveryTrackingByOrderId = tracking;
  pendingClientOrders = orders.map((order) => {
    const previous = previousById.get(String(order.id));
    return {
      ...order,
      deliveryTracking: clientDeliveryTrackingByOrderId.get(String(order.id)) || null,
      messages: previous?.messages || [],
      chatLoaded: previous?.chatLoaded === true,
      unreadMessages: Number(previous?.unreadMessages) || 0,
    };
  });
  const newOrdersCount = pendingClientOrders.filter((order) => order.status === "pending" && !previousIds.has(order.id)).length;
  updateClientOrdersBadge();
  renderClientOrders();
  if (newOrdersCount > 0) {
    const waiterOrdersCount = pendingClientOrders.filter(
      (order) => order.status === "pending" && !previousIds.has(order.id) && order.source === "waiter"
    ).length;
    showToast(
      waiterOrdersCount === newOrdersCount
        ? `${newOrdersCount} pedido de mesero nuevo.`
        : `${newOrdersCount} pedido recibido.`
    );
    showRestaurantNotification(
      waiterOrdersCount === newOrdersCount ? "Pedido de mesero nuevo" : "Pedido nuevo",
      `${newOrdersCount} pedido pendiente esperando aceptacion e impresion.`
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

function clientOrderCourierStatusLabel(status) {
  if (status === "offered") return "Oferta enviada al colaborador";
  if (status === "accepted") return "Colaborador acepto";
  if (status === "arrived_restaurant") return "Colaborador llego al restaurante";
  if (status === "picked_up") return "Pedido recogido por colaborador";
  if (status === "arrived_customer") return "Colaborador llego al cliente";
  if (status === "delivered") return "Domicilio entregado";
  if (status === "rejected") return "Colaborador rechazo";
  if (status === "cancelled") return "Asignacion cancelada";
  if (status === "expired") return "Oferta vencida";
  if (status === "no_courier") return "Sin colaborador disponible";
  return "Sin colaborador asignado";
}

function clientOrderNeedsCourier(order) {
  return normalizeOrderType(order?.order_type || order?.order_json?.type) === "Domicilio";
}

function clientOrderCanRequestCourier(order) {
  if (!clientOrderNeedsCourier(order)) return false;
  if (!["accepted", "sent"].includes(order?.status)) return false;
  return !["offered", "accepted", "arrived_restaurant", "picked_up", "arrived_customer", "delivered"].includes(
    order?.courier_assignment_status
  );
}

function clientOrderCourierHtml(order) {
  if (!clientOrderNeedsCourier(order)) return "";
  const status = order?.courier_assignment_status || "unassigned";
  const tracking = order?.deliveryTracking || null;
  const lat = Number(tracking?.courier_lat);
  const lng = Number(tracking?.courier_lng);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const locationDate = new Date(tracking?.courier_location_updated_at || 0);
  const locationTime = Number.isNaN(locationDate.getTime())
    ? ""
    : locationDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const etaDate = new Date(tracking?.estimated_delivery_at || tracking?.estimated_pickup_at || 0);
  const eta = Number.isNaN(etaDate.getTime())
    ? ""
    : etaDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const mapUrl = hasLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : "";
  return `
    <p class="client-order-note">COLABORADOR: ${escapeHtml(clientOrderCourierStatusLabel(status))}</p>
    ${tracking ? `
      <div class="client-order-tracking">
        ${tracking.courier_name ? `<strong>${escapeHtml(tracking.courier_name)}</strong>` : ""}
        ${locationTime ? `<span>Ubicacion actualizada: ${escapeHtml(locationTime)}</span>` : ""}
        ${eta ? `<span>Entrega estimada: ${escapeHtml(eta)}</span>` : ""}
        ${mapUrl ? `<a href="${mapUrl}" target="_blank" rel="noopener noreferrer">Abrir ubicacion</a>` : ""}
      </div>
    ` : ""}
  `;
}

function clientOrderActionsHtml(orderOrStatus) {
  const order = typeof orderOrStatus === "object" ? orderOrStatus : { status: orderOrStatus };
  const status = order.status;
  const courierButton = clientOrderCanRequestCourier(order)
    ? `<button type="button" data-action="assign-nearest-courier">Buscar colaborador cercano</button>`
    : "";

  if (status === "pending") {
    if (!clientOrderPaymentIsReady(order)) {
      return `
        <p class="client-order-note">PAGO EN LINEA PENDIENTE. EL PEDIDO NO SE PUEDE ACEPTAR TODAVIA.</p>
        <div class="client-order-actions">
          <button type="button" disabled aria-disabled="true">Esperando pago</button>
          <button type="button" data-action="cancel-client-order">Cancelar</button>
        </div>
      `;
    }
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
        ${courierButton}
        <button type="button" data-action="sent-client-order">Pedido enviado</button>
        <button type="button" data-action="cancel-client-order">Cancelar</button>
      </div>
    `;
  }

  if (status === "sent") {
    return `
      <div class="client-order-actions">
        ${courierButton}
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
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadAndOpenRestaurantChat(orderId) {
  const index = pendingClientOrders.findIndex((order) => order.id === orderId);
  if (index < 0) return;
  const current = pendingClientOrders[index];
  if (current.chatLoaded) return;

  try {
    const messages = await loadRestaurantChatMessages(orderId);
    pendingClientOrders[index] = {
      ...current,
      messages,
      chatLoaded: true,
      unreadMessages: 0,
    };
    renderClientOrderPatch(orderId);
  } catch (error) {
    console.error("No fue posible abrir el chat del pedido.", error);
    showToast("No fue posible abrir el chat. Revisa la conexion e intenta nuevamente.");
  }
}

function clientChatImageHtml(message) {
  const image = String(message?.image_data_url || "");
  if (!image.startsWith("data:image/") && !/^https:\/\//i.test(image)) return "";
  return `<a href="${escapeHtml(image)}" target="_blank" rel="noopener"><img src="${escapeHtml(image)}" alt="Imagen enviada en chat" loading="lazy" /></a>`;
}

function renderClientChat(order) {
  if (!order.chatLoaded) {
    const unread = Number(order.unreadMessages) || 0;
    return `
      <section class="client-chat-box is-collapsed">
        <strong>Chat / soporte${unread ? ` (${unread} nuevo${unread === 1 ? "" : "s"})` : ""}</strong>
        <button type="button" data-action="load-client-chat">Abrir chat</button>
      </section>
    `;
  }
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

function clientOrderCardHtml(order) {
  const created = new Date(order.created_at);
  const timeText = Number.isNaN(created.getTime())
    ? ""
    : created.toLocaleTimeString(appUiLocale(), { hour: "2-digit", minute: "2-digit" });
  const items = clientOrderItems(order);
  const customerLabel = [order.table_label, order.customer_name].filter(Boolean).join(" - ") || "Cliente QR";
  const paymentMethod = paymentMethodLabel(order.payment_method || order.order_json?.paymentMethod);
  const paymentStatus = paymentStatusLabel(order.payment_status || order.order_json?.paymentStatus);
  const deliverySummary = formatDeliverySummary(order.order_json?.delivery);
  const isWaiterOrder = order.source === "waiter" || order.order_json?.source === "waiter";
  const sourceLabel = isWaiterOrder
    ? `Mesero: ${order.server_name || order.order_json?.serverName || "Personal autorizado"}`
    : "Pedido de cliente";

  return `
        <article class="client-order-card" data-client-order-id="${escapeHtml(order.id)}">
          <div class="client-order-head">
            <div>
              <strong>${escapeHtml(customerLabel)}</strong>
              <span>${escapeHtml(orderTypeLabel(order.order_type))}${timeText ? ` / ${escapeHtml(timeText)}` : ""}</span>
              <span class="client-order-source ${isWaiterOrder ? "is-waiter" : ""}">${escapeHtml(sourceLabel)}</span>
              <span>Estado: ${clientOrderStatusLabel(order.status)}</span>
              <span>Pago: ${escapeHtml(paymentMethod)} / ${escapeHtml(paymentStatus)}</span>
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
          ${clientOrderCourierHtml(order)}
          ${renderClientChat(order)}
          ${clientOrderActionsHtml(order)}
        </article>`;
}

function renderClientOrderPatch(orderId) {
  if (!elements.clientOrdersList) return;
  renderRestaurantDashboard();
  if (!elements.clientOrdersDialog?.open) return;

  const existingCard = Array.from(elements.clientOrdersList.querySelectorAll(".client-order-card"))
    .find((card) => card.dataset.clientOrderId === String(orderId));
  const order = pendingClientOrders.find((entry) => entry.id === orderId);
  if (!order) {
    existingCard?.remove();
    if (!pendingClientOrders.length) {
      elements.clientOrdersList.innerHTML = `<div class="monthly-empty">No hay pedidos recibidos hoy.</div>`;
    }
    return;
  }

  const activeElement = document.activeElement;
  const activeWasInside = Boolean(existingCard && activeElement && existingCard.contains(activeElement));
  const activeAction = activeWasInside ? activeElement.dataset?.action || "" : "";
  const chatDraft = existingCard?.querySelector('[data-action="restaurant-chat-input"]')?.value || "";
  const listScrollTop = elements.clientOrdersList.scrollTop;
  const template = document.createElement("template");
  template.innerHTML = clientOrderCardHtml(order).trim();
  const nextCard = template.content.firstElementChild;

  if (existingCard) {
    existingCard.replaceWith(nextCard);
  } else {
    elements.clientOrdersList.querySelector(".monthly-empty")?.remove();
    elements.clientOrdersList.prepend(nextCard);
  }

  const nextChatInput = nextCard.querySelector('[data-action="restaurant-chat-input"]');
  if (nextChatInput && chatDraft) nextChatInput.value = chatDraft;
  if (activeWasInside && activeAction) {
    nextCard.querySelector(`[data-action="${activeAction}"]`)?.focus({ preventScroll: true });
  }
  elements.clientOrdersList.scrollTop = listScrollTop;
}

function renderClientOrders() {
  if (!elements.clientOrdersList) return;
  renderRestaurantDashboard();
  if (!pendingClientOrders.length) {
    elements.clientOrdersList.innerHTML = `<div class="monthly-empty">No hay pedidos recibidos hoy.</div>`;
    return;
  }
  elements.clientOrdersList.innerHTML = pendingClientOrders.map(clientOrderCardHtml).join("");
}

function friendlyCourierAssignmentError(error) {
  const message = String(error?.message || "");
  if (/assign_nearest_courier|function .* does not exist|schema cache/i.test(message)) {
    return "La asignacion de colaboradores cercanos aun no esta disponible. Intenta nuevamente mas tarde.";
  }
  if (/Restaurant location is missing|location/i.test(message)) {
    return "Guarda la ubicacion del restaurante en Editar menu > Pedidos cliente > Usar ubicacion actual.";
  }
  if (/Order is not delivery/i.test(message)) return "Solo los pedidos a domicilio necesitan colaborador.";
  if (/not authenticated/i.test(message)) return "Inicia sesion como restaurante para asignar colaborador.";
  return "No se pudo buscar colaborador cercano.";
}

async function assignNearestCourierForOrder(orderId) {
  const clientOrder = pendingClientOrders.find((order) => order.id === orderId);
  if (!clientOrder) return null;
  if (!clientOrderNeedsCourier(clientOrder)) {
    showToast("Este pedido no es domicilio; no necesita colaborador.");
    return null;
  }
  if (!canUseCustomerModule() || !navigator.onLine) {
    alert("Necesitas internet e iniciar sesion para buscar colaborador cercano.");
    return null;
  }

  showToast("Buscando colaborador disponible mas cercano...");
  const { data, error } = await cloudState.client.rpc("assign_nearest_courier", {
    p_customer_order_id: orderId,
  });

  if (error) {
    const message = friendlyCourierAssignmentError(error);
    pendingClientOrders = pendingClientOrders.map((order) =>
      order.id === orderId ? { ...order, courier_assignment_status: "no_courier" } : order
    );
    renderClientOrders();
    showToast(message);
    return null;
  }

  const assignment = Array.isArray(data) ? data[0] : data;
  if (!assignment?.assignment_id) {
    pendingClientOrders = pendingClientOrders.map((order) =>
      order.id === orderId ? { ...order, courier_assignment_status: "no_courier" } : order
    );
    renderClientOrders();
    showToast("No hay colaboradores aprobados y disponibles cerca en este momento.");
    return null;
  }

  pendingClientOrders = pendingClientOrders.map((order) =>
    order.id === orderId
      ? {
          ...order,
          assigned_courier_user_id: assignment.courier_user_id,
          courier_assignment_status: assignment.status || "offered",
        }
      : order
  );
  renderClientOrders();
  const courierName = assignment.courier_name || "colaborador";
  const km = Number.parseFloat(assignment.distance_km);
  showToast(
    Number.isFinite(km)
      ? `Oferta enviada a ${courierName} (${km.toFixed(2)} km).`
      : `Oferta enviada a ${courierName}.`
  );
  return assignment;
}

function orderFromClientOrder(clientOrder) {
  const payload = clientOrder.order_json || {};
  const tableLabel = String(clientOrder.table_label || payload.table || "").trim();
  const customerName = String(clientOrder.customer_name || payload.customer || "").trim();
  const isWaiterOrder = clientOrder.source === "waiter" || payload.source === "waiter";
  const customerLabel = [tableLabel, customerName].filter(Boolean).join(" - ") || (isWaiterOrder ? "Pedido de mesero" : "Cliente QR");
  const clientNote = normalizeNoteText(payload.notes);
  const sourceNote = `${isWaiterOrder ? "PEDIDO MESERO" : "PEDIDO CLIENTE QR"} ${String(clientOrder.id || "").slice(0, 8).toUpperCase()}`;

  return {
    ...createBlankOrder(),
    type: normalizeOrderType(clientOrder.order_type || payload.type),
    paymentMethod: normalizePaymentMethod(clientOrder.payment_method || payload.paymentMethod),
    paymentStatus: normalizePaymentStatus(clientOrder.payment_status || payload.paymentStatus),
    customer: customerLabel,
    server: isWaiterOrder
      ? String(clientOrder.server_name || payload.serverName || "Mesero").trim()
      : shiftServerName || elements.serverName.value.trim() || "Caja",
    notes: [clientNote, sourceNote].filter(Boolean).join(" | "),
    delivery: normalizeDeliveryInfo(payload.delivery),
    customerOrderId: clientOrder.id,
    items: clientOrderItems(clientOrder)
      .map((item) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        productId: item.product_id || item.productId || "",
        name: itemReportName(item),
        price: itemPrice(item),
        qty: Math.max(1, Number.parseInt(itemQuantity(item), 10) || 1),
        note: normalizeNoteText(item.note),
        station: normalizeProductStation(item.station || item.options_snapshot?.station),
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

  if (!clientOrderPaymentIsReady(clientOrder)) {
    alert("El pago en linea todavia no ha sido confirmado. Actualiza la bandeja antes de aceptar.");
    return;
  }

  const acceptedOrderId = createLocalOrderUuid();
  const serverName = clientOrder.source === "waiter"
    ? String(clientOrder.server_name || clientOrder.order_json?.serverName || "Mesero").trim()
    : shiftServerName || elements.serverName.value.trim() || "Caja";
  const { data, error } = await cloudState.client.rpc("accept_customer_order_atomic", {
    p_customer_order_id: orderId,
    p_restaurant_order_id: acceptedOrderId,
    p_server_name: serverName,
  });

  if (error) {
    const message = String(error.message || "");
    if (/payment is not confirmed/i.test(message)) {
      alert("El pago en linea todavia no ha sido confirmado.");
    } else if (/already|only pending|missing its restaurant ticket/i.test(message)) {
      alert("Este pedido ya fue procesado en otra caja. La bandeja se actualizara.");
      await refreshClientOrders({ silent: true, reconcileAfterInFlight: true });
    } else if (["42883", "PGRST202"].includes(error.code)) {
      alert("El servicio de pedidos necesita una actualizacion. Contacta al soporte antes de aceptar pedidos.");
    } else {
      alert("No se pudo aceptar el pedido. No se creo ningun ticket incompleto.");
    }
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.accepted_order_json) {
    alert("La nube no devolvio el ticket confirmado. Actualiza la bandeja e intenta nuevamente.");
    return;
  }
  if (result.already_accepted) {
    alert("Este pedido ya fue aceptado en otra caja. No se imprimira nuevamente.");
    await refreshClientOrders({ silent: true, reconcileAfterInFlight: true });
    return;
  }

currentOrder = normalizeCurrentOrderDraft({
  ...result.accepted_order_json,
  id: result.restaurant_order_id,
  ticketNumber: result.ticket_number,
  businessDate: result.business_date,
  _syncRevision: 1,
  saved: true,
  syncStatus: "synced",
});
  nextTicket = Math.max(nextTicket, Number(result.ticket_number) + 1);
  savedOrders = mergeOrders([structuredCloneOrder(currentOrder)], savedOrders);
  saveOrders();
  saveTicketState();
  clearCurrentOrderDraft();
  renderOrder();
  renderHistory();

  pendingClientOrders = pendingClientOrders.map((order) =>
    order.id === orderId
      ? { ...order, status: "accepted", restaurant_order_id: result.restaurant_order_id, updated_at: new Date().toISOString() }
      : order
  );
  updateClientOrdersBadge();
  renderClientOrders();
  if (clientOrderNeedsCourier(clientOrder)) {
    await assignNearestCourierForOrder(orderId);
  }

  renderPrintTicket(currentOrder);
  await printRenderedTicket();
  const sourceLabel = clientOrder.source === "waiter" || clientOrder.order_json?.source === "waiter" ? "Pedido de mesero" : "Pedido de cliente";
  showToast(`${sourceLabel} aceptado e impreso como ${formatTicket(currentOrder.ticketNumber)}.`);
}

async function updateClientOrderStatus(orderId, nextStatus, successMessage, options = {}) {
  const clientOrder = pendingClientOrders.find((order) => order.id === orderId);
  if (!clientOrder) return false;
  if (!canUseCustomerModule() || !navigator.onLine) {
    alert("Necesitas internet e iniciar sesion para actualizar pedidos de clientes.");
    return false;
  }

  const { error } = await cloudState.client.rpc("transition_customer_order_status", {
    p_customer_order_id: orderId,
    p_next_status: nextStatus,
    p_reason: options.reason || "",
  });

  if (error) {
    alert("No se pudo actualizar el estado del pedido del cliente.");
    return false;
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
  return true;
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
  const updated = await updateClientOrderStatus(orderId, "delivered", "Pedido marcado como entregado. El cliente sera notificado.", {
    removeFromList: true,
  });
  if (!updated) return;
  const { error } = await cloudState.client.functions.invoke("marketplace-release-order", {
    body: { orderId },
  });
  if (error && !/not found|404|payment|allocation/i.test(String(error.message || ""))) {
    showToast("El pedido quedo entregado; la liquidacion se reintentara de forma segura.");
  }
}

async function cancelClientOrder(orderId) {
  const clientOrder = pendingClientOrders.find(
    (order) => order.id === orderId
  );

  if (!clientOrder) return;

  if (
    !canUseCustomerModule() ||
    !navigator.onLine
  ) {
    alert(
      "Necesitas internet e iniciar sesion para cancelar pedidos de clientes."
    );
    return;
  }

  const label =
    [
      clientOrder.table_label,
      clientOrder.customer_name,
    ]
      .filter(Boolean)
      .join(" - ") ||
    "Cliente QR";

  const shouldCancel =
    confirm(
      `Cancelar el pedido de ${label}?`
    );

  if (!shouldCancel) return;


  const {
    data,
    error,
  } =
    await cloudState.client.functions.invoke(
      "marketplace-cancel-order",
      {
        body: {
          orderId,
          reason:
            "Cancelado por el restaurante",
        },
      }
    );


  if (error) {
    let serverError = "";
    let serverCode = "";
    let retryable = false;

    try {
      const context =
        error?.context;

      if (
        context &&
        typeof context.clone ===
          "function"
      ) {
        const payload =
          await context
            .clone()
            .json();

        serverError =
          String(
            payload?.error ||
              payload?.message ||
              ""
          ).trim();

        serverCode =
          String(
            payload?.code ||
              ""
          ).trim();

        retryable =
          payload?.retryable ===
          true;
      }
    } catch {
      /*
       * No ocultamos el error
       * principal si no podemos
       * decodificar la respuesta.
       */
    }


    if (
      serverCode ===
        "ONLINE_PAYMENT_CANCELLATION_REQUIRES_REFUND" ||
      serverCode ===
        "PAYMENT_ALREADY_CAPTURED"
    ) {
      alert(
        "Este pedido ya tiene un pago confirmado. No se cancelara automaticamente: primero debe procesarse la devolucion del dinero."
      );
      return;
    }


    if (
      serverCode ===
        "PAYMENT_PROCESSING" ||
      serverCode ===
        "PAYMENT_STATE_UNRESOLVED" ||
      serverCode ===
        "PAYMENT_STATE_CHANGED" ||
      serverCode ===
        "PAYMENT_REQUIRES_RECONCILIATION" ||
      serverCode ===
        "ONLINE_PAYMENT_CANCELLATION_REQUIRES_GATEWAY"
    ) {
      alert(
        retryable
          ? "El pago se esta verificando. Por seguridad el pedido no fue cancelado. Espera unos segundos e intenta nuevamente."
          : "El estado del pago debe resolverse antes de cancelar este pedido."
      );

      return;
    }


    console.error(
      "marketplace-cancel-order failed",
      {
        orderId,
        code:
          serverCode,
        message:
          serverError ||
          error?.message ||
          "",
      }
    );

    alert(
      "No se pudo cancelar el pedido de forma segura. Intenta nuevamente."
    );

    return;
  }


  if (!data?.cancelled) {
    alert(
      "No se pudo confirmar la cancelacion segura del pedido."
    );
    return;
  }


  pendingClientOrders =
    pendingClientOrders.filter(
      (order) =>
        order.id !== orderId
    );


  updateClientOrdersBadge();

  renderClientOrders();


  showToast(
    data?.alreadyCancelled
      ? "El pedido ya estaba cancelado."
      : "Pedido de cliente cancelado."
  );
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

  const maxSide = 800;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let quality = 0.8;
  let compressed = canvas.toDataURL("image/jpeg", quality);
  while (compressed.length > 420000 && quality > 0.5) {
    quality -= 0.08;
    compressed = canvas.toDataURL("image/jpeg", quality);
  }
  if (compressed.length > 550000) {
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
    const messages = await loadRestaurantChatMessages(orderId);
    const index = pendingClientOrders.findIndex((order) => order.id === orderId);
    if (index >= 0) {
      pendingClientOrders[index] = {
        ...pendingClientOrders[index],
        messages,
        chatLoaded: true,
        unreadMessages: 0,
      };
      renderClientOrderPatch(orderId);
    }
  } catch (error) {
    alert("No se pudo enviar el mensaje.");
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
    alert(
      "Para que el QR muestre el menu real actualizado, conecta internet y vuelve a abrir el QR."
    );
    return false;
  }

  const settingsPendingToken =
    currentSettingsPendingToken();

  const menuPendingToken =
    currentMenuPendingToken();

  try {
    if (settingsPendingToken) {
      await saveCloudSettings();

      clearSettingsPending(
        settingsPendingToken
      );
    }

    await saveCloudMenu();

    if (menuPendingToken) {
      clearMenuPending(
        menuPendingToken
      );
    }

    updateCloudStatus();
    return true;
  } catch (error) {
    console.error(error);
    markMenuPending();
    updateCloudStatus();

    alert(
      "No pude subir el menu actual a la nube. El QR podria mostrar un menu viejo hasta que vuelva a sincronizar."
    );

    return false;
  }
}

async function openQrDialog() {
  if (!cloudState.configured) {
    alert("La conexion de la nube no esta disponible. Intenta nuevamente antes de usar pedidos por QR.");
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

function openRestaurantKitchenStation() {
  const link = buildWaiterLink();
  if (!link) {
    alert("Inicia sesion para abrir una estacion de cocina.");
    return;
  }
  const url = new URL(link);
  url.searchParams.set("station", "kitchen");
  window.open(url.toString(), "_blank", "noopener");
}

function handleRestaurantDashboardAction(action) {
  if (action === "orders") {
    openClientOrdersDialog().catch((error) => console.error(error));
    return;
  }
  if (action === "menu") {
    openMenuEditor();
    return;
  }
  if (action === "kitchen") {
    openRestaurantKitchenStation();
    return;
  }
  if (action === "statistics") {
    elements.dailyCloseButton?.click();
    return;
  }
  if (action === "staff") {
    openWaiterTeamDialog().catch((error) => console.error(error));
  }
}

function buildWaiterLink() {
  if (!cloudState.user) return "";
  const url = new URL("./mesero.html", window.location.href);
  url.searchParams.set("store", cloudState.user.id);
  url.searchParams.set("app", APP_VERSION);
  return url.toString();
}

function setWaiterTeamMessage(message = "", type = "") {
  if (!elements.waiterTeamMessage) return;
  elements.waiterTeamMessage.textContent = message;
  elements.waiterTeamMessage.dataset.type = type;
  elements.waiterTeamMessage.hidden = !message;
}

function waiterMembershipError(error) {
  const message = String(error?.message || "");
  if (/Employee account was not found/i.test(message)) {
    return "Ese correo aun no tiene cuenta. El empleado debe crearla desde el enlace del personal y confirmar su correo.";
  }
  if (/function .* does not exist|schema cache|PGRST202|42883/i.test(message)) {
    return "La autorizacion de personal aun no esta disponible. Contacta al soporte.";
  }
  if (/Restaurant owner profile is missing/i.test(message)) {
    return "Primero completa y guarda el perfil del restaurante.";
  }
  if (/Employee email is invalid/i.test(message)) {
    return "Escribe un correo electronico valido para el empleado.";
  }
  if (/Owner cannot be added as staff/i.test(message)) {
    return "El propietario ya tiene control del restaurante y no necesita agregarse como empleado.";
  }
  return "No fue posible actualizar el equipo.";
}

function restaurantStationLabel(station) {
  return {
    waiter: "Mesero",
    cashier: "Caja",
    kitchen: "Cocina",
    grill: "Parrilla",
    drinks: "Bebidas",
    fast_food: "Comidas rapidas",
    starters: "Entradas",
    salads: "Ensaladas",
    packing: "Empaque",
    dispatch: "Despacho",
    manager: "Encargado",
  }[station] || "Personal";
}

function normalizeProductStation(station) {
  const value = String(station || "").trim().toLowerCase();
  return ["kitchen", "grill", "drinks", "fast_food", "starters", "salads"].includes(value)
    ? value
    : "kitchen";
}

function renderWaiterMembers(rows = []) {
  if (!elements.waiterMembersList) return;
  if (!rows.length) {
    elements.waiterMembersList.innerHTML = `<div class="monthly-empty">Aun no hay personal autorizado.</div>`;
    return;
  }
  elements.waiterMembersList.innerHTML = rows
    .map(
      (row) => {
        const pending = row.pending === true;
        const statusLabel = pending ? "Invitacion pendiente" : row.active ? "Activo" : "Desactivado";
        const rowStateClass = pending ? "is-pending" : row.active ? "" : "is-inactive";
        const actions = pending
          ? `<button type="button" data-action="confirm-waiter">Confirmar autorizacion</button>
             <button type="button" class="secondary-action" data-action="toggle-waiter" data-next-active="false">Cancelar invitacion</button>`
          : `<button type="button" data-action="toggle-waiter" data-next-active="${row.active ? "false" : "true"}">${row.active ? "Desactivar" : "Reactivar"}</button>`;
        return `
        <article class="waiter-member-row ${rowStateClass}" data-member-id="${escapeHtml(row.member_user_id || "")}" data-member-email="${escapeHtml(row.member_email || "")}" data-member-name="${escapeHtml(row.display_name || "")}" data-station="${escapeHtml(row.station)}" data-pending="${pending}">
          <div>
            <strong>${escapeHtml(row.display_name || restaurantStationLabel(row.station))}</strong>
            <small>${escapeHtml(row.member_email || "")}</small>
          </div>
          <span>${escapeHtml(restaurantStationLabel(row.station))}<br>${statusLabel}</span>
          <div class="waiter-member-actions">${actions}</div>
        </article>`;
      }
    )
    .join("") || `<div class="monthly-empty">Aun no hay personal autorizado.</div>`;
}

function employeeHoursText(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = Math.round(safeMinutes % 60);
  return `${hours} h ${String(remainder).padStart(2, "0")} min`;
}

function renderEmployeeHours(rows = []) {
  if (!elements.employeeHoursList) return;
  if (!rows.length) {
    elements.employeeHoursList.innerHTML = `<div class="monthly-empty">Aun no hay turnos registrados.</div>`;
    return;
  }
  elements.employeeHoursList.innerHTML = rows.map((row) => `
    <article class="employee-hours-row">
      <div>
        <strong>${escapeHtml(row.display_name || row.member_email || "Empleado")}</strong>
        <small>${escapeHtml(row.member_email || "")} · ${escapeHtml(row.stations || "Personal")}</small>
      </div>
      <span><small>Semana</small><strong>${employeeHoursText(row.week_minutes)}</strong></span>
      <span><small>Mes</small><strong>${employeeHoursText(row.month_minutes)}</strong></span>
      <em data-open="${row.shift_open === true}">${row.shift_open === true ? "En turno" : "Fuera de turno"}</em>
    </article>
  `).join("");
}

async function loadEmployeeHours() {
  if (!elements.employeeHoursList || !cloudState.client || !cloudState.user) return;
  elements.employeeHoursList.innerHTML = `<div class="monthly-empty">Cargando horarios...</div>`;
  const { data, error } = await cloudState.client.rpc("get_current_restaurant_employee_hours", {
    p_anchor_date: currentBusinessDate(),
  });
  if (error) {
    elements.employeeHoursList.innerHTML = isMissingRestaurantRpc(error)
      ? `<div class="monthly-empty">El registro de horarios aun no esta disponible. Contacta al soporte de la plataforma.</div>`
      : `<div class="monthly-empty">No fue posible cargar los horarios.</div>`;
    return;
  }
  renderEmployeeHours(Array.isArray(data) ? data : []);
}

async function loadWaiterMembers() {
  if (!cloudState.client || !cloudState.user) return;
  elements.waiterMembersList.innerHTML = `<div class="monthly-empty">Cargando equipo...</div>`;
  let { data, error } = await cloudState.client.rpc("list_current_restaurant_team");
  if (error && isMissingRestaurantRpc(error)) {
    ({ data, error } = await cloudState.client.rpc("list_current_restaurant_staff"));
  }
  if (error) {
    renderWaiterMembers([]);
    setWaiterTeamMessage(waiterMembershipError(error), "error");
    return;
  }
  setWaiterTeamMessage("");
  renderWaiterMembers(Array.isArray(data) ? data : []);
  return Array.isArray(data) ? data : [];
}

async function openWaiterTeamDialog() {
  if (!cloudState.user) {
    openSignInScreen();
    return;
  }
  elements.waiterLinkInput.value = buildWaiterLink();
  setWaiterTeamMessage("");
  elements.waiterTeamDialog.showModal();
  await Promise.all([loadWaiterMembers(), loadEmployeeHours()]);
}

async function copyWaiterLink() {
  const link = elements.waiterLinkInput.value;
  if (!link) return;
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    elements.waiterLinkInput.select();
    document.execCommand?.("copy");
  }
  showToast("Enlace del personal copiado.");
}

function openWaiterLink() {
  const link = elements.waiterLinkInput.value;
  if (link) window.open(link, "_blank", "noopener");
}

async function authorizeWaiter() {
  const email = elements.waiterMemberEmailInput.value.trim();
  const displayName = elements.waiterMemberNameInput.value.trim();
  const station = elements.waiterStationSelect?.value || "waiter";
  const stationLabel = restaurantStationLabel(station);
  if (!email) {
    setWaiterTeamMessage("Escribe el correo del empleado.", "error");
    elements.waiterMemberEmailInput.focus();
    return;
  }
  elements.authorizeWaiterButton.disabled = true;
  setWaiterTeamMessage(`Autorizando ${stationLabel.toLowerCase()}...`);
  try {
    let { data, error } = await cloudState.client.rpc("invite_current_restaurant_staff", {
      p_email: email,
      p_station: station,
      p_display_name: displayName,
    });
    if (error && isMissingRestaurantRpc(error)) {
      ({ data, error } = await cloudState.client.rpc("grant_current_restaurant_staff", {
        p_email: email,
        p_station: station,
        p_display_name: displayName,
      }));
    }
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    elements.waiterMemberEmailInput.value = "";
    elements.waiterMemberNameInput.value = "";
    setWaiterTeamMessage(
      result?.pending
        ? `Invitacion guardada para ${email}. Comparte el enlace; el permiso se activara cuando cree o confirme su cuenta.`
        : `${stationLabel} autorizado. Ya puede entrar desde su telefono.`,
      "ok"
    );
    await loadWaiterMembers();
    showToast(result?.pending ? "Invitacion de personal guardada." : `${stationLabel} autorizado correctamente.`);
  } catch (error) {
    setWaiterTeamMessage(waiterMembershipError(error), "error");
  } finally {
    elements.authorizeWaiterButton.disabled = false;
  }
}

async function toggleWaiterMembership(memberId, memberEmail, station, nextActive, pending = false) {
  let { error } = await cloudState.client.rpc("set_current_restaurant_staff_access", {
    p_member_user_id: memberId || null,
    p_email: memberEmail || "",
    p_station: station,
    p_active: nextActive,
  });
  if (error && isMissingRestaurantRpc(error) && memberId) {
    ({ error } = await cloudState.client.rpc("set_current_restaurant_staff_active", {
      p_member_user_id: memberId,
      p_station: station,
      p_active: nextActive,
    }));
  }
  if (error) {
    setWaiterTeamMessage(waiterMembershipError(error), "error");
    return;
  }
  const label = restaurantStationLabel(station);
  showToast(pending ? "Invitacion cancelada." : nextActive ? `${label} reactivado.` : `${label} desactivado.`);
  await loadWaiterMembers();
}

async function confirmWaiterInvitation(memberEmail, station, displayName) {
  setWaiterTeamMessage("Confirmando autorizacion en la nube...");
  let { data, error } = await cloudState.client.rpc("confirm_current_restaurant_staff_invitation", {
    p_email: memberEmail,
  });
  if (error && isMissingRestaurantRpc(error)) {
    ({ data, error } = await cloudState.client.rpc("invite_current_restaurant_staff", {
      p_email: memberEmail,
      p_station: station,
      p_display_name: displayName || "",
    }));
  }
  if (error) {
    setWaiterTeamMessage(waiterMembershipError(error), "error");
    return false;
  }
  const result = Array.isArray(data) ? data[0] : data;
  const confirmedTeam = await loadWaiterMembers();
  if (result?.pending) {
    setWaiterTeamMessage(
      `La invitacion sigue pendiente. Confirma que ${memberEmail} haya creado y confirmado su cuenta con ese mismo correo.`,
      "error"
    );
    return false;
  }
  const normalizedEmail = String(memberEmail || "").trim().toLowerCase();
  const confirmedMember = confirmedTeam?.find(
    (row) => String(row.member_email || "").trim().toLowerCase() === normalizedEmail && row.active === true && row.pending !== true
  );
  if (!result?.active || !confirmedMember) {
    setWaiterTeamMessage("La nube no confirmo la autorizacion activa. Actualiza la lista e intenta nuevamente.", "error");
    return false;
  }
  setWaiterTeamMessage(`${restaurantStationLabel(station)} autorizado correctamente. Ya puede entrar desde su dispositivo.`, "ok");
  showToast("Personal autorizado correctamente.");
  return true;
}

async function openClientOrdersDialog() {
  if (!cloudState.configured) {
    alert("La conexion de la nube no esta disponible. Intenta nuevamente antes de recibir pedidos.");
    return;
  }
  if (!cloudState.user) {
    alert("Inicia sesion para ver pedidos recibidos.");
    openSignInScreen();
    return;
  }
  elements.clientOrdersDialog.showModal();
  renderClientOrders();
  try {
    await refreshClientOrders();
  } catch (error) {
    console.error(error);
  }
}

function syncPendingData(options = {}) {
  const { allowWhileLoading = false } = options;
  if (!cloudState.client || !cloudState.user || !navigator.onLine) {
    updateCloudStatus();
    return Promise.resolve(false);
  }

  if (pendingDataSyncInFlight) {
    return pendingDataSyncInFlight;
  }

  if (cloudState.syncing) {
    pendingDataSyncRequested = true;
    return Promise.resolve(false);
  }

  if (cloudState.loading && !allowWhileLoading) {
    pendingDataSyncRequested = true;
    return Promise.resolve(false);
  }

  const retryDelay = pendingDataSyncRetryNotBefore - Date.now();
  if (retryDelay > 0) {
    pendingDataSyncRequested = true;
    schedulePendingDataSyncRetry(retryDelay);
    return Promise.resolve(false);
  }

  const operation = runPendingDataSync(options);
  pendingDataSyncInFlight = operation;
  operation.finally(() => {
    if (pendingDataSyncInFlight === operation) pendingDataSyncInFlight = null;
  });
  return operation;
}

function schedulePendingDataSyncRetry(delayMs = 5000) {
  const normalizedDelay = Math.max(
    0,
    Number(delayMs) || 0
  );

  const requestedDueAt =
    Math.max(Date.now() + normalizedDelay, pendingDataSyncRetryNotBefore);

  /*
   * Si ya existe un reintento igual o más próximo,
   * no programamos otro.
   */
  if (
    pendingDataSyncRetryTimer !== null &&
    pendingDataSyncRetryDueAt >= pendingDataSyncRetryNotBefore &&
    pendingDataSyncRetryDueAt > 0 &&
    pendingDataSyncRetryDueAt <= requestedDueAt
  ) {
    return;
  }

  /*
   * Si el nuevo reintento debe ejecutarse antes,
   * reemplazamos el temporizador anterior.
   */
  if (pendingDataSyncRetryTimer !== null) {
    window.clearTimeout(
      pendingDataSyncRetryTimer
    );

    pendingDataSyncRetryTimer = null;
  }

  pendingDataSyncRetryDueAt =
    requestedDueAt;

  pendingDataSyncRetryTimer =
    window.setTimeout(() => {
      pendingDataSyncRetryTimer = null;
      pendingDataSyncRetryDueAt = 0;

      syncPendingData({
        silent: true,
      }).catch((error) => {
        console.error(
          "No fue posible completar la sincronizacion pendiente.",
          error
        );
      });
    }, Math.max(
      0,
      requestedDueAt - Date.now()
    ));
}
function schedulePendingOrderRecovery(error = null) {
  if (
    !cloudState.client ||
    !cloudState.user ||
    !navigator.onLine
  ) {
    return;
  }

  /*
   * Un conflicto de revisión NO es un error
   * temporal.
   *
   * Reintentarlo automáticamente solamente
   * volvería a ejecutar el mismo RPC con una
   * revisión obsoleta.
   */
  if (
    error &&
    isOrderRevisionConflictError(error)
  ) {
    console.warn(
      "[RC ORDERA] Conflicto de revisión: no se programa reintento automático."
    );

    return;
  }

  /*
   * Los fallos reales de infraestructura sí
   * pueden recuperarse automáticamente.
   */
  if (
    error &&
    isTemporarySyncInfrastructureError(error)
  ) {
    pendingDataSyncRetryNotBefore =
      Math.max(
        pendingDataSyncRetryNotBefore,
        Date.now() +
          SYNC_INFRASTRUCTURE_BACKOFF_MS
      );
  }

  const retryDelay =
    Math.max(
      5000,
      pendingDataSyncRetryNotBefore -
        Date.now()
    );

  schedulePendingDataSyncRetry(
    retryDelay
  );
}
async function runPendingDataSync(options = {}) {
  const { silent = false } = options;
  pendingDataSyncRequested = false;

  const pendingDeletedOrderIds = readDeletedOrderIds();
const allPendingOrders = savedOrders.filter(
  (order) =>
    needsAutomaticCloudSync(order) &&
    !pendingDeletedOrderIds.includes(order.id)
);

const pendingOrders = allPendingOrders.slice(
  0,
  SYNC_ORDER_BATCH_SIZE
);

const hasMorePendingOrders =
  allPendingOrders.length > pendingOrders.length;
  const settingsPendingToken = currentSettingsPendingToken();
  const shouldSyncSettings = Boolean(settingsPendingToken);
  const menuPendingToken = currentMenuPendingToken();
  const shouldSyncMenu = Boolean(menuPendingToken);
  const shouldSyncTicketCounter = pendingTicketCounter();
if (
  !pendingOrders.length &&
  !pendingDeletedOrderIds.length &&
  !shouldSyncSettings &&
  !shouldSyncMenu &&
  !shouldSyncTicketCounter
) {
  cloudState.lastError = "";
  pendingDataSyncRetryNotBefore = 0;

  if (pendingDataSyncRetryTimer !== null) {
  window.clearTimeout(
    pendingDataSyncRetryTimer
  );

  pendingDataSyncRetryTimer = null;
}

pendingDataSyncRetryDueAt = 0;

updateCloudStatus();
return true;
}
  cloudState.syncing = true;
  if (!silent) updateCloudStatus("Sincronizando...");

  try {
  let deferredSyncError = null;

if (shouldSyncSettings) {
  try {
    await saveCloudSettings();

    const cleared =
      clearSettingsPending(
        settingsPendingToken
      );

    if (!cleared) {
      /*
       * Los ajustes cambiaron mientras
       * esta sincronización estaba en curso.
       */
      pendingDataSyncRequested = true;
    }
  } catch (settingsSyncError) {
    /*
     * Un fallo temporal de Supabase debe detener
     * inmediatamente la ronda y aplicar backoff.
     */
    if (
      isTemporarySyncInfrastructureError(
        settingsSyncError
      )
    ) {
      throw settingsSyncError;
    }

    /*
     * Un error lógico de ajustes no debe impedir
     * que los pedidos continúen sincronizándose.
     * El pendiente de ajustes se conserva.
     */
    deferredSyncError =
      settingsSyncError;

    console.error(
      "No fue posible sincronizar los ajustes. Los pedidos continuarán.",
      settingsSyncError
    );
  }
}

if (shouldSyncMenu) {
  try {
    await saveCloudMenu();

    const cleared =
      clearMenuPending(
        menuPendingToken
      );

    if (!cleared) {
      /*
       * El menú cambió mientras se estaba
       * sincronizando y necesita otra ronda.
       */
      pendingDataSyncRequested = true;
    }
  } catch (menuSyncError) {
    /*
     * Un fallo temporal indica que Supabase
     * no está disponible. Detenemos la ronda
     * para no generar más llamadas.
     */
    if (
      isTemporarySyncInfrastructureError(
        menuSyncError
      )
    ) {
      throw menuSyncError;
    }

    /*
     * Un error lógico del menú no puede impedir
     * que los pedidos pendientes se guarden.
     * El menú permanece marcado como pendiente.
     */
    if (!deferredSyncError) {
      deferredSyncError =
        menuSyncError;
    }

    console.error(
      "No fue posible sincronizar el menú. Los pedidos continuarán.",
      menuSyncError
    );
  }
}

if (shouldSyncTicketCounter) {
  try {
    await setCloudNextTicket(
      shouldSyncTicketCounter
    );

    const cleared =
      clearPendingTicketCounter(
        shouldSyncTicketCounter
      );

    if (!cleared) {
      /*
       * El contador cambió durante la operación
       * y necesita una nueva ronda.
       */
      pendingDataSyncRequested = true;
    }
  } catch (ticketCounterSyncError) {
    /*
     * Si Supabase no está disponible, detenemos
     * la ronda para aplicar el backoff general.
     */
    if (
      isTemporarySyncInfrastructureError(
        ticketCounterSyncError
      )
    ) {
      throw ticketCounterSyncError;
    }

    /*
     * Un error lógico del contador no debe impedir
     * que los pedidos pendientes se guarden.
     * El contador permanece pendiente.
     */
    if (!deferredSyncError) {
      deferredSyncError =
        ticketCounterSyncError;
    }

    console.error(
      "No fue posible sincronizar el contador diario. Los pedidos continuarán.",
      ticketCounterSyncError
    );
  }
}
   for (const orderId of pendingDeletedOrderIds) {
  try {
    /*
     * Primero confirmamos la anulación
     * en Supabase.
     */
    await voidCloudOrder(orderId);

    /*
     * Después retiramos la intención
     * de anulación de la cola local.
     *
     * Si localStorage falla, NO fingimos
     * que la operación quedó cerrada.
     */
    const cleared =
      clearDeletedOrderId(orderId);

    if (!cleared) {
      const queueError =
        new Error(
          appUiText(
            "No fue posible confirmar localmente la sincronizacion. Se intentara nuevamente."
          )
        );

      queueError.code =
        "RC_ORDERA_DELETED_ORDER_QUEUE_WRITE_FAILED";

      throw queueError;
    }

    /*
     * Solo cuando nube + cola local están
     * confirmadas marcamos el pedido synced.
     */
    setOrderSyncStatus(
      orderId,
      "synced"
    );
  } catch (error) {
    /*
     * Si el pedido ya no existe en Supabase,
     * el objetivo remoto ya está cumplido.
     * Aun así debemos confirmar la limpieza local.
     */
    if (
      /order not found|pedido no encontrado/i.test(
        String(error?.message || "")
      )
    ) {
      const cleared =
        clearDeletedOrderId(orderId);

      if (!cleared) {
        const queueError =
          new Error(
            appUiText(
              "No fue posible confirmar localmente la sincronizacion. Se intentara nuevamente."
            )
          );

        queueError.code =
          "RC_ORDERA_DELETED_ORDER_QUEUE_WRITE_FAILED";

        throw queueError;
      }

      setOrderSyncStatus(
        orderId,
        "synced"
      );

      continue;
    }

    throw error;
  }
}

let pendingOrderSyncError = null;

/*
 * Antes de volver a escribir un pedido pendiente,
 * comprobamos si esa misma edición ya existe
 * en Supabase.
 *
 * Esto evita reenviar pedidos que sí fueron
 * guardados pero cuya confirmación se perdió.
 */
let pendingOrdersToUpload = pendingOrders;

if (pendingOrders.length) {
  const pendingIds = pendingOrders
    .map((order) => order.id)
    .filter(Boolean);

  const [remoteOrdersResponse, remotePublicationsResponse] =
    await withCloudTimeout(
      [
        cloudState.client
          .from("orders")
          .select("id, order_json, revision")
          .eq("user_id", cloudState.user.id)
          .in("id", pendingIds),
        cloudState.client
          .from("customer_orders")
          .select("id, restaurant_order_id")
          .eq("user_id", cloudState.user.id)
          .in("restaurant_order_id", pendingIds),
      ],
      "No fue posible comprobar los pedidos pendientes en nube a tiempo.",
      8000
    );

  const {
    data: remotePendingRows,
    error: remotePendingError,
  } = remoteOrdersResponse;

  const {
    data: remotePublicationRows,
    error: remotePublicationsError,
  } = remotePublicationsResponse;

  if (remotePendingError) {
    throw remotePendingError;
  }

  if (remotePublicationsError) {
    throw remotePublicationsError;
  }

  const remoteById = new Map(
    (remotePendingRows || []).map(
      (row) => [String(row.id), row]
    )
  );

  const publicationByRestaurantOrderId = new Map(
    (remotePublicationRows || []).map(
      (row) => [String(row.restaurant_order_id), row]
    )
  );

  pendingOrdersToUpload = [];

  for (const order of pendingOrders) {
    const remoteRow =
      remoteById.get(String(order.id));

    const localUpdatedAt =
      String(order.updatedAt || "");

    const remoteUpdatedAt =
      String(
        remoteRow?.order_json?.updatedAt ||
        ""
      );

    /*
     * Mismo ID + mismo updatedAt:
     * es exactamente la edición local que
     * ya consiguió llegar a la nube.
     */
    if (
      remoteRow &&
      localUpdatedAt &&
      remoteUpdatedAt === localUpdatedAt
    ) {
      const publicationRow =
        publicationByRestaurantOrderId.get(String(order.id));
      const parsedRevision =
        Number.parseInt(
          remoteRow.revision,
          10
        );

      const patch = {};

      if (
        Number.isFinite(parsedRevision) &&
        parsedRevision > 0
      ) {
        patch._syncRevision =
          parsedRevision;
      }

      if (publicationRow?.id) {
        patch.customerOrderId = publicationRow.id;
        patch.syncStatus = "synced";
      }

      Object.assign(
        order,
        patch
      );

      savedOrders =
        savedOrders.map(
          (savedOrder) =>
            savedOrder.id === order.id
              ? {
                  ...savedOrder,
                  ...patch,
                }
              : savedOrder
        );

      if (
        currentOrder.id === order.id
      ) {
        Object.assign(
          currentOrder,
          patch
        );
      }

      if (publicationRow?.id) {
        continue;
      }

      /*
       * La fila principal existe, pero la estación todavía
       * no tiene su publicación. Conservamos el pendiente y
       * reutilizamos la revisión confirmada en el RPC atómico.
       */
      pendingOrdersToUpload.push(order);
      continue;
    }

/*
 * Si existe una edición remota diferente,
 * comprobamos también las revisiones.
 *
 * Una revisión remota mayor significa que
 * otro dispositivo ya avanzó el pedido.
 * No podemos volver a enviar nuestra
 * revisión antigua.
 */
if (remoteRow) {
  const remoteRevision =
    Number.parseInt(
      remoteRow.revision,
      10
    );

  const localRevision =
    Number.parseInt(
      order._syncRevision,
      10
    );

 if (
  Number.isFinite(remoteRevision) &&
  remoteRevision > 0 &&
  Number.isFinite(localRevision) &&
  localRevision > 0 &&
  remoteRevision > localRevision
) {
  const conflictBackupSaved =
    saveRevisionConflictBackup(
      order,
      remoteRevision
    );

  if (!conflictBackupSaved) {
    console.error(
      "[RC ORDERA] El conflicto de revisión fue bloqueado, pero no fue posible crear el respaldo local.",
      {
        orderId: order.id,
        localRevision,
        remoteRevision,
      }
    );
  }

  blockOrderRevisionSync(
    order,
    remoteRevision
  );

  continue;
}
}
/*
 * No existe una versión remota más nueva.
 * El pedido todavía puede intentar
 * sincronizarse normalmente.
 */
pendingOrdersToUpload.push(
  order
);
  }

  saveOrders({
    immediate: true,
  });

  saveCurrentOrderDraft();
}

for (const order of pendingOrdersToUpload) {
      try {
        const expectedUpdatedAt = order.updatedAt;
        await withCloudTimeout(
  (signal) =>
    saveCloudOrder(
      order,
      signal
    ),
  "La nube tardó demasiado en sincronizar el pedido pendiente.",
  10000
);
        confirmOrderSyncedIfUnchanged(order.id, expectedUpdatedAt);
     } catch (error) {
  console.error(
    `No fue posible sincronizar el pedido ${order.id}.`,
    error
  );

  if (isTemporarySyncInfrastructureError(error)) {
    pendingOrderSyncError = error;
    break;
  }

  if (!pendingOrderSyncError) {
    pendingOrderSyncError = error;
  }
}
    }

if (pendingOrderSyncError) {
  throw pendingOrderSyncError;
}

if (deferredSyncError) {
  throw deferredSyncError;
}

const highestLocalTicketToday = savedOrders
      .filter((order) => orderBusinessDate(order) === todayKey)
      .reduce((highest, order) => Math.max(highest, Number(order.ticketNumber) || 0), 0);
    const minimumNextTicket = Math.max(nextTicket, highestLocalTicketToday + 1);
    await advanceCloudTicketCounter(minimumNextTicket);
    nextTicket = minimumNextTicket;
    saveTicketState();
    saveOrders({ immediate: true });
    cloudState.lastError = "";
pendingDataSyncRetryNotBefore = 0;

if (
  (hasMorePendingOrders || savedOrders.some((order) =>
    needsAutomaticCloudSync(order) && !pendingDeletedOrderIds.includes(order.id)
  )) &&
  hasPendingDataToSync()
) {
  schedulePendingDataSyncRetry(
    SYNC_ORDER_BATCH_DELAY_MS
  );
}

renderOrder();
    renderHistory();
    updateCloudStatus();
    return true;
 } catch (error) {
  console.error(error);

  if (isTemporarySyncInfrastructureError(error)) {
    pendingDataSyncRetryNotBefore =
      Date.now() + SYNC_INFRASTRUCTURE_BACKOFF_MS;

    pendingDataSyncRequested = true;
  }

  saveOrders({ immediate: true });
  setCloudError(error);
  return false;

} finally {
    cloudState.syncing = false;
    if (
      pendingDataSyncRequested &&
      hasPendingDataToSync() &&
      cloudState.client &&
      cloudState.user &&
      navigator.onLine
    ) {
      pendingDataSyncRequested = false;
      schedulePendingDataSyncRetry(
        Math.max(
          5000,
          pendingDataSyncRetryNotBefore - Date.now(),
          pendingDataSyncRetryDueAt - Date.now()
        )
      );
    }
  }
}
async function signInWithEmail() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || !password) {
    elements.authMessage.textContent = t("auth.enterCredentials");
    return;
  }

   elements.authMessage.textContent = t("auth.signingIn");
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
    elements.authMessage.textContent = t("auth.invalidRegister");
    return;
  }

  elements.authMessage.textContent = t("auth.detectingRegion");
  const registrationCoords = await registrationPosition();
  const detectedRegion = detectRegionalDefaults(registrationCoords);
  restaurantRegistrationRegion = {
    ...restaurantRegistrationRegion,
    ...detectedRegion,
    countryCode: normalizeTextSetting(elements.authCountryCodeInput?.value || detectedRegion.countryCode).toUpperCase(),
    city: normalizeTextSetting(elements.authCityInput?.value || restaurantRegistrationRegion.city),
    region: normalizeTextSetting(elements.authRegionInput?.value || restaurantRegistrationRegion.region),
    postalCode: normalizeTextSetting(elements.authPostalCodeInput?.value || restaurantRegistrationRegion.postalCode),
  };
  restaurantRegistrationRegion.country = restaurantRegistrationRegion.countryCode === "PL"
    ? "Polonia"
    : restaurantRegistrationRegion.countryCode === "CO"
      ? "Colombia"
      : restaurantRegistrationRegion.country;
  restaurantRegistrationRegion.timezone = restaurantRegistrationRegion.countryCode === "PL"
    ? "Europe/Warsaw"
    : restaurantRegistrationRegion.countryCode === "CO"
      ? "America/Bogota"
      : detectedRegion.timezone;
  if (elements.authCountryCodeInput && !elements.authCountryCodeInput.value) {
    elements.authCountryCodeInput.value = restaurantRegistrationRegion.countryCode;
  }
  renderRestaurantRegionSuggestions(restaurantRegistrationRegion.countryCode);
  const detectedCountryMatchesSelection = !detectedRegion.countryCode
    || detectedRegion.countryCode === restaurantRegistrationRegion.countryCode;
  if (registrationCoords && detectedCountryMatchesSelection) {
    restaurantLatitude = Number(registrationCoords.latitude);
    restaurantLongitude = Number(registrationCoords.longitude);
  } else if (!detectedCountryMatchesSelection) {
    restaurantRegistrationRegion.latitude = null;
    restaurantRegistrationRegion.longitude = null;
  }
  const profile = restaurantSignupProfileFromInputs(email);
 if (!["PL", "CO"].includes(profile.countryCode)) {
  elements.authMessage.textContent = t("auth.selectCountry");
    elements.authCountryCodeInput?.focus();
    return;
  }
  if (!profile.region) {
    elements.authMessage.textContent = t("auth.enterRegion");
    elements.authRegionInput?.focus();
    return;
  }
  if (!profile.city) {
   elements.authMessage.textContent = t("auth.enterCity");
    elements.authCityInput?.focus();
    return;
  }
  if (!normalizeTextSetting(elements.authRestaurantNameInput?.value || "")) {
    elements.authMessage.textContent = t("auth.enterRestaurantName");
    elements.authRestaurantNameInput?.focus();
    return;
  }
  if (!profile.legalBusinessName) {
    elements.authMessage.textContent = t("auth.enterLegalName");
    elements.authLegalNameInput?.focus();
    return;
  }
  if (!profile.legalAddress) {
    elements.authMessage.textContent = t("auth.enterLegalAddress");
    elements.authLegalAddressInput?.focus();
    return;
  }
  if (!profile.businessPhone) {
    elements.authMessage.textContent = t("auth.enterBusinessPhone");
    elements.authBusinessPhoneInput?.focus();
    return;
  }
  if (!profile.ownerName) {
    elements.authMessage.textContent = t("auth.enterOwnerName");
    elements.authOwnerNameInput?.focus();
    return;
  }
  if (!profile.legalConsent) {
    elements.authMessage.textContent = "Debes confirmar que puedes administrar el restaurante y aceptar el tratamiento tecnico de datos.";
    elements.authLegalConsentInput?.focus();
    return;
  }
  if (await restaurantNameAlreadyExists(profile.businessName)) {
    elements.authMessage.textContent = t("auth.restaurantNameExists");
    elements.authRestaurantNameInput?.focus();
    return;
  }

  applyRestaurantProfile(profile, { onlyIfEmpty: false });
  elements.authMessage.textContent = t("auth.creatingAccount");
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
          country_code: profile.countryCode,
          country: profile.country,
          city: profile.city,
          region: profile.region,
          postal_code: profile.postalCode,
          timezone: profile.timezone,
          preferred_language: profile.preferredLanguage,
          registration_latitude: profile.latitude,
          registration_longitude: profile.longitude,
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

elements.authMessage.textContent = t("auth.accountCreated");
  elements.authPassword.value = "";
}

async function sendPasswordResetEmail() {
  const email = elements.authEmail.value.trim();
  if (!email) {
    elements.authMessage.textContent = t("auth.enterRecoveryEmail");
    elements.authEmail.focus();
    return;
  }

  if (!cloudState.client) {
   elements.authMessage.textContent = t("auth.cloudConnectionError");
    return;
  }

  elements.authMessage.textContent = t("auth.sendingRecovery");
  const redirectTo = window.location.href.split("#")[0].split("?")[0];

  try {
    const { error } = await cloudState.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
   elements.authMessage.textContent = t("auth.recoveryEmailSent");
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
  }
}

async function resendVerificationEmail() {
  const email = elements.authEmail.value.trim();
  if (!email) {
    elements.authMessage.textContent = t("auth.enterVerificationEmail");
    elements.authEmail.focus();
    return;
  }

  if (!cloudState.client) {
    elements.authMessage.textContent = t("auth.cloudConnectionError");
    return;
  }

  elements.authMessage.textContent = t("auth.resendingVerification");
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
    elements.authMessage.textContent = t("auth.verificationResent");
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
      const loadResult = await loadCloudData();
      if (!loadResult?.ok) {
        showToast(loadResult?.message || "La nube sigue pendiente. El pedido actual esta conservado.");
        return;
      }
      if (loadResult.warning) {
        showToast("Nube conectada. La recepcion de pedidos de clientes aun no esta disponible; contacta al soporte de la plataforma.");
        return;
      }
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
  setAuthScreenVisible(true);
  if (elements.restaurantAuthDialog?.showModal && !elements.restaurantAuthDialog.open) {
    elements.restaurantAuthDialog.showModal();
  }
  elements.passwordRecoveryPanel.hidden = false;
  if (elements.restaurantAuthTitle) elements.restaurantAuthTitle.textContent = "Nueva contrasena";
  elements.authPassword.closest("label").hidden = true;
  elements.signInButton.hidden = true;
  elements.signUpButton.hidden = true;
  elements.resetPasswordButton.hidden = true;
  renderCloudState("RC ORDERA verifico el enlace. Escribe tu nueva contrasena.");
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
    elements.authMessage.textContent = t("auth.cloudConnectionError");
    return;
  }

  elements.authMessage.textContent = "Guardando nueva contrasena...";
  try {
    const { error } = await cloudState.client.auth.updateUser({ password });
    if (error) {
      elements.authMessage.textContent = friendlyAuthError(error);
      return;
    }
    hidePasswordRecoveryForm("Contrasena actualizada. Ya puedes iniciar sesion en RC ORDERA.");
  } catch (error) {
    elements.authMessage.textContent = friendlyAuthError(error);
  }
}

function friendlyAuthError(error) {
  const message = error?.message || String(error || "");
  if (message.toLowerCase().includes("invalid path specified")) {
    return "La direccion del servicio en la nube no es valida. Revisa la configuracion de la aplicacion.";
  }
  if (/email not confirmed/i.test(message)) {
    return "RC ORDERA envio un correo de verificacion. Revisa tu correo, confirma la cuenta y vuelve a iniciar sesion.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Correo o contrasena incorrectos.";
  }

  return message;
}

async function signOut() {
  if (!cloudState.client) return;
  const hasPendingChanges = pendingOrdersCount() > 0 || pendingDeletedOrdersCount() > 0 || hasPendingSettings() || hasPendingMenu() || pendingTicketCounter() > 0;
  if (hasPendingChanges && !navigator.onLine) {
    alert("Hay cambios pendientes de sincronizar. Recupera la conexion antes de cerrar sesion para no perderlos.");
    return;
  }
  if (hasPendingChanges) {
    const synchronized = await syncPendingData({ silent: true, allowWhileLoading: true });
    if (!synchronized || pendingOrdersCount() > 0 || pendingDeletedOrdersCount() > 0 || hasPendingSettings() || hasPendingMenu() || pendingTicketCounter() > 0) {
      alert("No fue posible confirmar todos los cambios en la nube. La sesion sigue abierta para que puedas reintentar.");
      return;
    }
  }
  try {
    await cloudState.client.auth.signOut({ scope: "local" });
  } catch (error) {
    console.error(error);
    alert("No fue posible cerrar la sesion. Revisa la conexion e intenta nuevamente.");
    return;
  }
  cloudState.user = null;
  cloudState.ready = false;
  pendingClientOrders = [];
  stopClientOrdersPolling();
  stopClientOrdersRealtime();
  stopCentralRealtime();
  stopClientAlarm();
  clearRememberedCloudSession();
  clearRestaurantLocalData();
  updateClientOrdersBadge();
  window.location.replace(`index.html?app=${APP_VERSION}`);
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

function isInlineRestaurantImage(value) {
  return /^data:image\/(?:jpeg|png|webp);base64,/i.test(normalizeProductImageUrl(value));
}

function restaurantImageDataUrlToBlob(value) {
  const dataUrl = normalizeProductImageUrl(value);
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i);
  if (!match) throw new Error("La imagen preparada no tiene un formato valido.");
  const binary = window.atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1].toLowerCase() });
}

function restaurantMediaPathSegment(value, fallback = "image") {
  const clean = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

async function uploadRestaurantImageDataUrl(dataUrl, scope, itemId) {
  if (!isInlineRestaurantImage(dataUrl)) {
    return normalizeProductImageUrl(dataUrl);
  }

  if (!cloudState.client) {
    throw new Error(appUiText("Supabase no está disponible."));
  }

  if (!navigator.onLine) {
    throw new Error(appUiText("Necesitas conexión a internet para subir la foto."));
  }

  // Refrescar usuario real antes de subir.
  const {
    data: authData,
    error: authError
  } = await cloudState.client.auth.getUser();

  if (authError) {
    console.error("RC ORDERA AUTH ERROR", authError);
    throw authError;
  }

  const authenticatedUser = authData?.user;

  if (!authenticatedUser?.id) {
    throw new Error(appUiText("La sesión no está disponible. Inicia sesión nuevamente."));
  }

  // Mantener cloudState sincronizado.
  cloudState.user = authenticatedUser;

  const blob = restaurantImageDataUrlToBlob(dataUrl);

  if (blob.size > 2 * 1024 * 1024) {
    throw new Error(
      appUiText("La imagen optimizada supera el límite permitido de 2 MB.")
    );
  }

  const extension =
    blob.type === "image/png"
      ? "png"
      : blob.type === "image/webp"
        ? "webp"
        : "jpg";

  const fingerprint = hashText(
    `${blob.type}|${blob.size}|${dataUrl}`
  );

  const cleanScope = restaurantMediaPathSegment(
    scope,
    "media"
  );

  const cleanItemId = restaurantMediaPathSegment(
    itemId,
    "image"
  );

  const path =
    `${authenticatedUser.id}/` +
    `${cleanScope}/` +
    `${cleanItemId}-${fingerprint}.${extension}`;

  console.log("RC ORDERA STORAGE UPLOAD START", {
    bucket: RESTAURANT_MEDIA_BUCKET,
    path,
    type: blob.type,
    size: blob.size,
    userId: authenticatedUser.id
  });

  let uploadResult;

  try {
    uploadResult = await withCloudTimeout(
      cloudState.client.storage
        .from(RESTAURANT_MEDIA_BUCKET)
        .upload(path, blob, {
          cacheControl: "31536000",
          contentType: blob.type,
          upsert: true
        }),
      "La foto no pudo terminar de subir a la nube.",
      30000
    );
  } catch (error) {
    console.error(
      "RC ORDERA STORAGE UPLOAD TIMEOUT/EXCEPTION",
      {
        message: error?.message,
        name: error?.name,
        error
      }
    );

    throw error;
  }

  const { data: uploadData, error: uploadError } =
    uploadResult || {};

  if (uploadError) {
    console.error(
      "RC ORDERA STORAGE UPLOAD ERROR",
      {
        message: uploadError.message,
        name: uploadError.name,
        statusCode:
          uploadError.statusCode ||
          uploadError.status,
        error: uploadError
      }
    );

    if (
      /bucket|not found|404/i.test(
        String(uploadError.message || "")
      )
    ) {
      throw new Error(
        appUiText("El almacenamiento de fotos no está disponible.")
      );
    }

    throw uploadError;
  }

  console.log(
    "RC ORDERA STORAGE UPLOAD OK",
    uploadData
  );

  const { data: publicData } =
    cloudState.client.storage
      .from(RESTAURANT_MEDIA_BUCKET)
      .getPublicUrl(path);

  const publicUrl =
    normalizeProductImageUrl(
      publicData?.publicUrl
    );

  if (
    !publicUrl ||
    !/^https?:\/\//i.test(publicUrl) ||
    !publicUrl.includes(
      "/storage/v1/object/public/restaurant-media/"
    )
  ) {
    console.error(
      "RC ORDERA INVALID PUBLIC IMAGE URL",
      {
        path,
        publicUrl,
        publicData
      }
    );

    throw new Error(
      appUiText("No fue posible obtener la dirección final de la foto.")
    );
  }

  return publicUrl;
}

async function materializeMenuImagesForCloud(menu) {
  const normalized = normalizeMenuCatalog(menu);
  if (!cloudState.client || !cloudState.user || !navigator.onLine) return normalized;

  const pendingImages = [];
  Object.entries(normalized).forEach(([category, products]) => {
    products.forEach((product) => {
      if (isInlineRestaurantImage(product.imageUrl)) pendingImages.push({ category, product });
    });
  });

  for (let index = 0; index < pendingImages.length; index += 3) {
    const batch = pendingImages.slice(index, index + 3);
    await Promise.all(batch.map(async ({ category, product }) => {
      product.imageUrl = await uploadRestaurantImageDataUrl(
        product.imageUrl,
        "products",
        product.id || stableProductId(category, product.name, product.description)
      );
    }));
  }
  return normalized;
}

function menuHasInlineRestaurantImages(menu) {
  return Object.values(normalizeMenuCatalog(menu)).some((products) =>
    products.some((product) => isInlineRestaurantImage(product.imageUrl))
  );
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
const CORE_MENU_LANGUAGES = [
  "es",
  "pl",
  "en",
];

function normalizeLanguageCode(value) {
  const raw =
    String(value || "")
      .trim()
      .replace(/_/g, "-");

  if (!raw) {
    return "es";
  }

  try {
    const [canonical] =
      Intl.getCanonicalLocales(raw);

    return String(
      canonical || "es"
    ).toLowerCase();
  } catch {
    const basicLanguage =
      raw
        .split("-")[0]
        .toLowerCase();

    return /^[a-z]{2,3}$/.test(
      basicLanguage
    )
      ? basicLanguage
      : "es";
  }
}

function normalizeMenuLanguage(value) {
  return normalizeLanguageCode(value);
}

function normalizeProductTranslations(
  product = {},
  fallbackName = "",
  fallbackDescription = ""
) {
  const source =
    product?.translations &&
    typeof product.translations === "object" &&
    !Array.isArray(product.translations)
      ? product.translations
      : {};

  const translations = {};

  /*
   * Conservamos TODOS los idiomas
   * que ya existan en el producto.
   *
   * Ejemplos:
   * es
   * pl
   * en
   * de
   * fr
   * it
   * pt-BR
   * uk
   * ar
   * etc.
   */
  Object.entries(source).forEach(
    ([language, translation]) => {
      if (
        !translation ||
        typeof translation !== "object" ||
        Array.isArray(translation)
      ) {
        return;
      }

      const normalizedLanguage =
        normalizeLanguageCode(language);

      translations[
        normalizedLanguage
      ] = {
        name:
          String(
            translation.name || ""
          ).trim(),

        description:
          normalizeProductDescription(
            translation.description || ""
          ),
      };
    }
  );

  /*
   * Español es nuestro idioma base
   * para productos antiguos.
   */
  if (!translations.es) {
    translations.es = {
      name: "",
      description: "",
    };
  }

  if (!translations.es.name) {
    translations.es.name =
      String(
        fallbackName || ""
      ).trim();
  }

  if (
    !translations.es.description
  ) {
    translations.es.description =
      normalizeProductDescription(
        fallbackDescription
      );
  }

  /*
   * Mantenemos preparados también
   * nuestros idiomas principales.
   */
  CORE_MENU_LANGUAGES.forEach(
    (language) => {
      if (!translations[language]) {
        translations[language] = {
          name: "",
          description: "",
        };
      }
    }
  );

  return translations;
}

function currentAppLanguage() {
  const savedLanguage =
    String(
     localStorage.getItem(
  STORAGE_KEYS.appLanguage
) || ""
    ).trim();

  if (savedLanguage) {
    return normalizeLanguageCode(
      savedLanguage
    );
  }

  const metadata =
    cloudState.user?.user_metadata ||
    {};

  const userLanguage =
    metadata.preferred_language ||
    metadata.preferredLanguage ||
    "";

  if (userLanguage) {
    return normalizeLanguageCode(
      userLanguage
    );
  }

  if (
    restaurantRegistrationRegion
      ?.preferredLanguage
  ) {
    return normalizeLanguageCode(
      restaurantRegistrationRegion
        .preferredLanguage
    );
  }

  return normalizeLanguageCode(
    navigator.language || "es"
  );
}
function languageDirection(
  language = currentAppLanguage()
) {
  const baseLanguage =
    normalizeLanguageCode(language)
      .split("-")[0];

  const rtlLanguages = [
    "ar",
    "he",
    "fa",
    "ur",
  ];

  return rtlLanguages.includes(
    baseLanguage
  )
    ? "rtl"
    : "ltr";
}

function applyDocumentLanguage(
  language = currentAppLanguage()
) {
  const normalizedLanguage =
    normalizeLanguageCode(language);

  document.documentElement.lang =
    normalizedLanguage;

  document.documentElement.dir =
    languageDirection(
      normalizedLanguage
    );

  return normalizedLanguage;
}

function setAppLanguage(language) {
  const normalizedLanguage =
    normalizeLanguageCode(language);

  localStorage.setItem(
    STORAGE_KEYS.appLanguage,
    normalizedLanguage
  );

  applyDocumentLanguage(
    normalizedLanguage
  );

  return normalizedLanguage;
}
function currentMenuLanguage() {
  return currentAppLanguage();
}

function languageFallbacks(
  language = currentAppLanguage()
) {
  const normalized =
    normalizeLanguageCode(language);

  const baseLanguage =
    normalized.split("-")[0];

  return Array.from(
    new Set([
      normalized,
      baseLanguage,
      "es",
    ])
  );
}
const UI_TRANSLATIONS = {
  es: {
    "common.loading": "Cargando...",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.close": "Cerrar",
    "common.edit": "Editar",
    "common.delete": "Eliminar",
    "common.yes": "Sí",
    "common.no": "No",

    "order.new": "Nuevo pedido",
    "order.save": "Guardar pedido",
    "order.cancel": "Cancelar pedido",

    "restaurant.open": "Abrir restaurante",
    "restaurant.close": "Cerrar restaurante",

    "auth.signingIn": "Iniciando sesión...",
    "auth.enterCredentials": "Escribe correo y contraseña.",
    "auth.invalidRegister": "Usa un correo y una contraseña de mínimo 6 caracteres.",
    "auth.detectingRegion": "Detectando país e idioma...",
    "auth.selectCountry": "Selecciona Colombia o Polonia.",
"auth.enterRegion": "Escribe o selecciona el departamento o voivodato.",
"auth.enterCity": "Escribe la ciudad, municipio, pueblo, corregimiento, vereda o localidad.",
"auth.enterRestaurantName": "Escribe el nombre comercial del restaurante para registrarlo.",
"auth.enterLegalName": "Escribe la razón social o nombre legal de la empresa.",
"auth.enterLegalAddress": "Escribe la dirección legal o dirección del punto.",
"auth.enterBusinessPhone": "Escribe el teléfono del restaurante.",
"auth.enterOwnerName": "Escribe el nombre del responsable o administrador.",
"auth.acceptLegalConsent": "Debes confirmar que puedes administrar el restaurante y aceptar el tratamiento técnico de datos.",
"auth.restaurantNameExists": "Ya existe un restaurante activo con ese nombre. Usa un nombre diferente o inicia sesión con la cuenta correcta.",
"auth.creatingAccount": "Creando cuenta...",
    "auth.accountCreated": "Cuenta del restaurante creada. RC ORDERA te envió un correo de verificación. Abre ese correo, confirma la cuenta y después inicia sesión.",
"auth.enterRecoveryEmail": "Escribe tu correo electrónico para recuperar la contraseña.",
"auth.cloudConnectionError": "No se pudo conectar con la nube. Revisa internet.",
"auth.sendingRecovery": "RC ORDERA está enviando el correo de recuperación...",
"auth.recoveryEmailSent": "Correo enviado por RC ORDERA. Abre el enlace del correo para crear una contraseña nueva.",
"auth.enterVerificationEmail": "Escribe tu correo electrónico para reenviar la verificación.",
"auth.resendingVerification": "RC ORDERA está reenviando el correo de verificación...",
"auth.verificationResent": "Correo de verificación reenviado por RC ORDERA. Revisa la bandeja de entrada, spam o promociones.",
  },

  pl: {
    "common.loading": "Ładowanie...",
    
    "common.save": "Zapisz",
    "common.cancel": "Anuluj",
    "common.close": "Zamknij",
    "common.edit": "Edytuj",
    "common.delete": "Usuń",
    "common.yes": "Tak",
    "common.no": "Nie",

    "order.new": "Nowe zamówienie",
    "order.save": "Zapisz zamówienie",
    "order.cancel": "Anuluj zamówienie",

    "restaurant.open": "Otwórz restaurację",
    "restaurant.close": "Zamknij restaurację",

    "auth.signingIn": "Logowanie...",
    "auth.enterCredentials": "Wpisz adres e-mail i hasło.",
    "auth.invalidRegister": "Wpisz adres e-mail i hasło składające się z co najmniej 6 znaków.",
    "auth.detectingRegion": "Wykrywanie kraju i języka...",
    "auth.selectCountry": "Wybierz Kolumbię lub Polskę.",
"auth.enterRegion": "Wpisz lub wybierz departament albo województwo.",
"auth.enterCity": "Wpisz miasto, gminę, miejscowość lub inną lokalizację.",
"auth.enterRestaurantName": "Wpisz nazwę handlową restauracji.",
"auth.enterLegalName": "Wpisz nazwę prawną firmy.",
"auth.enterLegalAddress": "Wpisz adres prawny firmy lub adres lokalu.",
"auth.enterBusinessPhone": "Wpisz numer telefonu restauracji.",
"auth.enterOwnerName": "Wpisz imię i nazwisko osoby odpowiedzialnej lub administratora.",
"auth.acceptLegalConsent": "Potwierdź, że masz prawo zarządzać restauracją i zaakceptuj techniczne przetwarzanie danych.",
"auth.restaurantNameExists": "Aktywna restauracja o tej nazwie już istnieje. Użyj innej nazwy lub zaloguj się na właściwe konto.",
"auth.creatingAccount": "Tworzenie konta...",
    "auth.accountCreated": "Konto restauracji zostało utworzone. RC ORDERA wysłało wiadomość e-mail z linkiem weryfikacyjnym. Otwórz wiadomość, potwierdź konto, a następnie się zaloguj.",
"auth.enterRecoveryEmail": "Wpisz swój adres e-mail, aby odzyskać hasło.",
"auth.cloudConnectionError": "Nie udało się połączyć z chmurą. Sprawdź połączenie z internetem.",
"auth.sendingRecovery": "RC ORDERA wysyła wiadomość e-mail do odzyskania hasła...",
"auth.recoveryEmailSent": "Wiadomość została wysłana przez RC ORDERA. Otwórz link w wiadomości, aby ustawić nowe hasło.",
"auth.enterVerificationEmail": "Wpisz swój adres e-mail, aby ponownie wysłać wiadomość weryfikacyjną.",
"auth.resendingVerification": "RC ORDERA ponownie wysyła wiadomość weryfikacyjną...",
"auth.verificationResent": "Wiadomość weryfikacyjna została ponownie wysłana przez RC ORDERA. Sprawdź skrzynkę odbiorczą, spam lub zakładkę Oferty.",
  },

  en: {
    "common.loading": "Loading...",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.yes": "Yes",
    "common.no": "No",

    "order.new": "New order",
    "order.save": "Save order",
    "order.cancel": "Cancel order",

    "restaurant.open": "Open restaurant",
    "restaurant.close": "Close restaurant",

    "auth.signingIn": "Signing in...",
    "auth.enterCredentials": "Enter your email address and password.",
    "auth.invalidRegister": "Enter an email address and a password of at least 6 characters.",
    "auth.detectingRegion": "Detecting country and language...",
    "auth.selectCountry": "Select Colombia or Poland.",
"auth.enterRegion": "Enter or select the department or voivodeship.",
"auth.enterCity": "Enter the city, municipality, town, village, district, or locality.",
"auth.enterRestaurantName": "Enter the restaurant's business name.",
"auth.enterLegalName": "Enter the company's legal name.",
"auth.enterLegalAddress": "Enter the company's legal address or restaurant address.",
"auth.enterBusinessPhone": "Enter the restaurant phone number.",
"auth.enterOwnerName": "Enter the name of the person responsible or administrator.",
"auth.acceptLegalConsent": "Confirm that you are authorized to manage the restaurant and accept the technical processing of data.",
"auth.restaurantNameExists": "An active restaurant with that name already exists. Use a different name or sign in with the correct account.",
"auth.creatingAccount": "Creating account...",
    "auth.accountCreated": "The restaurant account has been created. RC ORDERA sent you a verification email. Open the email, confirm your account, and then sign in.",
"auth.enterRecoveryEmail": "Enter your email address to recover your password.",
"auth.cloudConnectionError": "Could not connect to the cloud. Check your internet connection.",
"auth.sendingRecovery": "RC ORDERA is sending the password recovery email...",
"auth.recoveryEmailSent": "Email sent by RC ORDERA. Open the link in the email to create a new password.",
"auth.enterVerificationEmail": "Enter your email address to resend the verification email.",
"auth.resendingVerification": "RC ORDERA is resending the verification email...",
"auth.verificationResent": "Verification email resent by RC ORDERA. Check your inbox, spam, or promotions folder.",
    
  },
};
/*
 * Permite agregar traducciones para
 * CUALQUIER idioma sin modificar
 * el funcionamiento del motor.
 *
 * Ejemplos:
 * pl
 * en
 * de
 * fr
 * it
 * uk
 * ar
 * ja
 * etc.
 */
function registerUiTranslations(
  language,
  messages = {}
) {
  const normalizedLanguage =
    normalizeLanguageCode(language);

  const existing =
    UI_TRANSLATIONS[
      normalizedLanguage
    ] &&
    typeof UI_TRANSLATIONS[
      normalizedLanguage
    ] === "object"
      ? UI_TRANSLATIONS[
          normalizedLanguage
        ]
      : {};

  UI_TRANSLATIONS[
    normalizedLanguage
  ] = {
    ...existing,
    ...messages,
  };

  return UI_TRANSLATIONS[
    normalizedLanguage
  ];
}

/*
 * Sustituye variables dentro
 * de una traducción.
 *
 * Ejemplo:
 *
 * "Tienes {{count}} pedidos"
 */
function interpolateTranslation(
  text,
  variables = {}
) {
  return String(text ?? "").replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => {
      if (
        Object.prototype.hasOwnProperty.call(
          variables,
          key
        )
      ) {
        return String(
          variables[key] ?? ""
        );
      }

      return match;
    }
  );
}

/*
 * Motor global de traducción.
 *
 * Ejemplo:
 *
 * t("order.new")
 *
 * También acepta variables:
 *
 * t(
 *   "orders.pending",
 *   { count: 5 }
 * )
 */
function t(
  key,
  variables = {},
  options = {}
) {
  const cleanKey =
    String(key || "").trim();

  if (!cleanKey) {
    return "";
  }

  const language =
    normalizeLanguageCode(
      options.language ||
      currentAppLanguage()
    );

  const fallbacks =
    languageFallbacks(language);

  for (
    const candidateLanguage
    of fallbacks
  ) {
    const dictionary =
      UI_TRANSLATIONS[
        candidateLanguage
      ];

    if (
      !dictionary ||
      typeof dictionary !==
        "object"
    ) {
      continue;
    }

    const translatedText =
      dictionary[cleanKey];

    if (
      typeof translatedText ===
        "string" &&
      translatedText.trim()
    ) {
      return interpolateTranslation(
        translatedText,
        variables
      );
    }
  }

  const fallbackText =
    options.fallback !==
    undefined
      ? options.fallback
      : cleanKey;

  return interpolateTranslation(
    fallbackText,
    variables
  );
}
function productTextForLanguage(
  product,
  field,
  language = currentMenuLanguage()
) {
  const translations =
    normalizeProductTranslations(
      product,
      product?.name || "",
      product?.description || ""
    );

  const cleaner =
    field === "description"
      ? normalizeProductDescription
      : (value) =>
          String(value || "").trim();

  const fallbacks =
    languageFallbacks(language);

  for (
    const candidateLanguage
    of fallbacks
  ) {
    const value =
      cleaner(
        translations[
          candidateLanguage
        ]?.[field]
      );

    if (value) {
      return value;
    }
  }

  return cleaner(
    product?.[field]
  );
}
function normalizeMenuCatalog(menu) {
  const normalized = {};
  const categoriesByKey = new Map();

  Object.entries(menu || {}).forEach(
    ([category, dishes]) => {
      const cleanCategory =
        cleanCategoryName(category);

      if (!cleanCategory) return;

      const categoryKey =
        categoryIdentityKey(
          cleanCategory
        );

      const finalCategory =
        categoriesByKey.get(
          categoryKey
        ) || cleanCategory;

      categoriesByKey.set(
        categoryKey,
        finalCategory
      );

      if (!normalized[finalCategory]) {
        normalized[finalCategory] = [];
      }

      if (!Array.isArray(dishes)) {
        return;
      }

      dishes.forEach((dish) => {
        const originalName =
          String(
            dish?.name || ""
          ).trim();

        const price =
          Number.parseFloat(
            dish?.price
          ) || 0;

        const imageUrl =
          normalizeProductImageUrl(
            dish?.imageUrl ||
            dish?.image ||
            dish?.photo ||
            ""
          );

        const originalDescription =
          normalizeProductDescription(
            dish?.description ||
            dish?.descripcion ||
            dish?.details ||
            ""
          );

        const translations =
          normalizeProductTranslations(
            dish,
            originalName,
            originalDescription
          );

        const name =
          translations.es.name ||
          originalName;

        const description =
          translations.es.description ||
          originalDescription;

        if (!name) return;

        normalized[
          finalCategory
        ].push({
          id:
            normalizeProductId(
              dish?.id ||
              dish?.productId
            ) ||
            stableProductId(
              finalCategory,
              name,
              description
            ),

          name,

          price,

          available:
            dish?.available === false
              ? false
              : true,

          imageUrl,

          description,

          station: normalizeProductStation(
            dish?.station ||
            dish?.preparationStation ||
            dish?.preparation_station
          ),

          /*
           * Traducciones permanentes
           * del producto.
           */
          translations,
        });
      });
    }
  );

  return normalized;
}
function persistMenuCatalogCache() {
  if (menuCachePersistHandle) {
    if (window.cancelIdleCallback) window.cancelIdleCallback(menuCachePersistHandle);
    else window.clearTimeout(menuCachePersistHandle);
  }
  menuCachePersistHandle = null;
  try {
    localStorage.setItem(STORAGE_KEYS.menu, JSON.stringify(menuCatalog));
  } catch (error) {
    console.error("No fue posible actualizar el cache local del menu:", error);
  }
}

function saveMenuCache(options = {}) {
  const immediate = options.immediate === true || !navigator.onLine;
  if (immediate) {
    persistMenuCatalogCache();
    return;
  }
  if (menuCachePersistHandle) return;
  if (window.requestIdleCallback) {
    menuCachePersistHandle = window.requestIdleCallback(persistMenuCatalogCache, { timeout: 1000 });
  } else {
    menuCachePersistHandle = window.setTimeout(persistMenuCatalogCache, 30);
  }
}

function saveMenuCatalog() {
  menuCatalog = normalizeMenuCatalog(menuCatalog);
  markMenuPending();
  saveMenuCache({ immediate: true });

  if (!menuCatalog[activeCategory]) {
    activeCategory = Object.keys(menuCatalog)[0] || "";
  }

  renderCategories();
  renderMenu();
  return saveMenuWhenPossible();
}

function syncResultMessage(successMessage, result = {}) {
  if (result.synced) return successMessage;
  if (result.pending) return `${successMessage} Quedo pendiente de sincronizar cuando vuelva internet.`;
  if (result.localOnly) return `${successMessage} Guardado solo en este equipo porque no hay sesion en nube.`;
  if (result.error) return "No se pudo confirmar en la nube. Se conservo localmente para reintentar.";
  return successMessage;
}

async function saveSettingsWhenPossible(options = {}) {
  const { silent = false } = options;

  const settingsPendingToken =
    currentSettingsPendingToken();

  if (cloudState.user && navigator.onLine) {
    try {
      if (!silent) updateCloudStatus("Guardando nube...");

      await withCloudTimeout(
        saveCloudSettings(),
        "No fue posible confirmar el guardado en nube a tiempo."
      );

     if (settingsPendingToken) {
  clearSettingsPending(
    settingsPendingToken
  );
}

      updateCloudStatus("Sincronizado");
      return { synced: true };
    } catch (error) {
      console.error(error);
      markSettingsPending();
      updateCloudStatus();
      return { pending: shouldQueueForCloud(), error };
    }
  } else if (shouldQueueForCloud()) {
    markSettingsPending();
    updateCloudStatus();
    return { pending: true };
  }
  updateCloudStatus();
  return { localOnly: true };
}

async function saveMenuWhenPossibleNow(options = {}) {
  const { silent = false } = options;

  const menuPendingToken =
    currentMenuPendingToken();

  if (cloudState.user && navigator.onLine) {
    try {
      if (!silent) updateCloudStatus("Guardando menu...");

      await withCloudTimeout(
        saveCloudMenu(),
        "No fue posible confirmar el menu en nube a tiempo."
      );

if (menuPendingToken) {
  clearMenuPending(
    menuPendingToken
  );
}
      updateCloudStatus("Sincronizado");
      return { synced: true };
    } catch (error) {
      console.error(error);
      markMenuPending();
      updateCloudStatus();
      return { pending: shouldQueueForCloud(), error };
    }
  }
  if (shouldQueueForCloud()) {
    markMenuPending();
    updateCloudStatus();
    return { pending: true };
  }
  updateCloudStatus();
  return { localOnly: true };
}

function saveMenuWhenPossible(options = {}) {
  const operation = () => saveMenuWhenPossibleNow(options);
  const queuedOperation = menuSaveQueue.catch(() => {}).then(operation);
  menuSaveQueue = queuedOperation;
  return queuedOperation;
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
  if (elements.authBusinessName) elements.authBusinessName.textContent = PLATFORM_APP_NAME;
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
  document.title = `${PLATFORM_APP_NAME} - Restaurante`;
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute("content", PLATFORM_APP_NAME);
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

function readRestaurantOperationalOpen() {
  return localStorage.getItem(STORAGE_KEYS.restaurantOperationalOpen) === "1";
}

function normalizeRestaurantOperationalMode(value) {
  return String(value || "").trim().toLowerCase() === "schedule" ? "schedule" : "manual";
}

function readRestaurantOperationalMode() {
  return normalizeRestaurantOperationalMode(localStorage.getItem(STORAGE_KEYS.restaurantOperationalMode));
}

function normalizeClockTime(value, fallback) {
  const text = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function normalizeOpeningHours(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    RESTAURANT_WEEK_DAYS.map(([key]) => {
      const row = source[key] && typeof source[key] === "object" ? source[key] : {};
      return [key, {
        enabled: row.enabled === true,
        open: normalizeClockTime(row.open, "09:00"),
        close: normalizeClockTime(row.close, "22:00"),
      }];
    })
  );
}

function readRestaurantOpeningHours() {
  try {
    return normalizeOpeningHours(JSON.parse(localStorage.getItem(STORAGE_KEYS.restaurantOpeningHours) || "{}"));
  } catch {
    return normalizeOpeningHours();
  }
}

function normalizeCoordinate(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function readCoordinate(key) {
  return normalizeCoordinate(localStorage.getItem(key));
}

function storeCoordinate(key, value) {
  const coordinate = normalizeCoordinate(value);
  if (coordinate === null) localStorage.removeItem(key);
  else localStorage.setItem(key, String(coordinate));
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
  return ["disabled", "stripe"].includes(value) ? value : "disabled";
}

function readOnlinePaymentProvider() {
  return normalizeOnlinePaymentProvider(localStorage.getItem(STORAGE_KEYS.onlinePaymentProvider) || "disabled");
}

function readOnlinePaymentNote() {
  return normalizeTextSetting(localStorage.getItem(STORAGE_KEYS.onlinePaymentNote) || "");
}

function readClientAlarmEnabled() {
  localStorage.setItem(
    STORAGE_KEYS.clientAlarmEnabled,
    "1"
  );

  return true;
}
function currentCashierName() {
  const metadata =
    cloudState.user?.user_metadata || {};

  const restaurantProfile =
    metadata.restaurant_profile || {};

  return String(
    shiftServerName ||
    metadata.full_name ||
    metadata.owner_name ||
    restaurantProfile.ownerName ||
    ""
  ).trim();
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

async function saveCurrencySymbol() {
  const saveButtons = [elements.saveCurrencyButton, elements.saveCustomerSettingsButton].filter(Boolean);
  saveButtons.forEach((button) => {
    button.disabled = true;
  });
  try {
    businessName = normalizeBusinessName(elements.businessNameInput?.value || businessName);
    businessLogoUrl = readImageInputPreservingValue(elements.businessLogoUrlInput, businessLogoUrl);
    legalBusinessName = readTextInputPreservingValue(elements.legalBusinessNameInput, legalBusinessName);
    taxId = readTextInputPreservingValue(elements.taxIdInput, taxId);
    businessPhone = readTextInputPreservingValue(elements.businessPhoneInput, businessPhone);
    businessEmail = readTextInputPreservingValue(elements.businessEmailInput, businessEmail);
    legalAddress = readTextInputPreservingValue(elements.legalAddressInput, legalAddress);
    const symbol = elements.currencySymbolInput.value.trim() || "$";
    currencySymbol = symbol;
    currencyPosition = elements.currencyPositionSelect.value === "after" ? "after" : "before";
    moneyFormat = elements.moneyFormatSelect.value === "eu" ? "eu" : "us";
    receiptWidthMm = normalizeReceiptWidth(elements.receiptWidthInput.value);
    deliveryFee = normalizeMoneyValue(elements.deliveryFeeInput.value);
    deliveryMinimumFee = normalizeDeliveryMinimumFee(elements.deliveryMinimumFeeInput?.value);
    restaurantAddress = readTextInputPreservingValue(elements.restaurantAddressInput, restaurantAddress);
    const countryCode = normalizeTextSetting(elements.restaurantCountryCodeInput?.value || restaurantRegistrationRegion.countryCode).toUpperCase();
    restaurantRegistrationRegion = {
      ...restaurantRegistrationRegion,
      countryCode,
      country: countryCode === "PL" ? "Polonia" : countryCode === "CO" ? "Colombia" : restaurantRegistrationRegion.country,
      city: readTextInputPreservingValue(elements.restaurantCityInput, restaurantRegistrationRegion.city),
      region: readTextInputPreservingValue(elements.restaurantRegionInput, restaurantRegistrationRegion.region),
      postalCode: readTextInputPreservingValue(elements.restaurantPostalCodeInput, restaurantRegistrationRegion.postalCode),
      timezone: countryCode === "PL"
        ? "Europe/Warsaw"
        : countryCode === "CO"
          ? "America/Bogota"
          : restaurantRegistrationRegion.timezone,
    };
    googleMapsApiKey = readTextInputPreservingValue(elements.googleMapsApiKeyInput, googleMapsApiKey);
    bankAccount = readTextInputPreservingValue(elements.bankAccountInput, bankAccount);
    bankTransferNote = readTextInputPreservingValue(elements.bankTransferNoteInput, bankTransferNote);
    const requestedOnlineProvider = normalizeOnlinePaymentProvider(elements.onlinePaymentProviderSelect?.value || "disabled");
    if (requestedOnlineProvider === "stripe" && restaurantRegistrationRegion.countryCode !== "PL") {
      throw new Error("Stripe Connect solo esta habilitado para restaurantes de Polonia.");
    }
    if (requestedOnlineProvider === "stripe" && onlinePaymentProvider !== "stripe") {
      const accountReady = await refreshMarketplaceAccountState("status");
      if (!accountReady) {
        throw new Error("Completa primero la verificacion de la cuenta para recibir pagos.");
      }
    }
    onlinePaymentProvider = requestedOnlineProvider;
    onlinePaymentNote = readTextInputPreservingValue(elements.onlinePaymentNoteInput, onlinePaymentNote);
    localStoreCurrentSettings();
    applyBusinessNameToUi();
    renderCurrencySettings();
    renderMenu();
    renderOrder();
    renderHistory();
    if (elements.menuEditorDialog.open) renderMenuEditor();
    if (elements.dailyCloseDialog.open) renderDailyClose(elements.closeDayInput.value || todayKey);
    if (elements.monthlyCloseDialog.open) renderMonthlyClose(elements.closeMonthInput.value || currentMonthKey());
    const result = await saveSettingsWhenPossible();
    showToast(syncResultMessage("Ajustes guardados.", result));
  } catch (error) {
    console.error("No fue posible guardar los ajustes:", error);
    const message = String(error?.message || "");
    alert(/Stripe Connect solo|Completa primero la verificacion/i.test(message)
      ? message
      : "No fue posible guardar los ajustes. Revisa la conexion e intenta nuevamente.");
  } finally {
    saveButtons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function renderRestaurantHours() {
  if (!elements.restaurantHoursGrid) return;
  restaurantOpeningHours = normalizeOpeningHours(restaurantOpeningHours);
  elements.restaurantHoursGrid.innerHTML = RESTAURANT_WEEK_DAYS.map(([key, label]) => {
    const day = restaurantOpeningHours[key];
    return `
      <div class="restaurant-hours-row" data-day="${key}">
        <label class="restaurant-day-toggle">
          <input type="checkbox" data-hours-enabled ${day.enabled ? "checked" : ""} />
          <span>${label}</span>
        </label>
        <label>
          <span>Abrir</span>
          <input type="time" data-hours-open value="${day.open}" ${day.enabled ? "" : "disabled"} />
        </label>
        <label>
          <span>Cerrar</span>
          <input type="time" data-hours-close value="${day.close}" ${day.enabled ? "" : "disabled"} />
        </label>
      </div>
    `;
  }).join("");
}

function readRestaurantHoursFromForm() {
  const nextHours = {};
  elements.restaurantHoursGrid?.querySelectorAll("[data-day]").forEach((row) => {
    const key = row.dataset.day;
    const enabled = Boolean(row.querySelector("[data-hours-enabled]")?.checked);
    const open = normalizeClockTime(row.querySelector("[data-hours-open]")?.value, "09:00");
    const close = normalizeClockTime(row.querySelector("[data-hours-close]")?.value, "22:00");
    if (enabled && open === close) throw new Error(`El horario de ${key} debe tener horas diferentes.`);
    nextHours[key] = { enabled, open, close };
  });
  return normalizeOpeningHours(nextHours);
}

async function saveRestaurantHours() {
  if (elements.saveRestaurantHoursButton) elements.saveRestaurantHoursButton.disabled = true;
  try {
    restaurantOpeningHours = readRestaurantHoursFromForm();
    localStoreCurrentSettings();
    const result = await saveSettingsWhenPossible();
    if (restaurantOperationalMode === "schedule" && result.synced) {
      await syncRestaurantOperationalStatus({ silent: true });
    }
    showToast(syncResultMessage("Horario guardado.", result));
  } catch (error) {
    const message = String(error?.message || "");
    alert(/^El horario de .+ debe tener horas diferentes\.$/i.test(message)
      ? message
      : "Revisa el horario antes de guardar.");
  } finally {
    if (elements.saveRestaurantHoursButton) elements.saveRestaurantHoursButton.disabled = false;
  }
}

function setRestaurantLocationStatus(message = "", type = "") {
  if (!elements.restaurantLocationStatus) return;
  elements.restaurantLocationStatus.textContent = message;
  elements.restaurantLocationStatus.dataset.type = type;
  elements.restaurantLocationStatus.hidden = !message;
}

function loadRestaurantGoogleMaps() {
  if (window.google?.maps?.Geocoder && window.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (!googleMapsApiKey) return Promise.reject(new Error("Configura primero la clave web de Google Maps."));
  if (restaurantMapsScriptPromise) return restaurantMapsScriptPromise;

  restaurantMapsScriptPromise = new Promise((resolve, reject) => {
    const callbackName = `rcOrderaRestaurantMaps_${Date.now()}`;
    const script = document.createElement("script");
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.addEventListener("error", () => {
      delete window[callbackName];
      restaurantMapsScriptPromise = null;
      reject(new Error("No se pudo cargar Google Maps."));
    }, { once: true });
    document.head.appendChild(script);
  });
  return restaurantMapsScriptPromise;
}

function restaurantAddressComponent(result, type, shortName = false) {
  const component = (result?.address_components || []).find((entry) => entry.types.includes(type));
  return component ? String(shortName ? component.short_name : component.long_name).trim() : "";
}

function restaurantPlaceLocality(place) {
  return restaurantAddressComponent(place, "locality")
    || restaurantAddressComponent(place, "postal_town")
    || restaurantAddressComponent(place, "sublocality_level_1")
    || restaurantAddressComponent(place, "sublocality")
    || restaurantAddressComponent(place, "administrative_area_level_2")
    || restaurantAddressComponent(place, "administrative_area_level_3");
}

function applyRestaurantPlace(place, input) {
  if (!place?.address_components?.length) return;
  const countryCode = restaurantAddressComponent(place, "country", true).toUpperCase();
  if (!["PL", "CO"].includes(countryCode)) return;
  const city = restaurantPlaceLocality(place);
  const region = normalizedRestaurantRegion(
    countryCode,
    restaurantAddressComponent(place, "administrative_area_level_1")
  );
  const postalCode = restaurantAddressComponent(place, "postal_code");
  const latitude = place.geometry?.location?.lat?.();
  const longitude = place.geometry?.location?.lng?.();
  const isRegistration = input === elements.authCityInput || input === elements.authLegalAddressInput;
  const countryInput = isRegistration ? elements.authCountryCodeInput : elements.restaurantCountryCodeInput;
  const cityInput = isRegistration ? elements.authCityInput : elements.restaurantCityInput;
  const regionInput = isRegistration ? elements.authRegionInput : elements.restaurantRegionInput;
  const postalInput = isRegistration ? elements.authPostalCodeInput : elements.restaurantPostalCodeInput;
  const addressInput = isRegistration ? elements.authLegalAddressInput : elements.restaurantAddressInput;

  if (countryInput) countryInput.value = countryCode;
  if (cityInput && city) cityInput.value = city;
  if (regionInput && region) regionInput.value = region;
  if (postalInput && postalCode) postalInput.value = postalCode;
  if (addressInput && place.formatted_address && input === addressInput) addressInput.value = place.formatted_address;
  restaurantRegistrationRegion = {
    ...restaurantRegistrationRegion,
    countryCode,
    country: countryCode === "PL" ? "Polonia" : "Colombia",
    city: city || restaurantRegistrationRegion.city,
    region: region || restaurantRegistrationRegion.region,
    postalCode: postalCode || restaurantRegistrationRegion.postalCode,
    timezone: countryCode === "PL" ? "Europe/Warsaw" : "America/Bogota",
    latitude: Number.isFinite(latitude) ? latitude : restaurantRegistrationRegion.latitude,
    longitude: Number.isFinite(longitude) ? longitude : restaurantRegistrationRegion.longitude,
  };
  if (Number.isFinite(latitude)) restaurantLatitude = latitude;
  if (Number.isFinite(longitude)) restaurantLongitude = longitude;
  renderRestaurantRegionSuggestions(countryCode);
}

async function prepareRestaurantPlaceAutocomplete() {
  if (!googleMapsApiKey) return;
  await loadRestaurantGoogleMaps();
  const pairs = [
    [elements.authCityInput, elements.authCountryCodeInput],
    [elements.authLegalAddressInput, elements.authCountryCodeInput],
    [elements.restaurantCityInput, elements.restaurantCountryCodeInput],
    [elements.restaurantAddressInput, elements.restaurantCountryCodeInput],
  ];
  pairs.forEach(([input, countryInput]) => {
    if (!input) return;
    const countryCode = normalizeTextSetting(countryInput?.value || restaurantRegistrationRegion.countryCode).toLowerCase();
    let autocomplete = restaurantPlaceAutocompletes.get(input);
    if (!autocomplete) {
      autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ["address_components", "formatted_address", "geometry", "name"],
        componentRestrictions: ["pl", "co"].includes(countryCode) ? { country: countryCode } : undefined,
      });
      autocomplete.addListener("place_changed", () => applyRestaurantPlace(autocomplete.getPlace(), input));
      restaurantPlaceAutocompletes.set(input, autocomplete);
    } else if (["pl", "co"].includes(countryCode)) {
      autocomplete.setComponentRestrictions({ country: countryCode });
    }
  });
}

async function reverseGeocodeRestaurantLocation(latitude, longitude) {
  if (!googleMapsApiKey) return false;
  await loadRestaurantGoogleMaps();
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        resolve(false);
        return;
      }
      const result = results[0];
      const countryCode = restaurantAddressComponent(result, "country", true).toUpperCase();
      const city = restaurantPlaceLocality(result);
      const region = normalizedRestaurantRegion(
        countryCode,
        restaurantAddressComponent(result, "administrative_area_level_1")
      );
      const postalCode = restaurantAddressComponent(result, "postal_code");
      const formattedAddress = normalizeTextSetting(result.formatted_address);

      if (formattedAddress) restaurantAddress = formattedAddress;
      restaurantRegistrationRegion = {
        ...restaurantRegistrationRegion,
        countryCode: countryCode || restaurantRegistrationRegion.countryCode,
        country: countryCode === "PL" ? "Polonia" : countryCode === "CO" ? "Colombia" : restaurantRegistrationRegion.country,
        city: city || restaurantRegistrationRegion.city,
        region: region || restaurantRegistrationRegion.region,
        postalCode: postalCode || restaurantRegistrationRegion.postalCode,
        timezone: countryCode === "PL"
          ? "Europe/Warsaw"
          : countryCode === "CO"
            ? "America/Bogota"
            : restaurantRegistrationRegion.timezone,
      };
      resolve(true);
    });
  });
}

function useRestaurantCurrentLocation() {
  if (!navigator.geolocation) {
    alert("Este dispositivo no permite obtener ubicacion.");
    return;
  }
  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    setRestaurantLocationStatus("La ubicacion requiere abrir RC ORDERA desde la direccion HTTPS publicada en Vercel.", "error");
    return;
  }

  elements.useRestaurantLocationButton.disabled = true;
  setRestaurantLocationStatus("Solicitando ubicacion del restaurante...");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      restaurantLatitude = Number(position.coords.latitude);
      restaurantLongitude = Number(position.coords.longitude);
      let addressResolved = false;
      try {
        addressResolved = await reverseGeocodeRestaurantLocation(restaurantLatitude, restaurantLongitude);
      } catch (error) {
        console.warn("No se pudo completar la direccion del restaurante.", error);
      }
      if (!addressResolved && !normalizeTextSetting(elements.restaurantAddressInput?.value)) {
        restaurantAddress = `${restaurantLatitude.toFixed(6)}, ${restaurantLongitude.toFixed(6)}`;
      }
      renderCurrencySettings();
      localStoreCurrentSettings();
      const result = await saveSettingsWhenPossible();
      updateQrPreview();
      elements.useRestaurantLocationButton.disabled = false;
      setRestaurantLocationStatus(syncResultMessage("Ubicacion exacta guardada para domicilio.", result), result.synced ? "ok" : "");
    },
    (error) => {
      elements.useRestaurantLocationButton.disabled = false;
      const messages = {
        1: "Permiso de ubicacion denegado. Puedes escribir la direccion manualmente o habilitar el permiso del navegador.",
        2: "El dispositivo no pudo determinar la ubicacion. Intenta cerca de una ventana o escribe la direccion.",
        3: "La ubicacion tardo demasiado. Intenta nuevamente o escribe la direccion manualmente.",
      };
      setRestaurantLocationStatus(messages[error?.code] || "No fue posible obtener la ubicacion.", "error");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

function marketplacePaymentErrorMessage(error) {
  const message = String(error?.message || error?.context?.message || "");
  if (/not configured|503/i.test(message)) {
    return "El pago en linea aun no esta disponible. Contacta al soporte de la plataforma.";
  }
  if (/not enabled for this country|409/i.test(message)) {
    return "Los pagos marketplace todavia no estan habilitados para este pais.";
  }
  if (/session expired|unauthorized|401/i.test(message)) {
    return "La sesion vencio. Inicia sesion nuevamente.";
  }
  return "No fue posible comprobar la cuenta de pagos.";
}

function renderMarketplaceAccountState() {
  if (!elements.marketplaceAccountStatus || !elements.marketplaceAccountButton) return;
  const countryCode = String(restaurantRegistrationRegion.countryCode || "").toUpperCase();
  const complete = marketplaceAccountState?.onboardingStatus === "complete"
    && marketplaceAccountState?.payoutsEnabled === true;

  if (countryCode !== "PL") {
    elements.marketplaceAccountStatus.textContent = countryCode === "CO"
      ? "No disponible en Colombia hasta la aprobacion del proveedor"
      : "Selecciona el pais del restaurante";
    elements.marketplaceAccountStatus.dataset.state = "unavailable";
    elements.marketplaceAccountButton.textContent = "No disponible";
    elements.marketplaceAccountButton.disabled = true;
    if (elements.onlinePaymentProviderSelect) {
      elements.onlinePaymentProviderSelect.value = "disabled";
      elements.onlinePaymentProviderSelect.disabled = true;
    }
    return;
  }

  if (elements.onlinePaymentProviderSelect) elements.onlinePaymentProviderSelect.disabled = false;
  elements.marketplaceAccountButton.disabled = !cloudState.user || !navigator.onLine;
  if (complete) {
    elements.marketplaceAccountStatus.textContent = "Verificada para recibir pagos";
    elements.marketplaceAccountStatus.dataset.state = "complete";
    elements.marketplaceAccountButton.textContent = "Revisar cuenta";
  } else if (marketplaceAccountState?.onboardingStatus === "pending") {
    elements.marketplaceAccountStatus.textContent = "Configuracion pendiente";
    elements.marketplaceAccountStatus.dataset.state = "pending";
    elements.marketplaceAccountButton.textContent = "Continuar configuracion";
  } else {
    elements.marketplaceAccountStatus.textContent = cloudState.user ? "Sin configurar" : "Inicia sesion para configurar";
    elements.marketplaceAccountStatus.dataset.state = "not-started";
    elements.marketplaceAccountButton.textContent = "Configurar pagos";
  }
}

async function refreshMarketplaceAccountState(action = "status") {
  if (!cloudState.client || !cloudState.user) {
    marketplaceAccountState = null;
    renderMarketplaceAccountState();
    return false;
  }
  if (!navigator.onLine) {
    showToast("Conecta internet para comprobar la cuenta de pagos.");
    renderMarketplaceAccountState();
    return false;
  }

  if (elements.marketplaceAccountButton) elements.marketplaceAccountButton.disabled = true;
  if (elements.marketplaceAccountStatus) elements.marketplaceAccountStatus.textContent = "Comprobando cuenta...";
  try {
    const { data, error } = await cloudState.client.functions.invoke("marketplace-onboarding", {
      body: { accountType: "restaurant", action },
    });
    if (error) throw error;
    if (data?.url && action !== "status") {
      window.location.assign(data.url);
      return true;
    }
    marketplaceAccountState = data || null;
    renderMarketplaceAccountState();
    if (action !== "status" && marketplaceAccountState?.onboardingStatus === "complete") {
      showToast("Cuenta de pagos verificada correctamente.");
    }
    return marketplaceAccountState?.onboardingStatus === "complete"
      && marketplaceAccountState?.payoutsEnabled === true;
  } catch (error) {
    console.error("No fue posible verificar Stripe Connect:", error);
    marketplaceAccountState = null;
    renderMarketplaceAccountState();
    showToast(marketplacePaymentErrorMessage(error));
    return false;
  } finally {
    renderMarketplaceAccountState();
  }
}

async function configureMarketplaceAccount() {
  await refreshMarketplaceAccountState("onboarding");
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
  if (elements.restaurantCountryCodeInput) elements.restaurantCountryCodeInput.value = restaurantRegistrationRegion.countryCode || "";
  if (elements.restaurantCityInput) elements.restaurantCityInput.value = restaurantRegistrationRegion.city || "";
  if (elements.restaurantRegionInput) elements.restaurantRegionInput.value = restaurantRegistrationRegion.region || "";
  if (elements.restaurantPostalCodeInput) elements.restaurantPostalCodeInput.value = restaurantRegistrationRegion.postalCode || "";
  elements.googleMapsApiKeyInput.value = googleMapsApiKey;
  elements.bankAccountInput.value = bankAccount;
  elements.bankTransferNoteInput.value = bankTransferNote;
  if (elements.onlinePaymentProviderSelect) elements.onlinePaymentProviderSelect.value = onlinePaymentProvider;
  if (elements.onlinePaymentNoteInput) elements.onlinePaymentNoteInput.value = onlinePaymentNote;
  renderMarketplaceAccountState();
  renderRestaurantHours();
  renderRestaurantStatus();
  applyBusinessNameToUi();
  applyReceiptPrintStyle();
}

function renderRestaurantStatus() {
  const automatic = restaurantOperationalMode === "schedule";
  const timezone = normalizeTextSetting(restaurantRegistrationRegion.timezone) || "zona horaria del restaurante";
  const statusLabel = !restaurantActive
    ? "Restaurante desactivado"
    : restaurantOperationalOpen
      ? "Abierto y recibiendo pedidos"
      : "Cerrado para nuevos pedidos";
  const detail = !cloudState.user
    ? "Inicia sesion para controlar la atencion."
    : automatic
      ? `Modo automatico segun horario (${timezone}).`
      : "Modo manual. Usa el boton para abrir o cerrar.";

  if (elements.restaurantStatusText) {
    elements.restaurantStatusText.textContent = !restaurantActive
      ? "La cuenta del restaurante esta desactivada."
      : automatic
        ? `${statusLabel}. El estado se calcula con el horario guardado.`
        : restaurantOperationalOpen
          ? "Atencion abierta manualmente: los clientes pueden enviar pedidos."
          : "Atencion cerrada manualmente: el menu es visible, pero no recibe pedidos nuevos.";
  }
  if (elements.closeRestaurantButton) {
    elements.closeRestaurantButton.textContent = automatic
      ? "Controlado por horario"
      : restaurantOperationalOpen
        ? "Cerrar atencion"
        : "Abrir atencion";
  }
  if (elements.restaurantServiceBar) {
    elements.restaurantServiceBar.dataset.open = restaurantActive ? String(restaurantOperationalOpen) : "false";
  }
  if (elements.mainRestaurantStatusText) elements.mainRestaurantStatusText.textContent = statusLabel;
  if (elements.mainRestaurantStatusDetail) elements.mainRestaurantStatusDetail.textContent = detail;
  if (elements.mainRestaurantToggleButton) {
    elements.mainRestaurantToggleButton.textContent = automatic
      ? "Horario automatico"
      : restaurantOperationalOpen
        ? "Cerrar atencion"
        : "Abrir atencion";
  }
  if (elements.restaurantScheduleModeInput) elements.restaurantScheduleModeInput.checked = automatic;
  setRestaurantStatusControlsDisabled(false);
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
  const productId = String(item?.productId || item?.product_id || "").trim();
  if (productId) return `product:${productId}`;
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
  const allowed = ["Pago en caja", "Efectivo", "Transferencia", "Datafono", "Online"];
  return allowed.includes(value) ? value : "Pago en caja";
}

function paymentMethodLabel(method) {
  const value = normalizePaymentMethod(method);
  if (value === "Datafono") return "Datafono / tarjeta";
  return value;
}

function clientOrderPaymentIsReady(order) {
  const method = normalizePaymentMethod(order?.payment_method || order?.order_json?.paymentMethod);
  if (method !== "Online") return true;
  return normalizePaymentStatus(order?.payment_status || order?.order_json?.paymentStatus) === "paid";
}

function normalizePaymentStatus(status, fallback = "pending") {
  const value = String(status || "").trim().toLowerCase();
  return ["pending", "processing", "paid", "failed", "refunded", "partially_refunded", "unverified"].includes(value)
    ? value
    : fallback;
}

function paymentStatusLabel(status) {
  const value = normalizePaymentStatus(status, "unverified");
  if (value === "paid") return "Cobrado";
  if (value === "pending") return "Por cobrar";
  if (value === "processing") return "Procesando";
  if (value === "failed") return "Pago fallido";
  if (value === "refunded") return "Reembolsado";
  if (value === "partially_refunded") return "Reembolso parcial";
  return "Sin confirmar";
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
    info.name ? `${appUiText("Nombre:")} ${info.name}` : "",
    info.phone ? `${appUiText("Telefono:")} ${info.phone}` : "",
    info.address ? `${appUiText("Direccion:")} ${info.address}` : "",
    info.neighborhood ? `${appUiText("Barrio/Ciudad:")} ${info.neighborhood}` : "",
    info.reference ? `${appUiText("Referencia:")} ${info.reference}` : "",
    info.distanceKm > 0 ? `${appUiText("Distancia:")} ${info.distanceKm} km` : "",
    info.mapDurationText ? `${appUiText("Tiempo Google Maps:")} ${info.mapDurationText}` : "",
    info.calculatedFee > 0 ? `${appUiText("Tarifa km:")} ${formatMoney(info.calculatedFee)}` : "",
    info.extraFee > 0 ? `${appUiText("Recargo:")} ${formatMoney(info.extraFee)}` : "",
    info.fee > 0 ? `${appUiText("Domicilio:")} ${formatMoney(info.fee)}` : "",
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
      searchQuery
        ? `No encontre productos con "${escapeHtml(menuSearchQuery)}".`
        : activeCategory
          ? "No hay productos en esta categoria."
          : "Crea una categoria y agrega los productos reales de tu restaurante."
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
          data-product-id="${escapeHtml(dish.id || dish.productId || "")}"
          data-price="${dish.price}"
          data-station="${escapeHtml(normalizeProductStation(dish.station))}"
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
    activeCategory = categories[0] || "";
  }

  elements.categoryNameInput.value = activeCategory;
  elements.activeProductCategoryLabel.textContent = activeCategory
    ? `Categoria: ${activeCategory}`
    : "Primero crea una categoria";
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
  elements.newProductButton.disabled = categories.length === 0;
  elements.saveProductButton.disabled = categories.length === 0;
  elements.renameCategoryButton.disabled = categories.length === 0;
  elements.deleteCategoryButton.disabled = categories.length === 0;

  renderProductList();
}

function renderProductList() {
  const products = menuCatalog[activeCategory] || [];

  if (!products.length) {
    elements.productList.innerHTML = `<div class="editor-empty">${activeCategory
      ? "Esta categoria no tiene productos todavia."
      : "No hay categorias. Crea la primera para comenzar el menu."}</div>`;
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
              <small>${productIsAvailable(product) ? "Disponible" : "No disponible"} · ${escapeHtml(restaurantStationLabel(normalizeProductStation(product.station)))}</small>
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

  showRestaurantEditSection("restaurant-info");

  elements.menuEditorDialog.showModal();
  refreshMarketplaceAccountState("status").catch(() => {});
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

  if (elements.productNamePlInput) {
    elements.productNamePlInput.value = "";
  }

  if (elements.productDescriptionPlInput) {
    elements.productDescriptionPlInput.value = "";
  }

  if (elements.productNameEnInput) {
    elements.productNameEnInput.value = "";
  }

  if (elements.productDescriptionEnInput) {
    elements.productDescriptionEnInput.value = "";
  }

  elements.productPriceInput.value = "";
  if (elements.productStationSelect) elements.productStationSelect.value = "kitchen";
  elements.productImageUrlInput.value = "";
  elements.productAvailableInput.checked = true;

  if (elements.productImageFileInput) {
    elements.productImageFileInput.value = "";
  }

  elements.productCategorySelect.value =
    activeCategory;

  elements.saveProductButton.textContent =
    "Agregar producto";

  elements.saveProductButton.disabled =
    !activeCategory;

  elements.newProductButton.disabled =
    !activeCategory;

  elements.cancelEditProductButton.hidden =
    true;

  editingProduct = null;
}
function startNewProduct() {
  if (!activeCategory) {
    alert("Primero crea una categoria.");
    elements.categoryNameInput?.focus();
    return;
  }
  clearProductForm();
  elements.productCategorySelect.value = activeCategory;
  elements.productNameInput.focus();
}

async function addCategory() {
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

  const result = await saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast(
    syncResultMessage(existed ? `Categoria "${activeCategory}" seleccionada.` : `Categoria "${category}" agregada.`, result)
  );
}

async function renameCategory() {
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
    const result = await saveMenuCatalog();
    clearProductForm();
    renderMenuEditor();
    showToast(syncResultMessage(`Categorias unidas en "${existingCategory}".`, result));
    return;
  }

  const renamed = {};
  Object.entries(menuCatalog).forEach(([category, products]) => {
    renamed[category === activeCategory ? newName : category] = products;
  });
  menuCatalog = renamed;
  activeCategory = newName;
  const result = await saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast(syncResultMessage(`Categoria "${previousName}" cambiada a "${newName}".`, result));
}

async function deleteCategory() {
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
    const result = await saveMenuCatalog();
    clearProductForm();
    renderMenuEditor();
    showToast(syncResultMessage(`Duplicadas de "${targetCategory}" eliminadas y guardadas.`, result));
    return;
  }

  menuCatalog = normalizeMenuCatalog(menuCatalog);
  const categories = Object.keys(menuCatalog);
  const activeKey = categoryIdentityKey(targetCategory);
  const categoriesToDelete = categories.filter((category) => categoryIdentityKey(category) === activeKey);

  const deletedCategory = targetCategory;
  const deleteLabel =
    categoriesToDelete.length > 1 ? `${deletedCategory} (${categoriesToDelete.length} categorias repetidas)` : deletedCategory;
  const shouldDelete = confirm(`Eliminar la categoria "${deleteLabel}" y todos sus productos?`);
  if (!shouldDelete) return;

  categoriesToDelete.forEach((category) => delete menuCatalog[category]);
  activeCategory = Object.keys(menuCatalog)[0] || "";
  const result = await saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast(
    syncResultMessage(
      categoriesToDelete.length > 1
        ? `Categorias repetidas de "${deletedCategory}" eliminadas.`
        : `Categoria "${deletedCategory}" eliminada.`,
      result
    )
  );
}

async function saveProduct() {
  if (elements.saveProductButton.disabled) return;
  const category = elements.productCategorySelect.value;
  const name = elements.productNameInput.value.trim();
  const description = normalizeProductDescription(elements.productDescriptionInput.value);
  const namePl = elements.productNamePlInput ? elements.productNamePlInput.value.trim() : "";
  const descriptionPl = elements.productDescriptionPlInput
    ? normalizeProductDescription(elements.productDescriptionPlInput.value)
    : "";
  const nameEn = elements.productNameEnInput ? elements.productNameEnInput.value.trim() : "";
  const descriptionEn = elements.productDescriptionEnInput
    ? normalizeProductDescription(elements.productDescriptionEnInput.value)
    : "";
  const price = Number.parseFloat(elements.productPriceInput.value) || 0;
  let imageUrl = normalizeProductImageUrl(elements.productImageUrlInput.value);
  const available = elements.productAvailableInput.checked;
  const station = normalizeProductStation(elements.productStationSelect?.value);

  if (!category || !menuCatalog[category]) {
    alert("Selecciona una categoria.");
    return;
  }

  if (!name) {
    alert("Escribe el nombre del producto.");
    return;
  }

  const previousProduct = editingProduct ? (menuCatalog[editingProduct.category] || [])[editingProduct.index] : null;
  const productId = normalizeProductId(previousProduct?.id || previousProduct?.productId) || createProductId();
  const menuBeforeSave = normalizeMenuCatalog(menuCatalog);
  elements.saveProductButton.disabled = true;

  try {
    if (isInlineRestaurantImage(imageUrl) && cloudState.user && navigator.onLine) {
      updateCloudStatus("Subiendo foto...");
      imageUrl = await uploadRestaurantImageDataUrl(imageUrl, "products", productId);
      elements.productImageUrlInput.value = imageUrl;
    }

    const translations = normalizeProductTranslations(previousProduct || {}, name, description);
    translations.es = { name, description };
    translations.pl = { name: namePl, description: descriptionPl };
    translations.en = { name: nameEn, description: descriptionEn };

    const product = {
      id: productId,
      name,
      description,
      translations,
      price,
      available,
      imageUrl,
      station,
    };

    if (editingProduct) {
      const oldList = menuCatalog[editingProduct.category] || [];
      oldList.splice(editingProduct.index, 1);
    }
    menuCatalog[category].push(product);
    activeCategory = category;
    const result = await saveMenuCatalog();
    clearProductForm();
    renderMenuEditor();
    showToast(syncResultMessage("Producto guardado.", result));
  } catch (error) {
    console.error("No fue posible guardar el producto:", error);
    menuCatalog = menuBeforeSave;
    renderCategories();
    renderMenu();
    renderMenuEditor();
    updateCloudStatus();
    const message = String(error?.message || "");
    alert(/almacenamiento de fotos|foto|imagen|direccion final/i.test(message)
      ? message
      : "No fue posible guardar el producto. Los datos del formulario se conservaron para reintentar.");
  } finally {
    elements.saveProductButton.disabled = false;
  }
}

function editProduct(index) {
  const product =
    (menuCatalog[activeCategory] || [])[index];

  if (!product) return;

  editingProduct = {
    category: activeCategory,
    index,
  };

  const translations =
    normalizeProductTranslations(
      product,
      product.name || "",
      product.description || ""
    );

  elements.productCategorySelect.value =
    activeCategory;

  /*
   * ESPAÑOL
   */
  elements.productNameInput.value =
    translations.es.name || "";

  elements.productDescriptionInput.value =
    translations.es.description || "";

  /*
   * POLACO
   */
  if (elements.productNamePlInput) {
    elements.productNamePlInput.value =
      translations.pl.name || "";
  }

  if (elements.productDescriptionPlInput) {
    elements.productDescriptionPlInput.value =
      translations.pl.description || "";
  }

  /*
   * INGLÉS
   */
  if (elements.productNameEnInput) {
    elements.productNameEnInput.value =
      translations.en.name || "";
  }

  if (elements.productDescriptionEnInput) {
    elements.productDescriptionEnInput.value =
      translations.en.description || "";
  }

  elements.productPriceInput.value =
    product.price;

  if (elements.productStationSelect) {
    elements.productStationSelect.value = normalizeProductStation(product.station);
  }

  elements.productImageUrlInput.value =
    product.imageUrl || "";

  elements.productAvailableInput.checked =
    productIsAvailable(product);

  if (elements.productImageFileInput) {
    elements.productImageFileInput.value = "";
  }

  elements.saveProductButton.textContent =
    "Guardar cambios";

  elements.cancelEditProductButton.hidden =
    false;

  elements.productNameInput.focus();

  showToast(
    `Editando "${translations.es.name || product.name}". Cambia los datos y presiona Guardar cambios.`
  );
}
async function deleteProduct(index) {
  const product = (menuCatalog[activeCategory] || [])[index];
  if (!product) return;

  const shouldDelete = confirm(`Eliminar "${product.name}"?`);
  if (!shouldDelete) return;

  menuCatalog[activeCategory].splice(index, 1);
  const result = await saveMenuCatalog();
  clearProductForm();
  renderMenuEditor();
  showToast(syncResultMessage(`Producto "${product.name}" eliminado.`, result));
}

function resetMenu() {
  if (!elements.menuClearSecurityDialog) {
    showToast("No se pudo abrir la ventana de seguridad del menú.");
    return;
  }

  if (elements.menuClearConfirmationInput) {
    elements.menuClearConfirmationInput.value = "";
  }

  if (elements.menuClearPasswordInput) {
    elements.menuClearPasswordInput.value = "";
  }

  if (elements.menuClearSecurityMessage) {
    elements.menuClearSecurityMessage.textContent = "";
    elements.menuClearSecurityMessage.hidden = true;
  }

  elements.menuClearSecurityDialog.showModal();
}

async function clearMenuSecurely() {
  const confirmation = elements.menuClearConfirmationInput?.value?.trim() || "";
  const password = elements.menuClearPasswordInput?.value || "";
  const message = elements.menuClearSecurityMessage;
  const button = elements.confirmMenuClearButton;

  if (confirmation !== "VACIAR MENU") {
    message.textContent = 'Debes escribir exactamente "VACIAR MENU" para continuar.';
    message.hidden = false;
    elements.menuClearConfirmationInput?.focus();
    return;
  }
  if (!cloudState.client || !cloudState.user || !navigator.onLine) {
    message.textContent = "Esta operacion necesita una sesion activa e internet para crear el respaldo en la nube.";
    message.hidden = false;
    return;
  }
  if (!password) {
    message.textContent = "Escribe la contrasena actual de la cuenta propietaria.";
    message.hidden = false;
    elements.menuClearPasswordInput?.focus();
    return;
  }

  button.disabled = true;
  message.textContent = "Verificando identidad sin modificar el menu...";
  message.hidden = false;
  try {
    const email = cloudState.user.email || "";
    const { error: authError } = await cloudState.client.auth.signInWithPassword({ email, password });
    if (authError) throw new Error("La contrasena no coincide. El menu no fue modificado.");

    const finalConfirmation = window.confirm(
      "Ultima confirmacion: se creara un respaldo en la nube y luego se vaciaran todas las categorias y productos. Deseas continuar?"
    );
    if (!finalConfirmation) {
      message.textContent = "Operacion cancelada. El menu permanece sin cambios.";
      return;
    }

    message.textContent = "Creando respaldo y esperando confirmacion del servidor...";
    const { data, error } = await cloudState.client.rpc("clear_current_restaurant_menu", {
      p_confirmation: confirmation,
    });
    if (error) {
      if (isMissingRestaurantRpc(error)) {
        throw new Error("La proteccion del menu aun no esta disponible. Contacta al soporte de la plataforma.");
      }
      throw error;
    }
    const confirmed = Array.isArray(data) ? data[0] : data;
    if (!confirmed?.backupId && !confirmed?.backup_id) {
      throw new Error("La nube no confirmo el respaldo. El menu local no se vacio.");
    }

    menuCatalog = EMPTY_MENU_CATALOG;
    saveMenuCache({ immediate: true });
    clearMenuPending();
    storeCloudRevision(STORAGE_KEYS.menuRevision, confirmed.menuRevision ?? confirmed.menu_revision);
    activeCategory = "";
    clearProductForm();
    renderCategories();
    renderMenu();
    renderMenuEditor();
    elements.menuClearPasswordInput.value = "";
    elements.menuClearConfirmationInput.value = "";
    elements.menuClearSecurityDialog.close();
    showToast("Menu vaciado. El respaldo fue confirmado en la nube.");
  } catch (error) {
    console.error(error);
    const rawMessage = String(error?.message || "");
    message.textContent = /La contrasena no coincide|La proteccion del menu aun no esta disponible|La nube no confirmo el respaldo/i.test(rawMessage)
      ? rawMessage
      : "No fue posible vaciar el menu. No se modificaron los datos locales.";
    message.hidden = false;
  } finally {
    button.disabled = false;
  }
}

function addItem(name, price, station = "kitchen", productId = "") {
  const cleanName = String(name || "").trim();
  const cleanPrice = Number.parseFloat(price) || 0;
  const cleanProductId = String(productId || "").trim();
  if (!cleanName) return;

  const existing = currentOrder.items.find(
    (item) => (cleanProductId
      ? String(item.productId || item.product_id || "") === cleanProductId
      : !item.productId && !item.product_id && item.name.toLowerCase() === cleanName.toLowerCase())
      && item.price === cleanPrice && !item.note
  );

  if (existing) {
    existing.qty += 1;
  } else {
    currentOrder.items.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      name: cleanName,
      ...(cleanProductId ? { productId: cleanProductId } : {}),
      price: cleanPrice,
      qty: 1,
      note: "",
      station: normalizeProductStation(station),
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

async function upsertCurrentOrder(options = {}) {
  const {
    cloudTimeoutMs = 5000,
  } = options;

  rollOverDayIfNeeded();
  syncFormToOrder();

  if (!String(currentOrder.cashier || "").trim()) {
    currentOrder.cashier =
      currentCashierName() || "Caja";
  }

  if (!currentOrder.items.length) {
    alert(
      "Agrega al menos un producto antes de guardar."
    );
    return false;
  }

  const now = new Date().toISOString();

  const canTryCloud = Boolean(
    cloudState.user &&
    navigator.onLine
  );

  /*
   * 1. EL PEDIDO SE GUARDA LOCALMENTE PRIMERO.
   *
   * La caja nunca debe depender de Internet
   * para conservar un pedido.
   */
  if (!currentOrder.saved) {
    currentOrder.id = createLocalOrderUuid();

    currentOrder.syncStatus =
      shouldQueueForCloud()
        ? "pending"
        : "local";

    /*
     * Intentamos conseguir ticket de nube,
     * pero con tiempo máximo.
     */
    if (canTryCloud) {
      try {
        currentOrder.ticketNumber =
          await withCloudTimeout(
            (signal) => claimCloudTicket(signal),
            "La nube tardó demasiado en asignar el ticket.",
            2500
          );

        nextTicket =
          Number(currentOrder.ticketNumber) + 1;
      } catch (error) {
        console.warn(
          "No se pudo obtener ticket de nube a tiempo. Se usará ticket local.",
          error
        );

        currentOrder.ticketNumber =
          nextTicket;

        nextTicket += 1;

        currentOrder.syncStatus =
          shouldQueueForCloud()
            ? "pending"
            : "local";
      }
    } else {
      currentOrder.ticketNumber =
        nextTicket;

      nextTicket += 1;
    }

    currentOrder.createdAt = now;
    currentOrder.updatedAt = now;
    currentOrder.businessDate = todayKey;
    currentOrder.saved = true;

    savedOrders.unshift(
      structuredCloneOrder(currentOrder)
    );
  } else {
    currentOrder.updatedAt = now;

    if (shouldQueueForCloud()) {
      currentOrder.syncStatus = "pending";
    }

    const index =
      savedOrders.findIndex(
        (order) =>
          order.id === currentOrder.id
      );

    if (index >= 0) {
      savedOrders[index] =
        structuredCloneOrder(currentOrder);
    }
  }

  /*
   * 2. PERSISTENCIA LOCAL INMEDIATA.
   *
   * Antes de cualquier segunda llamada
   * a Internet el pedido ya queda protegido.
   */
  saveTicketState();

  saveOrders({
    immediate: true,
  });

  saveCurrentOrderDraft();

  renderOrder();
  renderHistory();

  /*
   * 3. INTENTO DE SINCRONIZACIÓN.
   *
   * La nube tiene un límite de tiempo.
   * Si tarda demasiado, el pedido queda
   * pendiente y la caja continúa trabajando.
   */
  if (canTryCloud) {
    try {
await withCloudTimeout(
  (signal) =>
    saveCloudOrder(
      currentOrder,
      signal
    ),
  "La nube tardó demasiado en guardar el pedido.",
  cloudTimeoutMs
);

      currentOrder.syncStatus =
        "synced";

      setOrderSyncStatus(
        currentOrder.id,
        "synced"
      );

      saveOrders({
        immediate: true,
      });

      /*
       * El contador no debe bloquear
       * Guardar ni Imprimir.
       */
      withCloudTimeout(
        (signal) => advanceCloudTicketCounter(
          Math.max(
            nextTicket,
            Number(
              currentOrder.ticketNumber
            ) + 1
          ),
          signal
        ),
        "El contador de tickets tardó demasiado.",
        3000
      ).catch((error) => {
        console.warn(
          "El contador se sincronizará después.",
          error
        );

        queueTicketCounter(
          Math.max(
            nextTicket,
            Number(
              currentOrder.ticketNumber
            ) + 1
          )
        );
      });

      updateCloudStatus();
    } catch (error) {
      console.warn(
        "Pedido guardado localmente; sincronización pendiente.",
        error
      );

      currentOrder.syncStatus =
        shouldQueueForCloud()
          ? "pending"
          : "local";

      setOrderSyncStatus(
        currentOrder.id,
        currentOrder.syncStatus
      );

     saveOrders({
  immediate: true,
});

schedulePendingOrderRecovery(
  error
);

updateCloudStatus();
    }
 } else if (shouldQueueForCloud()) {
  currentOrder.syncStatus =
    "pending";

  setOrderSyncStatus(
    currentOrder.id,
    "pending"
  );

  saveOrders({
    immediate: true,
  });

  schedulePendingOrderRecovery();

  updateCloudStatus();
}
  if (elements.dailyCloseDialog?.open) {
    renderDailyClose(
      elements.closeDayInput.value ||
      todayKey
    );
  }

  if (elements.monthlyCloseDialog?.open) {
    renderMonthlyClose(
      elements.closeMonthInput.value ||
      currentMonthKey()
    );
  }

  if (elements.annualCloseDialog?.open) {
    renderAnnualClose(
      elements.closeYearInput.value ||
      currentYearKey()
    );
  }

  return true;
}
function structuredCloneOrder(order) {
  return JSON.parse(JSON.stringify(order));
}
async function printCurrentOrder() {
  if (
  !(await upsertCurrentOrder({
    cloudTimeoutMs: 2500,
  }))
) {
  return;
}

  const orderToPrint = structuredCloneOrder(currentOrder);
  const printedTicketNumber = currentOrder.ticketNumber;

  renderPrintTicket(orderToPrint);

  try {
    await printRenderedTicket();

    startNewOrder();

    showToast(
      `Ticket ${formatTicket(printedTicketNumber)} guardado e impreso. Nuevo ticket listo.`
    );
  } catch (error) {
    console.error("Error al imprimir ticket:", error);

    showToast(
      `El ticket ${formatTicket(printedTicketNumber)} quedó guardado, pero la impresión no terminó.`
    );
  }
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
      html, body {
        width: ${width}mm !important;
        min-height: 0 !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .print-ticket {
        box-sizing: border-box !important;
        width: ${contentWidth}mm !important;
        min-height: 0 !important;
        height: auto !important;
        padding: 1.5mm 2mm 0.5mm !important;
        overflow: visible !important;
        break-after: auto !important;
        page-break-after: auto !important;
      }
      .print-ticket::after {
        content: "" !important;
        display: block !important;
        height: 1mm !important;
      }
    }
  `;
}

function setThermalPrinterStatus(message, type = "") {
  if (!elements.thermalPrinterStatus) return;
  elements.thermalPrinterStatus.textContent = message;
  elements.thermalPrinterStatus.dataset.type = type;
}

function thermalPrinterCanConnect() {
  return Boolean(navigator.serial && window.isSecureContext);
}

async function openThermalPrinterPort(port) {
  if (!port) return false;
  if (!port.readable && !port.writable) await port.open({ baudRate: 9600 });
  thermalPrinterPort = port;
  setThermalPrinterStatus("Impresora directa conectada. Cada ticket enviara la orden de corte.", "ok");
  return true;
}

async function restoreThermalPrinterPort() {
  if (!thermalPrinterCanConnect() || thermalPrinterPort) return;
  try {
    const ports = await navigator.serial.getPorts();
    if (ports.length) await openThermalPrinterPort(ports[0]);
    else setThermalPrinterStatus("Impresion del sistema; el corte automatico depende del controlador de la impresora.");
  } catch {
    setThermalPrinterStatus("Impresion del sistema; conecta nuevamente la impresora para enviar corte directo.", "error");
  }
}

async function connectThermalPrinter() {
  if (!thermalPrinterCanConnect()) {
    setThermalPrinterStatus(
      "Este navegador no permite conexion ESC/POS directa. Usa Chrome o Edge por HTTPS y activa el corte automatico en el controlador.",
      "error"
    );
    return;
  }
  if (elements.connectThermalPrinterButton) elements.connectThermalPrinterButton.disabled = true;
  try {
    const port = await navigator.serial.requestPort();
    await openThermalPrinterPort(port);
  } catch (error) {
    if (error?.name !== "NotFoundError") {
      setThermalPrinterStatus("No se pudo conectar la impresora. Revisa el cable y vuelve a intentarlo.", "error");
    }
  } finally {
    if (elements.connectThermalPrinterButton) elements.connectThermalPrinterButton.disabled = false;
  }
}

function thermalTicketText() {
  const text = String(elements.printTicket?.innerText || elements.printTicket?.textContent || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x0A\x0D\x20-\x7E]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${text}\n\n\n`;
}
async function printWithThermalPrinter() {
  if (!thermalPrinterPort?.writable) return false;

  const writer = thermalPrinterPort.writable.getWriter();

  const writeWithTimeout = (data, timeoutMs = 2500) =>
    Promise.race([
      writer.write(data),
      new Promise((_, reject) =>
        window.setTimeout(
          () => reject(new Error(appUiText("La impresora no respondio a tiempo."))),
          timeoutMs
        )
      ),
    ]);

  try {
    const encoder = new TextEncoder();

    await writeWithTimeout(
      new Uint8Array([0x1b, 0x40])
    );

    await writeWithTimeout(
      encoder.encode(thermalTicketText())
    );

    await writeWithTimeout(
      new Uint8Array([0x1d, 0x56, 0x00])
    );

    setThermalPrinterStatus(
      "Ticket impreso y orden de corte enviada.",
      "ok"
    );

    return true;
  } catch (error) {
    console.warn(
      "La impresora termica dejo de responder.",
      error
    );

    setThermalPrinterStatus(
      appUiText("La impresora no respondio. Se usara la impresion del sistema."),
      "error"
    );

    throw error;
  } finally {
    try {
      writer.releaseLock();
    } catch {
      // El puerto puede haberse desconectado.
    }
  }
}

function printTicketWithSystemDialog() {
  const width = normalizeReceiptWidth(receiptWidthMm);
  const printFrame = document.createElement("iframe");
  printFrame.title = appUiText("Impresion de ticket RC ORDERA");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "1px";
  printFrame.style.height = "1px";
  printFrame.style.border = "0";
  printFrame.style.opacity = "0";
  printFrame.setAttribute("aria-hidden", "true");
  document.body.appendChild(printFrame);
  const printDocument = printFrame.contentDocument;
  if (!printDocument) {
    printFrame.remove();
    applyReceiptPrintStyle();
    window.print();
    return;
  }
  printDocument.open();
  printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(appUiText("RC ORDERA - Ticket"))}</title><style>
    @page { size: ${width}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: ${width}mm; min-height: 0; margin: 0; padding: 0; background: #fff; color: #000; }
    body { font-family: Arial, sans-serif; font-size: 10pt; }
    .print-ticket { width: ${Math.max(42, width - 4)}mm; min-height: 0; margin: 0; padding: 1.5mm 2mm 0.5mm; }
    .receipt-brand, .receipt-number, .receipt-order-type, .receipt-total { text-align: center; font-weight: 800; }
    .receipt-brand { font-size: 13pt; }
    .receipt-number { font-size: 16pt; margin: 1mm 0; }
    .receipt-order-type { font-size: 11pt; }
    .receipt-divider { border-top: 1px dashed #000; margin: 1.5mm 0; }
    .receipt-row { display: flex; justify-content: space-between; gap: 2mm; }
    .receipt-row span { text-align: right; overflow-wrap: anywhere; }
    .receipt-item { margin: 1.5mm 0; break-inside: avoid; }
    .receipt-note, .receipt-note-block { font-weight: 800; text-transform: uppercase; overflow-wrap: anywhere; }
    p { margin: 1mm 0; }
  </style></head><body><div class="print-ticket">${elements.printTicket.innerHTML}</div></body></html>`);
  printDocument.close();
  const cleanup = () => window.setTimeout(() => printFrame.remove(), 250);
  printFrame.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    try {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    } catch {
      cleanup();
      applyReceiptPrintStyle();
      window.print();
    }
  }, 100);
  window.setTimeout(cleanup, 120000);
}

async function printRenderedTicket() {
  if (thermalPrinterPort?.writable) {
    try {
      if (await printWithThermalPrinter()) return;
    } catch (error) {
      console.warn("Fallo la impresion termica directa.", error);
      thermalPrinterPort = null;
      setThermalPrinterStatus("Se perdio la conexion directa. Se abrira la impresion del sistema.", "error");
    }
  }
  printTicketWithSystemDialog();
}

function renderPrintTicket(order) {
  const created = new Date(order.createdAt);
  const dateText = created.toLocaleDateString(appUiLocale());
  const timeText = created.toLocaleTimeString(appUiLocale(), { hour: "2-digit", minute: "2-digit" });
  const place = order.customer || appUiText("Sin mesa/cliente");
  const server = order.server || appUiText("No indicado");
  const cashier =
  String(
    order.cashier ||
    currentCashierName() ||
    ""
  ).trim() || appUiText("No indicado");
  const orderType = normalizeOrderType(order.type);
  const orderTypeText = appUiText(orderTypeLabel(orderType));
  const paymentMethod = appUiText(paymentMethodLabel(order.paymentMethod));
  const deliverySummary = formatDeliverySummary(order.delivery);

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <div class="receipt-number">${escapeHtml(appUiText("COCINA"))} ${formatTicket(order.ticketNumber)}</div>
    <div class="receipt-order-type">${escapeHtml(appUiText("TIPO DE PEDIDO"))}<br>${escapeHtml(orderTypeText).toUpperCase()}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Tipo:"))}</strong><span>${escapeHtml(orderTypeText)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Pago:"))}</strong><span>${escapeHtml(paymentMethod)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Mesa/Cliente:"))}</strong><span>${escapeHtml(place)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Tomo pedido:"))}</strong><span>${escapeHtml(server)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Cajero:"))}</strong><span>${escapeHtml(cashier)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Fecha:"))}</strong><span>${escapeHtml(dateText)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Hora:"))}</strong><span>${escapeHtml(timeText)}</span></div>
    ${
      deliverySummary
        ? `<div class="receipt-divider"></div><p class="receipt-note-block"><strong>${escapeHtml(appUiText("DOMICILIO:"))}</strong> ${escapeHtml(deliverySummary)}</p>`
        : ""
    }
    <div class="receipt-divider"></div>
    <div class="receipt-items">
      ${orderItemsList(order)
        .map(
          (item) => `
            <div class="receipt-item">
              <strong>${itemQuantity(item)} x ${escapeHtml(itemReportName(item))}</strong>
              ${item.note ? `<div class="receipt-note">${escapeHtml(appUiText("NOTA:"))} ${escapeHtml(normalizeNoteText(item.note))}</div>` : ""}
            </div>
          `
        )
        .join("")}
    </div>
    ${
      order.notes
        ? `<div class="receipt-divider"></div><p class="receipt-note-block"><strong>${escapeHtml(appUiText("NOTAS:"))}</strong> ${escapeHtml(normalizeNoteText(order.notes))}</p>`
        : ""
    }
    <div class="receipt-divider"></div>
    <p class="receipt-total">${escapeHtml(appUiText("FIN DEL TICKET"))}</p>
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
  const dateText = created.toLocaleDateString(appUiLocale());
  const timeText = created.toLocaleTimeString(appUiLocale(), { hour: "2-digit", minute: "2-digit" });
  const orderType = normalizeOrderType(order.type);
  const orderTypeText = appUiText(orderTypeLabel(orderType));
  const deliverySummary = formatDeliverySummary(order.delivery);
  const divider = "-".repeat(Math.min(31, Math.max(18, maxLineLength)));
  const lines = [
    pdfSafeText(businessName),
    `${appUiText("COCINA")} ${formatTicket(order.ticketNumber)}`,
    divider,
    appUiText("TIPO DE PEDIDO"),
    orderTypeText.toUpperCase(),
    divider,
    `${appUiText("Mesa/Cliente:")} ${order.customer || appUiText("Sin mesa/cliente")}`,
    `${appUiText("Pago:")} ${appUiText(paymentMethodLabel(order.paymentMethod))}`,
    `${appUiText("Tomo pedido:")} ${order.server || appUiText("No indicado")}`,
`${appUiText("Cajero:")} ${
  String(
    order.cashier ||
    currentCashierName() ||
    ""
  ).trim() || appUiText("No indicado")
}`,
`${appUiText("Fecha:")} ${dateText}`,
    `${appUiText("Hora:")} ${timeText}`,
    divider,
  ];

  if (deliverySummary) {
    wrapReceiptText(`${appUiText("DOMICILIO:")} ${deliverySummary}`, maxLineLength).forEach((line) => lines.push(line));
    lines.push(divider);
  }

  orderItemsList(order).forEach((item) => {
    wrapReceiptText(`${itemQuantity(item)} x ${itemReportName(item)}`, maxLineLength).forEach((line) => lines.push(line));
    if (item.note) {
      wrapReceiptText(`${appUiText("NOTA:")} ${normalizeNoteText(item.note)}`, maxLineLength).forEach((line) => lines.push(line));
    }
  });

  if (order.notes) {
    lines.push(divider);
    wrapReceiptText(`${appUiText("NOTAS:")} ${normalizeNoteText(order.notes)}`, maxLineLength).forEach((line) => lines.push(line));
  }

  lines.push(divider, appUiText("FIN DEL TICKET"));
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
  downloadBlob(blob, `rc-ordera-ticket-${ticketName}.pdf`);
}

let ticketHistoryArchive = null;

function ticketHistoryOrders() {
  const orders = new Map(savedOrders.map((order) => [order.id, order]));
  const deleted = new Set(readDeletedOrderIds());
  if (ticketHistoryArchive && ticketHistoryArchive.userId === cloudState.user?.id) {
    for (const order of ticketHistoryArchive.orders.values()) {
      const local = orders.get(order.id);
      if (!local || (!needsCloudSync(local) && Number(order._syncRevision) > Number(local._syncRevision || 0))) orders.set(order.id, order);
    }
  }
  return [...orders.values()].filter((order) => !deleted.has(order.id));
}

async function loadTicketHistoryPage(reset = false) {
  if (!cloudState.client || !cloudState.user || !navigator.onLine) {
    ticketHistoryArchive?.controller?.abort();
    ticketHistoryArchive = null;
    renderTicketHistory();
    return;
  }
  const date = String(elements.ticketHistoryDateInput?.value || "").trim();
  const client = cloudState.client;
  const userId = cloudState.user.id;
  if (ticketHistoryArchive?.busy && ticketHistoryArchive.userId === userId && ticketHistoryArchive.date === date) return;
  if (reset || !ticketHistoryArchive || ticketHistoryArchive.userId !== userId || ticketHistoryArchive.date !== date) {
    ticketHistoryArchive?.controller?.abort();
    ticketHistoryArchive = { userId, date, orders: new Map(), cursor: null, more: true, busy: false, error: false };
  }
  const state = ticketHistoryArchive;
  if (state.busy || !state.more) return;
  state.busy = true;
  state.error = false;
  renderTicketHistory();
  try {
    const { data, error } = await withCloudTimeout((signal) => {
      // Keep the timeout controller available to cancel a superseded date/page.
      const controller = new AbortController();
      state.controller = controller;
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
      let query = client.from("orders")
        .select("id, created_at, business_date, ticket_number, order_json, revision")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(LOCAL_ORDER_CACHE_LIMIT);
      if (date) query = query.eq("business_date", date);
      if (state.cursor) query = query.or(`created_at.lt.${state.cursor.created_at},and(created_at.eq.${state.cursor.created_at},id.lt.${state.cursor.id})`);
      return query.abortSignal(controller.signal);
    });
    if (state !== ticketHistoryArchive || client !== cloudState.client || userId !== cloudState.user?.id) return;
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("No fue posible consultar el historial completo.");
    for (const row of data) {
      if (!row?.id || !row.order_json || typeof row.order_json !== "object") continue;
      state.orders.set(row.id, normalizeOrderNotes({
        ...row.order_json, id: row.id, createdAt: row.created_at,
        businessDate: row.business_date, ticketNumber: row.ticket_number,
        type: normalizeOrderType(row.order_json.type), saved: true,
        _syncRevision: Number(row.revision) || 0, syncStatus: "synced",
      }));
    }
    if (data.length) state.cursor = { id: data[data.length - 1].id, created_at: data[data.length - 1].created_at };
    state.more = data.length === LOCAL_ORDER_CACHE_LIMIT;
  } catch (error) {
    if (state === ticketHistoryArchive && userId === cloudState.user?.id) {
      state.error = true;
      console.warn("No fue posible consultar el historial completo.", error);
    }
  } finally {
    state.busy = false;
    if (state === ticketHistoryArchive) renderTicketHistory();
  }
}

function ticketHistoryPagingHtml() {
  const state = ticketHistoryArchive;
  if (!state || state.userId !== cloudState.user?.id) return "";
  return `<div class="monthly-empty">${escapeHtml(appUiText(state.error
    ? "No fue posible consultar el historial completo."
    : "Los filtros se aplican a los tickets consultados. Carga mas para consultar los anteriores."))}</div>`
    + (state.more ? `<button type="button" data-action="load-more-tickets" ${state.busy ? "disabled" : ""}>${escapeHtml(appUiText(state.busy ? "Cargando tickets..." : "Cargar mas tickets"))}</button>` : "");
}

function ticketHistorySearchText(order) {
  return normalizeSearchText([
    order.ticketNumber,
    order.customer,
    order.server,
    order.type,
    order.paymentMethod,
    ...orderItemsList(order).map((item) => itemReportName(item)),
  ].join(" "));
}

function filteredTicketHistory() {
  const query = normalizeSearchText(elements.ticketHistorySearchInput?.value || "");
  const date = String(elements.ticketHistoryDateInput?.value || "").trim();
  const payment = String(elements.ticketHistoryPaymentFilter?.value || "all");
  return ticketHistoryOrders()
    .filter((order) => !date || orderBusinessDate(order) === date)
    .filter((order) => payment === "all" || normalizePaymentStatus(order.paymentStatus, "unverified") === payment)
    .filter((order) => !query || ticketHistorySearchText(order).includes(query))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function renderTicketHistory() {
  if (!elements.ticketHistoryList) return;
  const orders = filteredTicketHistory();
  if (!orders.length) {
    elements.ticketHistoryList.innerHTML = '<div class="monthly-empty">No hay tickets que coincidan con los filtros.</div>' + ticketHistoryPagingHtml();
    return;
  }
  elements.ticketHistoryList.innerHTML = orders.map((order) => {
    const status = normalizePaymentStatus(order.paymentStatus, "unverified");
    const created = new Date(order.createdAt || 0);
    const createdLabel = Number.isNaN(created.getTime())
      ? orderBusinessDate(order)
      : created.toLocaleString(appUiLocale(), { dateStyle: "short", timeStyle: "short" });
    return `
      <article class="ticket-history-card" data-ticket-id="${escapeHtml(order.id)}">
        <div class="ticket-history-card-main">
          <div>
            <strong>${formatTicket(order.ticketNumber)}</strong>
            <span>${escapeHtml(order.customer || "Sin mesa/cliente")}</span>
          </div>
          <div class="ticket-history-amount">
            <strong>${formatMoney(orderTotal(order))}</strong>
            <span class="payment-status-badge is-${status}">${escapeHtml(paymentStatusLabel(status))}</span>
          </div>
        </div>
        <div class="history-meta">
          <span>${escapeHtml(createdLabel)}</span>
          <span>${orderItemsCount(order)} productos</span>
          <span>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</span>
        </div>
        <div class="ticket-history-actions">
          <button type="button" data-action="open-ticket">Abrir</button>
          <button type="button" data-action="print-ticket">Reimprimir</button>
          <button type="button" data-action="toggle-payment" data-next-status="${status === "paid" ? "pending" : "paid"}">
            ${status === "paid" ? "Marcar por cobrar" : "Marcar cobrado"}
          </button>
        </div>
      </article>
    `;
  }).join("") + ticketHistoryPagingHtml();
}

function openTicketHistoryDialog() {
  if (!elements.ticketHistoryDialog) return;
  if (elements.ticketHistoryDateInput) elements.ticketHistoryDateInput.value = "";
  if (elements.ticketHistoryPaymentFilter) elements.ticketHistoryPaymentFilter.value = "all";
  if (elements.ticketHistorySearchInput) elements.ticketHistorySearchInput.value = "";
  renderTicketHistory();
  elements.ticketHistoryDialog.showModal();
  loadTicketHistoryPage(true).catch(console.error);
}

async function updateTicketPaymentStatus(orderId, status) {
  const index = savedOrders.findIndex((order) => order.id === orderId);
  if (index < 0) return;
  const nextStatus = normalizePaymentStatus(status, "pending");
  savedOrders[index].paymentStatus = nextStatus;
  savedOrders[index].updatedAt = new Date().toISOString();
  savedOrders[index].syncStatus = shouldQueueForCloud()
    ? "pending"
    : "local";
  saveOrders({ immediate: true });
  if (currentOrder.id === orderId) currentOrder = structuredCloneOrder(savedOrders[index]);
  if (cloudState.user && navigator.onLine) {
    const expectedUpdatedAt = savedOrders[index].updatedAt;
    try {
await withCloudTimeout(
  (signal) =>
    saveCloudOrder(
      savedOrders[index],
      signal
    ),
  "La nube tardó demasiado en actualizar el estado de pago.",
  10000
);
      confirmOrderSyncedIfUnchanged(orderId, expectedUpdatedAt);
    } catch (error) {
      console.error(error);
      const currentIndex = savedOrders.findIndex((order) => order.id === orderId);
      if (currentIndex >= 0) savedOrders[currentIndex].syncStatus = "pending";
      schedulePendingOrderRecovery(error);
    }
    saveOrders({ immediate: true });
  }
  updateCloudStatus();
  renderHistory();
  renderTicketHistory();
  renderOrder();
  showToast(`Ticket ${formatTicket(savedOrders[index].ticketNumber)}: ${paymentStatusLabel(nextStatus)}.`);
}

function renderHistory() {
  renderRestaurantDashboard();
  const ordersForToday = todaysOrders();

  if (!ordersForToday.length) {
    elements.historyList.innerHTML = `<div class="history-empty">Aun no hay tickets guardados en este turno.</div>`;
    return;
  }

  elements.historyList.innerHTML = ordersForToday
    .slice(0, 30)
    .map((order) => {
      const created = new Date(order.createdAt);
      const timeText = created.toLocaleTimeString(appUiLocale(), { hour: "2-digit", minute: "2-digit" });
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
          <div class="payment-status-badge is-${normalizePaymentStatus(order.paymentStatus, "unverified")}">
            ${escapeHtml(paymentStatusLabel(order.paymentStatus))}
          </div>
          ${needsCloudSync(order) ? `<div class="sync-badge">Pendiente nube</div>` : ""}
          <button type="button" data-history-id="${escapeHtml(order.id)}">Abrir / reimprimir</button>
        </article>
      `;
    })
    .join("");
}

function renderMonthlyClose(month = currentMonthKey()) {
  if (!normalizedCloudClosureReport("month", month)) {
    elements.closeMonthInput.value = month;
    elements.printCloseButton.disabled = true;
    elements.monthlyCloseContent.innerHTML = '<div class="monthly-empty">Cierre no verificado. Conecta con la nube y vuelve a abrir el cierre para obtener todos los pedidos.</div>';
    return { month, tickets: 0 };
  }
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

function renderAnnualClose(year = currentYearKey()) {
  if (!normalizedCloudClosureReport("year", String(year))) {
    elements.closeYearInput.value = year;
    elements.printAnnualCloseButton.disabled = true;
    elements.annualCloseContent.innerHTML = '<div class="monthly-empty">Cierre no verificado. Conecta con la nube y vuelve a abrir el cierre para obtener todos los pedidos.</div>';
    return { year: String(year), tickets: 0 };
  }
  const report = buildAnnualClose(String(year));
  elements.closeYearInput.value = report.year;
  elements.printAnnualCloseButton.disabled = report.tickets === 0;
  if (!report.tickets) {
    elements.annualCloseContent.innerHTML = `<div class="monthly-empty">No hay pedidos guardados para ${escapeHtml(report.year)}.</div>`;
    return report;
  }

  elements.annualCloseContent.innerHTML = `
    <div class="monthly-summary-grid">
      <div class="monthly-metric"><span>Total vendido</span><strong>${formatMoney(report.total)}</strong></div>
      <div class="monthly-metric"><span>Tickets</span><strong>${report.tickets}</strong></div>
      <div class="monthly-metric"><span>Productos</span><strong>${report.items}</strong></div>
      <div class="monthly-metric"><span>Promedio</span><strong>${formatMoney(report.average)}</strong></div>
    </div>
    <h3 class="monthly-section-title">Detalle por mes</h3>
    <div class="monthly-table">
      <div class="monthly-table-row header"><span>Mes</span><span>Tickets</span><span>Items</span><span>Total</span></div>
      ${report.months.map((month) => `<div class="monthly-table-row"><strong>${escapeHtml(formatMonthLabel(month.month))}</strong><span>${month.tickets}</span><span>${month.items}</span><strong>${formatMoney(month.total)}</strong></div>`).join("")}
    </div>
    <h3 class="monthly-section-title">Productos vendidos</h3>
    <div class="monthly-table">
      <div class="monthly-table-row header"><span>Producto</span><span>Cantidad</span><span></span><span>Total</span></div>
      ${report.products.map((product) => `<div class="monthly-table-row"><strong>${escapeHtml(product.name)}</strong><span>${product.qty}</span><span></span><strong>${formatMoney(product.total)}</strong></div>`).join("")}
    </div>`;
  return report;
}

function renderDailyClose(day = todayKey) {
  if (!normalizedCloudClosureReport("day", day)) {
    elements.closeDayInput.value = day;
    elements.printDailyCloseButton.disabled = true;
    elements.dailyCloseContent.innerHTML = '<div class="monthly-empty">Cierre no verificado. Conecta con la nube y vuelve a abrir el cierre para obtener todos los pedidos.</div>';
    return { day, tickets: 0 };
  }
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

async function confirmCloudPeriodClosure(periodType, anchorDate) {
  if (!cloudState.client || !cloudState.user || !navigator.onLine) throw new Error("Se necesita conexion para confirmar el cierre completo.");
  if (pendingOrdersCount() || pendingDeletedOrdersCount()) throw new Error("Hay pedidos pendientes de sincronizar. No se puede confirmar un cierre incompleto.");
  const client = cloudState.client;
  const userId = cloudState.user.id;
  const { error } = await client.rpc("close_current_restaurant_period", {
    p_period_type: periodType,
    p_anchor_date: anchorDate,
  });
  if (error) {
    if (["42883", "PGRST202"].includes(error.code)) {
      throw new Error("La confirmacion de cierres aun no esta disponible. Contacta al soporte de la plataforma.");
    }
    throw error;
  }
  if (client !== cloudState.client || userId !== cloudState.user?.id) throw new Error("La sesion cambio durante el cierre.");
  return true;
}

function renderPrintDailyClose(report) {
  const printedAt = new Date();
  const dateText = printedAt.toLocaleDateString(appUiLocale());
  const timeText = printedAt.toLocaleTimeString(appUiLocale(), { hour: "2-digit", minute: "2-digit" });
  const ticketRange =
    report.firstTicket && report.lastTicket
      ? `${formatTicket(report.firstTicket)} - ${formatTicket(report.lastTicket)}`
      : appUiText("Sin rango");

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <div class="receipt-number">${escapeHtml(appUiText("CIERRE DIA"))}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Dia:"))}</strong><span>${escapeHtml(report.label)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Impreso:"))}</strong><span>${escapeHtml(dateText)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Hora:"))}</strong><span>${escapeHtml(timeText)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Tickets:"))}</strong><span>${escapeHtml(ticketRange)}</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Total caja:"))}</strong><span>${formatMoney(report.total)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Cant tickets:"))}</strong><span>${report.tickets}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Productos:"))}</strong><span>${report.items}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Promedio:"))}</strong><span>${formatMoney(report.average)}</span></div>
    <div class="receipt-divider"></div>
    <p><strong>${escapeHtml(appUiText("TIPO DE PEDIDO"))}</strong></p>
    <div class="receipt-items">
      ${report.orderTypes
        .map(
          (type) => `
            <div class="receipt-item">
              <strong>${escapeHtml(type.label)}: ${formatMoney(type.total)}</strong>
              <div>${type.tickets} ${escapeHtml(appUiText("Tickets"))}</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p><strong>${escapeHtml(appUiText("METODOS DE PAGO"))}</strong></p>
    <div class="receipt-items">
      ${report.paymentMethods
        .map(
          (method) => `
            <div class="receipt-item">
              <strong>${escapeHtml(method.label)}: ${formatMoney(method.total)}</strong>
              <div>${method.tickets} ${escapeHtml(appUiText("Tickets"))}</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p><strong>${escapeHtml(appUiText("TOMARON PEDIDOS"))}</strong></p>
    <div class="receipt-items">
      ${report.servers
        .map(
          (server) => `
            <div class="receipt-item">
              <strong>${escapeHtml(server.name)}: ${formatMoney(server.total)}</strong>
              <div>${server.tickets} ${escapeHtml(appUiText("Tickets"))}</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p><strong>${escapeHtml(appUiText("PRODUCTOS"))}</strong></p>
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
    <p class="receipt-total">${escapeHtml(appUiText("FIN DEL CIERRE DIA"))}</p>
  `;
}

async function printDailyClose() {
  const day = elements.closeDayInput.value || todayKey;
  await prepareCloudPeriodClosure("day", day);
  const report = renderDailyClose(day);
  if (!report.tickets) {
    alert("No hay pedidos guardados para imprimir en ese dia.");
    return;
  }

  const confirmed = await confirmCloudPeriodClosure("day", report.day);
  renderPrintDailyClose(report);
  await printRenderedTicket();
  showToast(confirmed ? "Cierre diario confirmado en la nube." : "Cierre diario impreso sin confirmacion en la nube.");
}

function renderPrintMonthlyClose(report) {
  const printedAt = new Date();
  const dateText = printedAt.toLocaleDateString(appUiLocale());
  const timeText = printedAt.toLocaleTimeString(appUiLocale(), { hour: "2-digit", minute: "2-digit" });

  elements.printTicket.innerHTML = `
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <div class="receipt-number">${escapeHtml(appUiText("CIERRE MES"))}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Mes:"))}</strong><span>${escapeHtml(report.label)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Fecha:"))}</strong><span>${escapeHtml(dateText)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Hora:"))}</strong><span>${escapeHtml(timeText)}</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Total vendido:"))}</strong><span>${formatMoney(report.total)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Tickets:"))}</strong><span>${report.tickets}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Productos:"))}</strong><span>${report.items}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Promedio:"))}</strong><span>${formatMoney(report.average)}</span></div>
    <div class="receipt-divider"></div>
    <p><strong>${escapeHtml(appUiText("DETALLE POR DIA"))}</strong></p>
    <div class="receipt-items">
      ${report.days
        .map(
          (day) => `
            <div class="receipt-item">
              <strong>${escapeHtml(formatDayLabel(day.day))}: ${formatMoney(day.total)}</strong>
              <div>${day.tickets} ${escapeHtml(appUiText("Tickets"))} / ${day.items} ${escapeHtml(appUiText("Productos"))}</div>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-divider"></div>
    <p><strong>${escapeHtml(appUiText("PRODUCTOS"))}</strong></p>
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
    <p class="receipt-total">${escapeHtml(appUiText("FIN DEL CIERRE"))}</p>
  `;
}

async function printMonthlyClose() {
  const month = elements.closeMonthInput.value || currentMonthKey();
  await prepareCloudPeriodClosure("month", month);
  const report = renderMonthlyClose(month);
  if (!report.tickets) {
    alert("No hay pedidos guardados para imprimir en ese mes.");
    return;
  }

  const confirmed = await confirmCloudPeriodClosure("month", `${report.month}-01`);
  renderPrintMonthlyClose(report);
  await printRenderedTicket();
  showToast(confirmed ? "Cierre mensual confirmado en la nube." : "Cierre mensual impreso sin confirmacion en la nube.");
}

function renderPrintAnnualClose(report) {
  const printedAt = new Date();
  elements.printTicket.innerHTML = `
    <div class="receipt-brand">${escapeHtml(businessName)}</div>
    <div class="receipt-number">${escapeHtml(appUiText("CIERRE ANUAL"))}</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Ano:"))}</strong><span>${escapeHtml(report.year)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Impreso:"))}</strong><span>${escapeHtml(printedAt.toLocaleString(appUiLocale()))}</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Total:"))}</strong><span>${formatMoney(report.total)}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Tickets:"))}</strong><span>${report.tickets}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Productos:"))}</strong><span>${report.items}</span></div>
    <div class="receipt-row"><strong>${escapeHtml(appUiText("Promedio:"))}</strong><span>${formatMoney(report.average)}</span></div>
    <div class="receipt-divider"></div>
    <p><strong>${escapeHtml(appUiText("DETALLE POR MES"))}</strong></p>
    <div class="receipt-items">${report.months.map((month) => `<div class="receipt-item"><strong>${escapeHtml(formatMonthLabel(month.month))}: ${formatMoney(month.total)}</strong><div>${month.tickets} ${escapeHtml(appUiText("Tickets"))} / ${month.items} ${escapeHtml(appUiText("Productos"))}</div></div>`).join("")}</div>
    <div class="receipt-divider"></div>
    <p class="receipt-total">${escapeHtml(appUiText("FIN DEL CIERRE ANUAL"))}</p>`;
}

async function printAnnualClose() {
  const year = elements.closeYearInput.value || currentYearKey();
  await prepareCloudPeriodClosure("year", year);
  const report = renderAnnualClose(year);
  if (!report.tickets) {
    alert("No hay pedidos guardados para imprimir en ese ano.");
    return;
  }
  const confirmed = await confirmCloudPeriodClosure("year", `${report.year}-01-01`);
  renderPrintAnnualClose(report);
  await printRenderedTicket();
  showToast(confirmed ? "Cierre anual confirmado en la nube." : "Cierre anual impreso sin confirmacion en la nube.");
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
    `Cancelar el pedido ${ticketLabel}? Se conservara en el historial como anulado.`
  );
  if (!shouldCancel) return;

  const cancelledOrderId = currentOrder.id;
  const wasSaved = Boolean(currentOrder.saved && cancelledOrderId);

  if (wasSaved) {
    const cancelledAt = new Date().toISOString();
    const cancelledOrder = normalizeCurrentOrderDraft({
      ...structuredCloneOrder(currentOrder),
      status: "cancelled",
      canonicalStatus: "cancelled",
      cancelledAt,
      cancellationReason: "Cancelado por el restaurante",
      syncStatus: cloudState.user && navigator.onLine ? "synced" : "pending",
    });
    savedOrders = savedOrders.map((order) =>
  order.id === cancelledOrderId
    ? cancelledOrder
    : order
);
    saveOrders({ immediate: true });

    if (cloudState.user && navigator.onLine) {
      try {
        await voidCloudOrder(cancelledOrderId, cancelledOrder.cancellationReason);
        clearDeletedOrderId(cancelledOrderId);
      } catch (error) {
        console.error(error);
        setOrderSyncStatus(cancelledOrderId, "pending");
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
  showToast(wasSaved ? `Pedido ${ticketLabel} cancelado y conservado en el historial.` : "Pedido nuevo cancelado.");
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

function loadOrder(orderId, historicalOrder = null) {
  const order = historicalOrder?.id === orderId ? historicalOrder : savedOrders.find((item) => item.id === orderId);
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
      queueTicketCounter(number);
      updateCloudStatus();
    }
  } else if (shouldQueueForCloud()) {
    queueTicketCounter(number);
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
  if (menuSearchTimer) {
    window.clearTimeout(menuSearchTimer);
    menuSearchTimer = null;
  }
  activeCategory = resolvedCategory;
  applyMenuSearch("");
});

if (elements.menuSearchInput) {
  elements.menuSearchInput.addEventListener("input", () => {
    if (menuSearchTimer) window.clearTimeout(menuSearchTimer);
    const value = elements.menuSearchInput.value;
    menuSearchTimer = window.setTimeout(() => {
      menuSearchTimer = null;
      applyMenuSearch(value);
    }, 120);
  });
}

if (elements.menuSearchClearButton) {
  elements.menuSearchClearButton.addEventListener("click", () => {
    if (menuSearchTimer) {
      window.clearTimeout(menuSearchTimer);
      menuSearchTimer = null;
    }
    applyMenuSearch("");
    if (elements.menuSearchInput) elements.menuSearchInput.focus();
  });
}

elements.menuGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".dish-button");
  if (!button) return;
  addItem(button.dataset.name, button.dataset.price, button.dataset.station, button.dataset.productId);
});

elements.customItemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addItem(elements.customItemName.value, elements.customItemPrice.value, "kitchen");
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

elements.authCountryCodeInput?.addEventListener("change", () => {
  const countryCode = normalizeTextSetting(elements.authCountryCodeInput.value).toUpperCase();
  restaurantRegistrationRegion = {
    ...restaurantRegistrationRegion,
    countryCode,
    country: countryCode === "PL" ? "Polonia" : countryCode === "CO" ? "Colombia" : "",
    timezone: countryCode === "PL" ? "Europe/Warsaw" : countryCode === "CO" ? "America/Bogota" : "",
  };
  renderRestaurantRegionSuggestions(countryCode);
  marketplaceAccountState = null;
  renderMarketplaceAccountState();
  prepareRestaurantPlaceAutocomplete().catch(() => {});
});
document.querySelector("#autoLanguageSelect")?.addEventListener("change", () => {
  queueMicrotask(() => {
    if (elements.restaurantAuthDialog?.open) setRestaurantAuthMode(elements.authForm.dataset.mode);
  });
});
elements.restaurantCountryCodeInput?.addEventListener("change", () => {
  const countryCode = normalizeTextSetting(elements.restaurantCountryCodeInput.value).toUpperCase();
  restaurantRegistrationRegion = {
    ...restaurantRegistrationRegion,
    countryCode,
    country: countryCode === "PL" ? "Polonia" : countryCode === "CO" ? "Colombia" : "",
    timezone: countryCode === "PL" ? "Europe/Warsaw" : countryCode === "CO" ? "America/Bogota" : "",
  };
  renderRestaurantRegionSuggestions(countryCode);
  marketplaceAccountState = null;
  renderMarketplaceAccountState();
  prepareRestaurantPlaceAutocomplete().catch(() => {});
});
[elements.authCityInput, elements.authLegalAddressInput, elements.restaurantCityInput, elements.restaurantAddressInput].forEach((input) => {
  input?.addEventListener("focus", () => prepareRestaurantPlaceAutocomplete().catch(() => {}), { once: true });
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
elements.cloudStatus?.addEventListener("click", () => {
  const message =
    elements.cloudStatus?.title ||
    cloudState.lastError ||
    cloudState.moduleWarning;

  if (message) {
    alert(message);
  }
});
elements.openSignInButton.addEventListener("click", openSignInScreen);
elements.signOutButton.addEventListener("click", signOut);
elements.closeRestaurantButton?.addEventListener("click", toggleRestaurantOperationalOpen);
elements.mainRestaurantToggleButton?.addEventListener("click", toggleRestaurantOperationalOpen);
elements.restaurantScheduleModeInput?.addEventListener("change", async (event) => {
  await setRestaurantOperationalMode(event.target.checked ? "schedule" : "manual");
});
elements.requestRestaurantDeletionButton?.addEventListener("click", requestRestaurantDeletion);
elements.confirmRestaurantDeletionButton?.addEventListener("click", confirmRestaurantDeletion);
elements.cancelRestaurantDeletionButton?.addEventListener("click", () => elements.restaurantDeletionDialog?.close());
elements.saveRestaurantHoursButton?.addEventListener("click", saveRestaurantHours);
elements.restaurantHoursGrid?.addEventListener("change", (event) => {
  if (!event.target.matches("[data-hours-enabled]")) return;
  const row = event.target.closest("[data-day]");
  row?.querySelectorAll("input[type='time']").forEach((input) => {
    input.disabled = !event.target.checked;
  });
});
elements.qrButton.addEventListener("click", openQrDialog);
elements.waiterTeamButton?.addEventListener("click", openWaiterTeamDialog);
elements.copyWaiterLinkButton?.addEventListener("click", copyWaiterLink);
elements.openWaiterLinkButton?.addEventListener("click", openWaiterLink);
elements.authorizeWaiterButton?.addEventListener("click", authorizeWaiter);
elements.refreshWaiterMembersButton?.addEventListener("click", () => {
  Promise.all([loadWaiterMembers(), loadEmployeeHours()]).catch(() => {});
});
elements.waiterMembersList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  const row = event.target.closest("[data-member-id]");
  if (!button || !row) return;
  if (button.dataset.action === "confirm-waiter") {
    button.disabled = true;
    try {
      await confirmWaiterInvitation(row.dataset.memberEmail, row.dataset.station, row.dataset.memberName);
    } finally {
      if (button.isConnected) button.disabled = false;
    }
    return;
  }
  if (button.dataset.action !== "toggle-waiter") return;
  const pending = row.dataset.pending === "true";
  const nextActive = button.dataset.nextActive === "true";
  if (!nextActive) {
    const prompt = pending
      ? "¿Cancelar esta invitacion de personal?"
      : "¿Desactivar el acceso de este empleado?";
    if (!window.confirm(prompt)) return;
  }
  button.disabled = true;
  try {
    await toggleWaiterMembership(
      row.dataset.memberId,
      row.dataset.memberEmail,
      row.dataset.station,
      nextActive,
      pending
    );
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});
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
  if (button.dataset.action === "assign-nearest-courier") assignNearestCourierForOrder(card.dataset.clientOrderId);
  if (button.dataset.action === "sent-client-order") markClientOrderSent(card.dataset.clientOrderId);
  if (button.dataset.action === "delivered-client-order") markClientOrderDelivered(card.dataset.clientOrderId);
  if (button.dataset.action === "load-client-chat") loadAndOpenRestaurantChat(card.dataset.clientOrderId);
  if (button.dataset.action === "send-client-message") sendRestaurantChatMessage(card.dataset.clientOrderId, card);
});

elements.saveOrderButton.addEventListener("click", async () => {
  const button = elements.saveOrderButton;
  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = appUiText("Guardando...");
  updateCloudStatus(appUiText("Guardando pedido..."));
  try {
    if (!(await upsertCurrentOrder())) return;

    const savedTicketNumber = currentOrder.ticketNumber;

    const syncMessage = needsCloudSync(currentOrder)
      ? " Guardado localmente; se subira cuando vuelva internet."
      : "";

    startNewOrder();

    showToast(
      `Pedido ${formatTicket(savedTicketNumber)} guardado.${syncMessage} Nuevo ticket listo.`
    );
  } finally {
    button.textContent = previousLabel;
    button.disabled = currentOrder.items.length === 0;
    updateCloudStatus();
  }
});

elements.printOrderButton.addEventListener("click", printCurrentOrder);
elements.downloadTicketPdfButton.addEventListener("click", downloadCurrentTicketPdf);
elements.connectThermalPrinterButton?.addEventListener("click", connectThermalPrinter);
elements.correctOrderButton.addEventListener("click", beginCorrectCurrentOrder);
elements.cancelOrderButton.addEventListener("click", cancelCurrentOrder);
elements.newOrderButton.addEventListener("click", startNewOrder);
elements.clearOrderButton.addEventListener("click", clearCurrentOrder);

elements.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-history-id]");
  if (!button) return;
  loadOrder(button.dataset.historyId);
});

elements.ticketHistoryButton?.addEventListener("click", openTicketHistoryDialog);
elements.refreshTicketHistoryButton?.addEventListener("click", () => loadTicketHistoryPage(true).catch(console.error));
elements.ticketHistorySearchInput?.addEventListener("input", renderTicketHistory);
elements.ticketHistoryDateInput?.addEventListener("change", () => loadTicketHistoryPage(true).catch(console.error));
elements.ticketHistoryDialog?.addEventListener("close", () => {
  ticketHistoryArchive?.controller?.abort();
  ticketHistoryArchive = null;
});
elements.ticketHistoryPaymentFilter?.addEventListener("change", renderTicketHistory);
elements.ticketHistoryList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (button?.dataset.action === "load-more-tickets") {
    await loadTicketHistoryPage();
    return;
  }
  const card = event.target.closest("[data-ticket-id]");
  if (!button || !card) return;
  const order = ticketHistoryOrders().find((item) => item.id === card.dataset.ticketId);
  if (!order) return;
  if (button.dataset.action === "toggle-payment") {
    const index = savedOrders.findIndex((item) => item.id === order.id);
    if (index < 0) savedOrders.push(order);
    else savedOrders[index] = order;
  }
  if (button.dataset.action === "open-ticket") {
    loadOrder(order.id, order);
    elements.ticketHistoryDialog?.close();
    return;
  }
  if (button.dataset.action === "print-ticket") {
    renderPrintTicket(order);
    await printRenderedTicket();
    return;
  }
  if (button.dataset.action === "toggle-payment") {
    button.disabled = true;
    try {
      await updateTicketPaymentStatus(order.id, button.dataset.nextStatus);
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }
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

elements.dailyCloseButton.addEventListener(
  "click",
  async () => {

    elements.dailyCloseButton.disabled = true;

    try {

      /*
       * Antes de calcular el cierre:
       * sincronizamos los cambios locales pendientes
       * y después descargamos la información
       * actualizada de Supabase.
       */

      if (
        cloudState.client &&
        cloudState.user &&
        navigator.onLine
      ) {

        await syncPendingData({
          silent: true,
          allowWhileLoading: true,
        });

        todayKey = restaurantBusinessContext?.businessDate || currentBusinessDate();
        await loadCloudOrdersForReport("day", todayKey);

      }

      todayKey = restaurantBusinessContext?.businessDate || currentBusinessDate();

      renderDailyClose(todayKey);

      elements.dailyCloseDialog.showModal();

    } catch (error) {

      console.error(
        "No fue posible verificar la nube antes del cierre:",
        error
      );

      /*
       * Nunca eliminamos los datos locales.
       * No usamos la cache parcial como cierre completo.
       */

      todayKey = restaurantBusinessContext?.businessDate || currentBusinessDate();

      renderDailyClose(todayKey);

      elements.dailyCloseDialog.showModal();

      showToast(
        "Cierre no verificado. No fue posible obtener todos los pedidos de la nube."
      );

    } finally {

      elements.dailyCloseButton.disabled = false;

    }

  }
);

elements.closeDayInput.addEventListener("change", async () => {
  const day = elements.closeDayInput.value || todayKey;
  try {
    await loadCloudOrdersForReport("day", day);
  } catch (error) {
    console.warn("No fue posible actualizar el cierre diario desde Supabase.", error);
    showToast("Cierre no verificado. No fue posible obtener todos los pedidos de la nube.");
  }
  renderDailyClose(day);
});

elements.printDailyCloseButton.addEventListener("click", () => {
  printDailyClose().catch((error) => {
    console.error(error);
    alert("No fue posible confirmar el cierre diario.");
  });
});

elements.monthlyCloseButton.addEventListener(
  "click",
  async () => {

    elements.monthlyCloseButton.disabled = true;

    try {

      if (
        cloudState.client &&
        cloudState.user &&
        navigator.onLine
      ) {

        await syncPendingData({
          silent: true,
          allowWhileLoading: true,
        });

        await loadCloudOrdersForReport("month", currentMonthKey());

      }

      renderMonthlyClose(
        currentMonthKey()
      );

      elements.monthlyCloseDialog.showModal();

    } catch (error) {

      console.error(
        "No fue posible verificar la nube antes del cierre mensual:",
        error
      );

      renderMonthlyClose(
        currentMonthKey()
      );

      elements.monthlyCloseDialog.showModal();

      showToast(
        "Cierre no verificado. No fue posible obtener todos los pedidos de la nube."
      );

    } finally {

      elements.monthlyCloseButton.disabled = false;

    }

  }
);

elements.closeMonthInput.addEventListener("change", async () => {
  const month = elements.closeMonthInput.value || currentMonthKey();
  try {
    await loadCloudOrdersForReport("month", month);
  } catch (error) {
    console.warn("No fue posible actualizar el cierre mensual desde Supabase.", error);
    showToast("Cierre no verificado. No fue posible obtener todos los pedidos de la nube.");
  }
  renderMonthlyClose(month);
});

elements.printCloseButton.addEventListener("click", () => {
  printMonthlyClose().catch((error) => {
    console.error(error);
    alert("No fue posible confirmar el cierre mensual.");
  });
});

elements.annualCloseButton?.addEventListener("click", async () => {
  elements.annualCloseButton.disabled = true;
  try {
    if (cloudState.client && cloudState.user && navigator.onLine) {
      await syncPendingData({ silent: true, allowWhileLoading: true });
      await loadCloudOrdersForReport("year", currentYearKey());
    }
    renderAnnualClose(currentYearKey());
    elements.annualCloseDialog.showModal();
  } catch (error) {
    console.error("No fue posible verificar la nube antes del cierre anual:", error);
    renderAnnualClose(currentYearKey());
    elements.annualCloseDialog.showModal();
    showToast("Cierre no verificado. No fue posible obtener todos los pedidos de la nube.");
  } finally {
    elements.annualCloseButton.disabled = false;
  }
});
elements.closeYearInput?.addEventListener("change", async () => {
  const year = elements.closeYearInput.value || currentYearKey();
  try {
    await loadCloudOrdersForReport("year", year);
  } catch (error) {
    console.warn("No fue posible actualizar el cierre anual desde Supabase.", error);
    showToast("Cierre no verificado. No fue posible obtener todos los pedidos de la nube.");
  }
  renderAnnualClose(year);
});
elements.printAnnualCloseButton?.addEventListener("click", () => {
  printAnnualClose().catch((error) => {
    console.error(error);
    alert("No fue posible confirmar el cierre anual.");
  });
});
function showRestaurantEditSection(sectionName) {
  const tabs = [
    elements.restaurantInfoTabButton,
    elements.restaurantHoursTabButton,
    elements.restaurantMenuTabButton,
  ];

  const sections = [
    elements.restaurantInfoSection,
    elements.restaurantHoursSection,
    elements.restaurantMenuSection,
  ];

  tabs.forEach((tab) => {
    if (!tab) return;

    const isActive = tab.dataset.editSection === sectionName;

    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  sections.forEach((section) => {
    if (!section) return;

    const isActive = section.dataset.editPanel === sectionName;

    section.hidden = !isActive;
    section.classList.toggle("is-active", isActive);
  });
}

elements.restaurantInfoTabButton?.addEventListener("click", () => {
  showRestaurantEditSection("restaurant-info");
});

elements.restaurantHoursTabButton?.addEventListener("click", () => {
  showRestaurantEditSection("restaurant-hours");
});

elements.restaurantMenuTabButton?.addEventListener("click", () => {
  showRestaurantEditSection("restaurant-menu");
});
elements.editMenuButton.addEventListener("click", openMenuEditor);
elements.restaurantDashboardSummary?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-restaurant-dashboard-action]");
  if (!button) return;
  handleRestaurantDashboardAction(button.dataset.restaurantDashboardAction);
});

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
// ============================================================
// SEGURIDAD - VACIAR MENU
// PASO 1: cancelar y validar frase de confirmacion
// ============================================================

if (elements.cancelMenuClearButton) {
  elements.cancelMenuClearButton.addEventListener("click", () => {
    if (elements.menuClearConfirmationInput) {
      elements.menuClearConfirmationInput.value = "";
    }

    if (elements.menuClearPasswordInput) {
      elements.menuClearPasswordInput.value = "";
    }

    if (elements.menuClearSecurityMessage) {
      elements.menuClearSecurityMessage.textContent = "";
      elements.menuClearSecurityMessage.hidden = true;
    }

    if (elements.menuClearSecurityDialog?.open) {
      elements.menuClearSecurityDialog.close();
    }
  });
}

if (elements.confirmMenuClearButton) {
  elements.confirmMenuClearButton.addEventListener("click", clearMenuSecurely);
}
elements.saveCurrencyButton.addEventListener("click", saveCurrencySymbol);
elements.saveCustomerSettingsButton.addEventListener("click", saveCurrencySymbol);
elements.marketplaceAccountButton?.addEventListener("click", configureMarketplaceAccount);
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
      applyBusinessNameToUi();
      showToast("Logo optimizado. Presiona guardar ajustes para subirlo.");
    } catch (error) {
      const message = String(error?.message || "");
      alert(/Selecciona una imagen valida|imagen es muy pesada|imagen sigue muy pesada/i.test(message)
        ? message
        : "No se pudo cargar el logo.");
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
    const message = String(error?.message || "");
    alert(/Selecciona una imagen valida|imagen es muy pesada|imagen sigue muy pesada/i.test(message)
      ? message
      : "No se pudo cargar la foto.");
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
  saveMenuCache({ immediate: true });
  syncFormToOrder();
  saveCurrentOrderDraft();
  saveOrders({ immediate: true });

  stopClientOrdersPolling();
  stopClientOrdersRealtime();
  stopCentralRealtime();
  stopRestaurantStatusSync();
});


window.addEventListener("offline", () => {
  centralRealtimeNeedsCatchup =
    CENTRAL_REALTIME_ENABLED;

  clientOrdersRealtimeNeedsCatchup = true;

  renderCloudState();
});
function recoverCloudConnection() {
  if (cloudRecoveryInFlight) {
    return cloudRecoveryInFlight;
  }

  if (
    Date.now() - cloudRecoveryLastCompletedAt <
    CLOUD_RECOVERY_DEDUP_MS
  ) {
    return Promise.resolve(true);
  }

  const operation = (async () => {
    if (cloudState.configured && !cloudState.client) {
      await initializeCloud();
    }

    if (
      !navigator.onLine ||
      !cloudState.client ||
      !cloudState.user
    ) {
      updateRestaurantStatusSync();
      updateCloudStatus();
      return false;
    }

if (hasPendingDataToSync()) {
  await syncPendingData({ silent: true });
}
const needsCentralCatchup =
  CENTRAL_REALTIME_ENABLED &&
  (
    centralRealtimeNeedsCatchup ||
    !centralSyncChannel ||
    centralSyncStatus !== "SUBSCRIBED"
  );
const needsClientCatchup = canUseCustomerModule() && (
  clientOrdersRealtimeNeedsCatchup || !clientOrdersChannel ||
  clientOrdersRealtimeStatus !== "SUBSCRIBED"
);
const centralRefreshSucceeded = !needsCentralCatchup ||
  await refreshCentralCloudState();

if (!centralRefreshSucceeded) {
  updateCloudStatus();
  return false;
}

if (needsClientCatchup) {
  const refreshed = await refreshClientOrders({ silent: true, reconcileAfterInFlight: true });
  if (refreshed === false) {
    clientOrdersRealtimeNeedsCatchup = true;
    updateCloudStatus();
    return false;
  }
}

centralRealtimeNeedsCatchup = false;
clientOrdersRealtimeNeedsCatchup = false;

startCentralRealtime();
startClientOrdersRealtime();

updateRestaurantStatusSync();
    
await syncRestaurantOperationalStatus({
      silent: true,
    });

    updateCloudStatus();
    cloudRecoveryLastCompletedAt = Date.now();
    return true;
  })();

  cloudRecoveryInFlight = operation;

  operation.then(
    () => {
      if (cloudRecoveryInFlight === operation) {
        cloudRecoveryLastCompletedAt = Date.now();
        cloudRecoveryInFlight = null;
      }
    },
    () => {
      cloudRecoveryLastCompletedAt = Date.now();
      if (cloudRecoveryInFlight === operation) {
        cloudRecoveryInFlight = null;
      }
    }
  );

  return operation;
}

window.addEventListener("online", () => {
  updateCloudStatus("Conectando...");

  recoverCloudConnection().catch((error) => {
    console.error(
      "Error recuperando sincronización después de volver Internet.",
      error
    );
    updateCloudStatus();
  });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;

  recoverCloudConnection().catch((error) => {
    console.error(
      "Error resincronizando la app al volver al primer plano.",
      error
    );
    updateCloudStatus();
  });
});
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

renderRestaurantRegionSuggestions(restaurantRegistrationRegion.countryCode);
applyBusinessNameToUi();
applyReceiptPrintStyle();
restoreThermalPrinterPort();
renderCategories();
renderMenu();
renderOrder();
renderHistory();
renderRestaurantStatus();
initializeCloud().catch((error) => {
  console.error(error);
  cloudState.authChecked = true;
  renderCloudState();
  const friendlyMessage = navigator.onLine ? setCloudError(error) : "Sin internet. Puedes continuar con los datos guardados.";
  elements.authMessage.textContent = friendlyMessage;
});
