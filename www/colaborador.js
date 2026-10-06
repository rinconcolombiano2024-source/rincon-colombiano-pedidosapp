const COURIER_VAPID_PUBLIC_KEY = "BJzCszQo4HrAtXYFQBkA_HSiqTjSqPGIa-InDIqgYc1Bqcq3V2Cj4lAuN-HcV0fO1Z95EPNx-qhJU85Rl4nxJxE";
const COURIER_APP_VERSION = "v91.0.4";
const courierParams = new URLSearchParams(window.location.search);
const COURIER_PLATFORM_SCOPE_ID = "00000000-0000-0000-0000-000000000000";
const COURIER_DOCUMENT_BUCKET = "courier-documents";
const COURIER_GOOGLE_MAPS_KEY_STORAGE = "rincon_colombiano_google_maps_api_key";

// Rendimiento: límites conservadores que reducen trabajo repetido sin
// sacrificar pedidos, Realtime, GPS ni recuperación de sesión.
const COURIER_MAP_RENDER_MIN_MS = 1_500;
const COURIER_RUNTIME_RESUME_MIN_MS = 5_000;
const COURIER_PROFILE_REFRESH_MIN_MS = 30_000;
const COURIER_HISTORY_REFRESH_MIN_MS = 30_000;
const COURIER_PAYOUT_REFRESH_MIN_MS = 5 * 60_000;
const COURIER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
const COURIER_BROWSER_LANGUAGE = String(navigator.language || "es").toLowerCase();
const COURIER_MONEY_FORMATTER = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function courierDetectedRegion(coords = null) {
  const latitude = Number(coords?.latitude ?? coords?.lat);
  const longitude = Number(coords?.longitude ?? coords?.lng);
  const timezone = COURIER_TIMEZONE;
  const browserLanguage = COURIER_BROWSER_LANGUAGE;
  let countryCode = "";
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    if (latitude >= 49 && latitude <= 55.2 && longitude >= 14 && longitude <= 24.3) countryCode = "PL";
    if (latitude >= -5 && latitude <= 14.5 && longitude >= -82 && longitude <= -66) countryCode = "CO";
  }
  if (!countryCode && timezone === "Europe/Warsaw") countryCode = "PL";
  if (!countryCode && timezone === "America/Bogota") countryCode = "CO";
  if (!countryCode && browserLanguage.startsWith("pl")) countryCode = "PL";
  if (!countryCode && browserLanguage.startsWith("es-co")) countryCode = "CO";
  const savedLanguage = String(localStorage.getItem("rincon_colombiano_app_language") || "").toLowerCase();
  const preferredLanguage = ["es", "pl", "en"].includes(savedLanguage)
    ? savedLanguage
    : browserLanguage.startsWith("pl")
      ? "pl"
      : browserLanguage.startsWith("en")
        ? "en"
        : "es";
  return {
    country: countryCode === "PL" ? "Polonia" : countryCode === "CO" ? "Colombia" : "",
    countryCode,
    city: "",
    region: "",
    postalCode: "",
    timezone,
    preferredLanguage,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

const courierElements = {
  accountSummary: document.querySelector("#courierAccountSummary"),
  authFields: document.querySelector("#courierAuthFields"),
  emailInput: document.querySelector("#courierEmailInput"),
  passwordInput: document.querySelector("#courierPasswordInput"),
  signInButton: document.querySelector("#courierSignInButton"),
  signUpButton: document.querySelector("#courierSignUpButton"),
  resetPasswordButton: document.querySelector("#courierResetPasswordButton"),
  resendVerificationButton: document.querySelector("#courierResendVerificationButton"),
  passwordRecoveryPanel: document.querySelector("#courierPasswordRecoveryPanel"),
  newPasswordInput: document.querySelector("#courierNewPasswordInput"),
  updatePasswordButton: document.querySelector("#courierUpdatePasswordButton"),
  cancelRecoveryButton: document.querySelector("#courierCancelRecoveryButton"),
  signOutButton: document.querySelector("#courierSignOutButton"),
  authMessage: document.querySelector("#courierAuthMessage"),
  profileStatus: document.querySelector("#courierProfileStatus"),
  statusBadge: document.querySelector("#courierStatusBadge"),
  registrationPanel: document.querySelector("#courierRegistrationPanel"),
  firstNameInput: document.querySelector("#courierFirstNameInput"),
  lastNameInput: document.querySelector("#courierLastNameInput"),
  phoneInput: document.querySelector("#courierPhoneInput"),
  birthDateInput: document.querySelector("#courierBirthDateInput"),
  countryInput: document.querySelector("#courierCountryInput"),
  cityInput: document.querySelector("#courierCityInput"),
  regionInput: document.querySelector("#courierRegionInput"),
  postalCodeInput: document.querySelector("#courierPostalCodeInput"),
  addressInput: document.querySelector("#courierAddressInput"),
  identityInput: document.querySelector("#courierIdentityInput"),
  identityFileInput: document.querySelector("#courierIdentityFileInput"),
  identityFileUrlInput: document.querySelector("#courierIdentityFileUrlInput"),
  vehicleTypeInput: document.querySelector("#courierVehicleTypeInput"),
  vehiclePlateInput: document.querySelector("#courierVehiclePlateInput"),
  driverLicenseInput: document.querySelector("#courierDriverLicenseInput"),
  driverLicenseFileInput: document.querySelector("#courierDriverLicenseFileInput"),
  driverLicenseFileUrlInput: document.querySelector("#courierDriverLicenseFileUrlInput"),
  insuranceInput: document.querySelector("#courierInsuranceInput"),
  insuranceFileInput: document.querySelector("#courierInsuranceFileInput"),
  insuranceFileUrlInput: document.querySelector("#courierInsuranceFileUrlInput"),
  bankInput: document.querySelector("#courierBankInput"),
  availabilityInput: document.querySelector("#courierAvailabilityInput"),
  photoFileInput: document.querySelector("#courierPhotoFileInput"),
  photoUrlInput: document.querySelector("#courierPhotoUrlInput"),
  selfieFileInput: document.querySelector("#courierSelfieFileInput"),
  selfieUrlInput: document.querySelector("#courierSelfieUrlInput"),
  workPermitFileInput: document.querySelector("#courierWorkPermitFileInput"),
  workPermitUrlInput: document.querySelector("#courierWorkPermitUrlInput"),
  vehicleHelp: document.querySelector("#courierVehicleHelp"),
  termsInput: document.querySelector("#courierTermsInput"),
  saveProfileButton: document.querySelector("#courierSaveProfileButton"),
  profileMessage: document.querySelector("#courierProfileMessage"),
  payoutPanel: document.querySelector("#courierPayoutPanel"),
  payoutStatus: document.querySelector("#courierPayoutStatus"),
  payoutButton: document.querySelector("#courierPayoutButton"),
  dashboard: document.querySelector("#courierDashboard"),
  dashboardText: document.querySelector("#courierDashboardText"),
  availabilityButton: document.querySelector("#courierAvailabilityButton"),
  shareLocationButton: document.querySelector("#courierShareLocationButton"),
  openGpsButton: document.querySelector("#courierOpenGpsButton"),
  refreshOffersButton: document.querySelector("#courierRefreshOffersButton"),
  offersList: document.querySelector("#courierOffersList"),
  arrivedRestaurantButton: document.querySelector("#courierArrivedRestaurantButton"),
  pickedUpButton: document.querySelector("#courierPickedUpButton"),
  arrivedCustomerButton: document.querySelector("#courierArrivedCustomerButton"),
  deliveredButton: document.querySelector("#courierDeliveredButton"),
  locationMessage: document.querySelector("#courierLocationMessage"),
  headerStatus: document.querySelector("#courierHeaderStatus"),
  dashboardStatus: document.querySelector("#courierDashboardStatus"),
  homeSignedOut: document.querySelector("#courierHomeSignedOut"),
  activeDeliveryCard: document.querySelector("#courierActiveDeliveryCard"),
  deliveryMap: document.querySelector("#courierDeliveryMap"),
mapTitle: document.querySelector("#courierMapTitle"),
mapStatus: document.querySelector("#courierMapStatus"),
mapCenterButton: document.querySelector("#courierMapCenterButton"),
  historyList: document.querySelector("#courierHistoryList"),
  steps: document.querySelector("#courierSteps"),
  views: Array.from(document.querySelectorAll("[data-courier-view]")),
  viewButtons: Array.from(document.querySelectorAll("[data-courier-view-target]")),
};

const COURIER_STATUS_LABELS = {
  draft: "Borrador",
  pending_review: "Pendiente de revision",
  approved: "Verificado / Aprobado",
  rejected: "Rechazado",
  suspended: "Suspendido",
  inactive: "Inactivo",
};
const COURIER_REGIONS = {
  PL: [
    "Dolnośląskie",
    "Kujawsko-Pomorskie",
    "Lubelskie",
    "Lubuskie",
    "Łódzkie",
    "Małopolskie",
    "Mazowieckie",
    "Opolskie",
    "Podkarpackie",
    "Podlaskie",
    "Pomorskie",
    "Śląskie",
    "Świętokrzyskie",
    "Warmińsko-Mazurskie",
    "Wielkopolskie",
    "Zachodniopomorskie",
  ],

  CO: [
    "Amazonas",
    "Antioquia",
    "Arauca",
    "Atlántico",
    "Bolívar",
    "Boyacá",
    "Caldas",
    "Caquetá",
    "Casanare",
    "Cauca",
    "Cesar",
    "Chocó",
    "Córdoba",
    "Cundinamarca",
    "Guainía",
    "Guaviare",
    "Huila",
    "La Guajira",
    "Magdalena",
    "Meta",
    "Nariño",
    "Norte de Santander",
    "Putumayo",
    "Quindío",
    "Risaralda",
    "San Andrés y Providencia",
    "Santander",
    "Sucre",
    "Tolima",
    "Valle del Cauca",
    "Vaupés",
    "Vichada",
    "Bogotá D.C.",
  ],
};

function courierCountryName(countryCode) {
  if (countryCode === "PL") return "Polonia";
  if (countryCode === "CO") return "Colombia";
  return "";
}

function courierRenderRegionOptions(countryCode, selectedRegion = "") {
  const regionSelect = courierElements.regionInput;
  const citySelect = courierElements.cityInput;
  if (!regionSelect || !citySelect) return;

  const regions = [...(COURIER_REGIONS[countryCode] || [])];
  if (selectedRegion && !regions.includes(selectedRegion)) regions.push(selectedRegion);

  const optionsHtml = regions
    .map((region) => {
      const safeRegion = courierEscapeHtml(region);
      const selected = region === selectedRegion ? " selected" : "";
      return `<option value="${safeRegion}"${selected}>${safeRegion}</option>`;
    })
    .join("");

  courierSetHtmlIfChanged(
    regionSelect,
    `<option value="">Selecciona una región</option>${optionsHtml}`
  );
  regionSelect.disabled = regions.length === 0;
  citySelect.disabled = !countryCode || !selectedRegion;
}

function courierGoogleMapsApiKey() {
  return courierNormalizeText(
    window.RINCON_GOOGLE_MAPS_API_KEY
      || window.RC_ORDERA_SUPABASE?.googleMapsApiKey
      || localStorage.getItem(COURIER_GOOGLE_MAPS_KEY_STORAGE)
  );
}

function courierLoadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(true);
  const apiKey = courierGoogleMapsApiKey();
  if (!apiKey || !navigator.onLine) return Promise.resolve(false);
  if (courierGoogleMapsScriptPromise) return courierGoogleMapsScriptPromise;

  const staleScript = document.querySelector('script[data-courier-google-maps-loader="true"]');
  if (staleScript && !window.google?.maps) staleScript.remove?.();

  courierGoogleMapsScriptPromise = new Promise((resolve) => {
    const callbackName = `rcOrderaCourierMapsReady_${Date.now()}`;
    const script = document.createElement("script");
    let finished = false;

    const finish = (available) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      if (!available) {
        script.remove?.();
        courierGoogleMapsScriptPromise = null;
      }
      resolve(Boolean(available));
    };

    const timeoutId = window.setTimeout(() => finish(false), 12_000);
    window[callbackName] = () => finish(Boolean(window.google?.maps));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.dataset.courierGoogleMapsLoader = "true";
    script.addEventListener("error", () => finish(false), { once: true });
    document.head.appendChild(script);
  });

  return courierGoogleMapsScriptPromise;
}

function courierAddressComponent(place, types = [], shortName = false) {
  const components = place?.address_components || [];
  const component = components.find((entry) => types.every((type) => entry.types.includes(type)));
  return (shortName ? component?.short_name : component?.long_name) || "";
}

function courierComparableLocation(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(wojewodztwo|voivodeship|voivodato|departamento|department|distrito capital)\b/g, "")
    .replace(/\b(de|del)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function courierNormalizedRegion(countryCode, value) {
  const cleanValue = courierNormalizeText(value);
  if (!cleanValue) return "";
  const comparable = courierComparableLocation(cleanValue);
  const directMatch = (COURIER_REGIONS[countryCode] || []).find(
    (region) => courierComparableLocation(region) === comparable
  );
  if (directMatch) return directMatch;

  const aliases = countryCode === "PL" ? {
    "lower silesian": "Dolnośląskie",
    "baja silesia": "Dolnośląskie",
    "kuyavian pomeranian": "Kujawsko-Pomorskie",
    "cuyavia y pomerania": "Kujawsko-Pomorskie",
    "lublin": "Lubelskie",
    "lubusz": "Lubuskie",
    "lodz": "Łódzkie",
    "lesser poland": "Małopolskie",
    "pequena polonia": "Małopolskie",
    "masovian": "Mazowieckie",
    "masovia": "Mazowieckie",
    "mazovia": "Mazowieckie",
    "opole": "Opolskie",
    "subcarpathian": "Podkarpackie",
    "subcarpacia": "Podkarpackie",
    "podlaskie": "Podlaskie",
    "podlaquia": "Podlaskie",
    "pomeranian": "Pomorskie",
    "pomerania": "Pomorskie",
    "silesian": "Śląskie",
    "silesia": "Śląskie",
    "holy cross": "Świętokrzyskie",
    "santa cruz": "Świętokrzyskie",
    "warmian masurian": "Warmińsko-Mazurskie",
    "varmia y masuria": "Warmińsko-Mazurskie",
    "greater poland": "Wielkopolskie",
    "gran polonia": "Wielkopolskie",
    "west pomeranian": "Zachodniopomorskie",
    "pomerania occidental": "Zachodniopomorskie",
  } : countryCode === "CO" ? {
    "bogota": "Bogotá D.C.",
    "bogota d c": "Bogotá D.C.",
  } : {};
  return aliases[comparable] || cleanValue;
}

function courierPlaceLocality(place) {
  const primaryLocality = courierAddressComponent(place, ["locality"])
    || courierAddressComponent(place, ["postal_town"])
    || courierAddressComponent(place, ["sublocality"])
    || courierAddressComponent(place, ["sublocality_level_1"]);
  if (primaryLocality) return primaryLocality;

  const placeName = courierNormalizeText(place?.name);
  const administrativeFallbacks = [
    courierAddressComponent(place, ["administrative_area_level_2"]),
    courierAddressComponent(place, ["administrative_area_level_3"]),
  ].filter(Boolean);
  if (
    placeName
    && !administrativeFallbacks.some(
      (area) => courierComparableLocation(area) === courierComparableLocation(placeName)
    )
  ) {
    return placeName;
  }
  return administrativeFallbacks[0] || administrativeFallbacks[1] || placeName;
}

function courierApplyLocalityPlace(place) {
  if (!place?.address_components?.length) return;
  const selectedCountryCode = courierInputValue(courierElements.countryInput).toUpperCase();
  const placeCountryCode = String(courierAddressComponent(place, ["country"], true)).toUpperCase();
  if (!selectedCountryCode || placeCountryCode !== selectedCountryCode) {
    courierSetMessage(courierElements.profileMessage, "Selecciona una localidad del pais elegido.", "error");
    return;
  }

  const selectedRegion = courierInputValue(courierElements.regionInput);
  const placeRegion = courierNormalizedRegion(
    placeCountryCode,
    courierAddressComponent(place, ["administrative_area_level_1"])
  );
  if (
    selectedRegion
    && placeRegion
    && courierComparableLocation(selectedRegion) !== courierComparableLocation(placeRegion)
  ) {
    courierSetMessage(
      courierElements.profileMessage,
      "La localidad seleccionada no pertenece a la region elegida. Revisa la region o escribe la localidad manualmente.",
      "error"
    );
    return;
  }

  const city = courierPlaceLocality(place);
  const postalCode = courierAddressComponent(place, ["postal_code"]);
  const latitude = place.geometry?.location?.lat?.();
  const longitude = place.geometry?.location?.lng?.();
  if (city) courierElements.cityInput.value = city;
  if (postalCode) courierElements.postalCodeInput.value = postalCode;
  courierRegistrationRegion = {
    ...courierRegistrationRegion,
    countryCode: selectedCountryCode,
    country: courierCountryName(selectedCountryCode),
    region: selectedRegion || placeRegion,
    city: city || courierInputValue(courierElements.cityInput),
    postalCode: postalCode || courierInputValue(courierElements.postalCodeInput),
    timezone: selectedCountryCode === "PL" ? "Europe/Warsaw" : "America/Bogota",
    latitude: Number.isFinite(latitude) ? latitude : courierRegistrationRegion.latitude,
    longitude: Number.isFinite(longitude) ? longitude : courierRegistrationRegion.longitude,
  };
  if (city) {
    courierSetMessage(courierElements.profileMessage, `Localidad confirmada: ${city}.`, "ok");
  }
}

async function courierPreparePlaceAutocomplete() {
  if (!courierElements.cityInput || !courierGoogleMapsApiKey()) return false;
  if (!(await courierLoadGoogleMaps())) return false;
  const countryCode = courierInputValue(courierElements.countryInput).toLowerCase();
  if (!courierCityAutocomplete) {
    const options = { fields: ["address_components", "formatted_address", "geometry", "name"] };
    if (["co", "pl"].includes(countryCode)) options.componentRestrictions = { country: countryCode };
    courierCityAutocomplete = new google.maps.places.Autocomplete(courierElements.cityInput, options);
    courierCityAutocomplete.addListener("place_changed", () => {
      courierApplyLocalityPlace(courierCityAutocomplete.getPlace());
    });
  } else if (["co", "pl"].includes(countryCode)) {
    courierCityAutocomplete.setComponentRestrictions({ country: countryCode });
  }
  return true;
}

let courierClient = null;
let courierUser = null;
let courierAuthReady = false;
let courierProfile = null;
let courierAvailable = false;
let courierRegistrationMode = false;
let courierLastLocation = null;
let courierRecoveringPassword = false;
let courierAssignments = [];
let courierHistory = [];
let courierActiveAssignmentId = "";
let courierOffersTimer = null;
let courierOffersPollingDelay = 15_000;
let courierOffersLoadInFlight = null;
let courierOffersLoadPending = false;
let courierOffersRetryNotBefore = 0;
let courierOffersRetryTimer = null;
let courierAlarmContext = null;
let courierAlarmTimer = null;
let courierAlarmArmed = false;
let courierCurrentView = "profile";
let courierApprovalChannel = null;
let courierApprovalRealtimeRetryTimer = null;
let courierDeliveryChannel = null;
let courierDeliveryRealtimeStatus = "idle";
const COURIER_REALTIME_RECONNECT_MIN_MS = 2_000;
const COURIER_REALTIME_RECONNECT_MAX_MS = 60_000;
const COURIER_REALTIME_STABLE_MS = 30_000;
const COURIER_LOCATION_WRITE_MIN_MS = 30_000;
let courierApprovalRealtimeRetryDelay = COURIER_REALTIME_RECONNECT_MIN_MS;
let courierDeliveryRealtimeRetryTimer = null;
let courierDeliveryRealtimeStableTimer = null;
let courierDeliveryRealtimeRetryDelay = COURIER_REALTIME_RECONNECT_MIN_MS;
let courierLocationWatchId = null;
let courierLastLocationWriteAt = 0;
let courierResumePromise = null;
let courierTargetAssignmentId = String(courierParams.get("assignment") || "").trim();
let courierRegistrationRegion = courierDetectedRegion();
let courierGoogleMapsScriptPromise = null;
let courierSupabaseLibraryPromise = null;
let courierCityAutocomplete = null;
let courierDeliveryMap = null;
let courierPayoutState = null;

let courierMapCourierMarker = null;
let courierMapRestaurantMarker = null;
let courierMapCustomerMarker = null;

let courierMapBounds = null;
let courierMapLastRenderAt = 0;
let courierLastRuntimeResumeAt = 0;
let courierProfileLastLoadedAt = 0;
let courierProfileLoadInFlight = null;
let courierProfileLoadUserId = "";
let courierHistoryLastLoadedAt = 0;
let courierHistoryLoadInFlight = null;
let courierHistoryLoadUserId = "";
let courierAvailabilityLoadInFlight = null;
let courierAvailabilityLoadUserId = "";
let courierPayoutLastLoadedAt = 0;
let courierPushRegistrationPromise = null;
let courierPushRegisteredUserId = "";
const courierHtmlCache = new WeakMap();

const COURIER_VERIFICATION_EMAIL = "pedidosapprinconcolombiano@gmail.com";
const COURIER_FILE_FIELDS = [
  ["identityFileUrlInput", "Documento de identidad"],
  ["driverLicenseFileUrlInput", "Licencia"],
  ["insuranceFileUrlInput", "Seguro"],
  ["photoUrlInput", "Foto"],
  ["selfieUrlInput", "Selfie de verificacion"],
  ["workPermitUrlInput", "Permiso de trabajo"],
];

function courierSetView(view, options = {}) {
  const allowedViews = new Set(["home", "active", "history", "profile"]);
  let nextView = allowedViews.has(view) ? view : "home";
  if (!courierUser && nextView !== "profile") nextView = "profile";
  courierCurrentView = nextView;

  courierElements.views.forEach((section) => {
    section.hidden = section.dataset.courierView !== nextView;
  });
  courierElements.viewButtons.forEach((button) => {
    const isCurrent = button.dataset.courierViewTarget === nextView;
    if (isCurrent) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.body.dataset.courierView = nextView;
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  if (nextView === "active") {

  window.requestAnimationFrame(() => {

    window.requestAnimationFrame(() => {

      courierRenderDeliveryMap({
        forceFit: true
      }).catch((error) => {
        console.error(
          "No se pudo renderizar el mapa:",
          error
        );
      });

    });

  });

}
}

function courierNormalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function courierSetHtmlIfChanged(element, html) {
  if (!element) return false;
  const nextHtml = String(html ?? "");
  if (courierHtmlCache.get(element) === nextHtml) return false;
  courierHtmlCache.set(element, nextHtml);
  element.innerHTML = nextHtml;
  return true;
}

function courierLocationAgeLabel(value) {
  const timestamp = new Date(value || "").getTime();
  if (!Number.isFinite(timestamp)) return "sin ubicacion guardada";
  const seconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);
  if (seconds < 60) return "hace menos de un minuto";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

function courierInputValue(input) {
  return courierNormalizeText(input?.value || "");
}

function courierSupabaseConfig() {
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

function courierConnectionMessage() {
  const config = courierSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return "La conexion de colaboradores aun no esta disponible.";
  }
  if (!window.supabase?.createClient) {
    return "No se pudo cargar la conexion de colaboradores. Revisa internet e intenta nuevamente.";
  }
  return "No se pudo iniciar la conexion de colaborador.";
}

function courierLoadSupabaseLibrary() {
  if (window.supabase?.createClient) return Promise.resolve(true);
  if (!navigator.onLine) return Promise.resolve(false);
  if (courierSupabaseLibraryPromise) return courierSupabaseLibraryPromise;

  const operation = new Promise((resolve) => {
    let finished = false;
    const finish = (available) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      resolve(Boolean(available));
    };
    const timeoutId = window.setTimeout(
      () => finish(Boolean(window.supabase?.createClient)),
      12_000
    );

    const existingScript = document.querySelector("script[data-supabase-loader]");
    if (existingScript) {
      if (window.supabase?.createClient) {
        finish(true);
        return;
      }
      existingScript.addEventListener(
        "load",
        () => finish(Boolean(window.supabase?.createClient)),
        { once: true }
      );
      existingScript.addEventListener("error", () => finish(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "vendor/supabase-2.57.4.js";
    script.async = true;
    script.dataset.supabaseLoader = "true";
    script.addEventListener(
      "load",
      () => finish(Boolean(window.supabase?.createClient)),
      { once: true }
    );
    script.addEventListener("error", () => finish(false), { once: true });
    document.head.appendChild(script);
  });

  courierSupabaseLibraryPromise = operation;
  operation.finally(() => {
    if (courierSupabaseLibraryPromise === operation) {
      courierSupabaseLibraryPromise = null;
    }
  });
  return operation;
}

function courierEnsureClient() {
  if (courierClient) return courierClient;
  const config = courierSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
  courierClient = window.supabase.createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "rc-ordera-courier-auth",
  },
});
  return courierClient;
}

function courierDocumentStorageRef(path) {
  return path ? `storage:${COURIER_DOCUMENT_BUCKET}/${path}` : "";
}

function courierReadableFileRef(value) {
  const text = courierNormalizeText(value);
  if (!text) return "";
  const clean = text.replace(/^storage:[^/]+\//i, "");
  return clean.split("/").pop() || "archivo guardado";
}

function courierSetFileStatus(targetInput, message = "", type = "") {
  if (!targetInput?.parentElement) return;
  let status = targetInput.parentElement.querySelector(`[data-upload-status-for="${targetInput.id}"]`);
  if (!status) {
    status = document.createElement("small");
    status.className = "uploaded-file-status";
    status.dataset.uploadStatusFor = targetInput.id;
    targetInput.insertAdjacentElement("afterend", status);
  }
  status.textContent = message;
  status.dataset.type = type;
  status.hidden = !message;
}

function courierRefreshFileStatuses() {
  COURIER_FILE_FIELDS.forEach(([targetKey, label]) => {
    const targetInput = courierElements[targetKey];
    const ref = courierInputValue(targetInput);
    courierSetFileStatus(targetInput, ref ? `${label} ya subido: ${courierReadableFileRef(ref)}` : "", ref ? "ok" : "");
  });
}

function courierFileExtension(file) {
  if (file?.type === "application/pdf") return "pdf";
  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  if (file?.type === "image/jpeg") return "jpg";
  return "";
}

async function courierUploadDocument(file, kind) {
  const client = courierEnsureClient();
  if (!client || !courierUser) {
    throw new Error("Primero inicia sesion como colaborador para subir archivos.");
  }
  if (!file) return "";
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("El archivo es muy pesado. Usa imagen o PDF menor a 8 MB.");
  }

  const extension = courierFileExtension(file);
  if (!extension) {
    throw new Error("Tipo de archivo no permitido. Usa PDF, JPG, PNG o WebP.");
  }
  const cleanKind = courierNormalizeText(kind).toLowerCase().replace(/[^a-z0-9-]/g, "-") || "documento";
  const path = `${courierUser.id}/${cleanKind}-${Date.now()}.${extension}`;
  const { error } = await client.storage.from(COURIER_DOCUMENT_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw error;
  return courierDocumentStorageRef(path);
}

async function courierHandleFileUpload(fileInput, targetInput, kind, label) {
  const file = fileInput?.files?.[0];
  if (!file || !targetInput) return;
  const previousValue = targetInput.value;
  courierSetMessage(courierElements.profileMessage, `Subiendo ${label}...`);
  try {
    targetInput.value = await courierUploadDocument(file, kind);
    targetInput.dataset.uploadedFileName = file.name || courierReadableFileRef(targetInput.value);
    courierSetFileStatus(
      targetInput,
      `${label} subido y listo para guardar: ${targetInput.dataset.uploadedFileName}`,
      "ok"
    );
    courierSetMessage(courierElements.profileMessage, `${label} subido correctamente. Ahora presiona Enviar solicitud para guardar tu perfil.`, "ok");
    if (fileInput) fileInput.value = "";
  } catch (error) {
    targetInput.value = previousValue;
    courierSetFileStatus(
      targetInput,
      previousValue
        ? `${label} no se reemplazo. Se conserva el archivo anterior: ${courierReadableFileRef(previousValue)}`
        : `${label} no subio. Intenta de nuevo.`,
      "error"
    );
    courierSetMessage(
      courierElements.profileMessage,
      /Primero inicia sesion|archivo es muy pesado|Tipo de archivo no permitido/i.test(String(error?.message || ""))
        ? String(error.message)
        : "No se pudo subir el archivo. Revisa internet, el tipo de archivo o los permisos de Storage.",
      "error"
    );
    if (fileInput) fileInput.value = "";
  }
}

function courierSetMessage(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = !message;
}

function courierVehicleType() {
  return courierInputValue(courierElements.vehicleTypeInput).toLowerCase();
}

function courierVehicleRequiresDrivingDocs() {
  const vehicle = courierVehicleType();
  return vehicle === "motocicleta" || vehicle === "automovil";
}

function courierMissingDocumentLabels() {
  const missing = [];
  if (!courierInputValue(courierElements.identityFileUrlInput)) missing.push("documento de identidad");
  if (!courierInputValue(courierElements.photoUrlInput)) missing.push("foto");
  if (!courierInputValue(courierElements.selfieUrlInput)) missing.push("selfie de verificacion");
  if (courierVehicleRequiresDrivingDocs()) {
    if (!courierInputValue(courierElements.driverLicenseFileUrlInput)) missing.push("archivo de licencia");
    if (!courierInputValue(courierElements.insuranceFileUrlInput)) missing.push("archivo de seguro");
  }
  return missing;
}

function courierRenderVehicleRequirements() {
  const requiresDocs = courierVehicleRequiresDrivingDocs();
  const vehicle = courierVehicleType();
  if (courierElements.vehicleHelp) {
    courierElements.vehicleHelp.textContent = requiresDocs
      ? `Para ${vehicle} debes registrar matricula, licencia y seguro. Envia los soportes a ${COURIER_VERIFICATION_EMAIL}.`
      : `Bicicleta no requiere licencia. Envia documento, foto y selfie a ${COURIER_VERIFICATION_EMAIL} para revision.`;
  }

  if (courierElements.vehiclePlateInput) {
    courierElements.vehiclePlateInput.placeholder = requiresDocs ? "Obligatorio para moto o automovil" : "No aplica para bicicleta";
  }
  if (courierElements.driverLicenseInput) {
    courierElements.driverLicenseInput.placeholder = requiresDocs ? "Obligatoria para moto o automovil" : "No aplica para bicicleta";
  }
  if (courierElements.insuranceInput) {
    courierElements.insuranceInput.placeholder = requiresDocs ? "Obligatorio para moto o automovil" : "No aplica para bicicleta";
  }
}

function courierGpsUrl() {
  if (!courierHasValidCoordinates()) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${courierLastLocation.lat},${courierLastLocation.lng}`
  )}`;
}

function courierHasValidCoordinates(location = courierLastLocation) {
  const latitude = Number(location?.lat);
  const longitude = Number(location?.lng);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}
function courierAssignmentCustomerLocation(assignment) {

  const location =
    assignment?.order_json?.delivery?.location || {};

  const lat =
    Number.parseFloat(location.lat);

  const lng =
    Number.parseFloat(location.lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return { lat, lng };
}


function courierAssignmentRestaurantLocation(assignment) {

  const lat =
    Number.parseFloat(assignment?.pickup_lat);

  const lng =
    Number.parseFloat(assignment?.pickup_lng);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return { lat, lng };
}


function courierCurrentMapLocation() {

  if (!courierHasValidCoordinates()) {
    return null;
  }

  return {
    lat: Number(courierLastLocation.lat),
    lng: Number(courierLastLocation.lng)
  };
}


async function courierEnsureDeliveryMap() {

  if (!courierElements.deliveryMap) {
    return false;
  }


  const mapsReady =
    await courierLoadGoogleMaps();


  if (
    !mapsReady ||
    !window.google?.maps
  ) {

    if (courierElements.mapStatus) {
      courierElements.mapStatus.textContent =
        "No fue posible cargar Google Maps.";
    }

    return false;
  }


  if (!courierDeliveryMap) {

    courierDeliveryMap =
      new google.maps.Map(
        courierElements.deliveryMap,
        {
          center: {
            lat: 52.2297,
            lng: 21.0122
          },

          zoom: 13,

          mapTypeControl: false,

          streetViewControl: false,

          fullscreenControl: false,

          clickableIcons: false,

          gestureHandling: "greedy"
        }
      );

  }


  return true;
}


function courierCreateOrMoveMarker(
  currentMarker,
  position,
  options = {}
) {
  if (!position || !courierDeliveryMap) return currentMarker;

  if (!currentMarker) {
    return new google.maps.Marker({
      position,
      map: courierDeliveryMap,
      title: options.title || "",
    });
  }

  const previousPosition = currentMarker.getPosition?.();
  const previousLat = Number(previousPosition?.lat?.());
  const previousLng = Number(previousPosition?.lng?.());
  if (
    !Number.isFinite(previousLat) ||
    !Number.isFinite(previousLng) ||
    Math.abs(previousLat - Number(position.lat)) > 0.000001 ||
    Math.abs(previousLng - Number(position.lng)) > 0.000001
  ) {
    currentMarker.setPosition(position);
  }

  if (options.title && currentMarker.getTitle?.() !== options.title) {
    currentMarker.setTitle(options.title);
  }

  if (currentMarker.getMap?.() !== courierDeliveryMap) {
    currentMarker.setMap(courierDeliveryMap);
  }

  return currentMarker;
}

function courierHideMarker(marker) {

  if (marker) {
    marker.setMap(null);
  }

}


async function courierRenderDeliveryMap(options = {}) {
  // Google Maps is one of the most expensive UI components. Do not load or
  // mutate it while the delivery view is not visible.
  if (courierCurrentView !== "active" && options.forceRender !== true) return false;
  if (!(await courierEnsureDeliveryMap())) return false;

  const active = courierActiveAssignment();
  const courierLocation = courierCurrentMapLocation();
  const restaurantLocation = active ? courierAssignmentRestaurantLocation(active) : null;
  const customerLocation = active ? courierAssignmentCustomerLocation(active) : null;

  if (courierLocation) {
    courierMapCourierMarker = courierCreateOrMoveMarker(
      courierMapCourierMarker,
      courierLocation,
      { title: "Tu ubicación" }
    );
  } else {
    courierHideMarker(courierMapCourierMarker);
  }

  if (restaurantLocation) {
    courierMapRestaurantMarker = courierCreateOrMoveMarker(
      courierMapRestaurantMarker,
      restaurantLocation,
      { title: active?.restaurant_name || "Restaurante" }
    );
  } else {
    courierHideMarker(courierMapRestaurantMarker);
  }

  if (customerLocation) {
    courierMapCustomerMarker = courierCreateOrMoveMarker(
      courierMapCustomerMarker,
      customerLocation,
      { title: active?.customer_name || "Cliente" }
    );
  } else {
    courierHideMarker(courierMapCustomerMarker);
  }

  if (courierElements.mapTitle) {
    courierElements.mapTitle.textContent = active
      ? active.restaurant_name || "Entrega activa"
      : "Tu ubicación";
  }

  if (courierElements.mapStatus) {
    courierElements.mapStatus.textContent = !courierLocation
      ? "Comparte tu ubicación para mostrar tu posición."
      : active
        ? "Tu ubicación y los puntos de la entrega se actualizan en el mapa."
        : "Ubicación actual del domiciliario.";
  }

  const positions = [courierLocation, restaurantLocation, customerLocation].filter(Boolean);
  if (!positions.length) return true;

  if (positions.length === 1) {
    const center = courierDeliveryMap.getCenter?.();
    const centerLat = Number(center?.lat?.());
    const centerLng = Number(center?.lng?.());
    const target = positions[0];
    if (
      !Number.isFinite(centerLat) ||
      !Number.isFinite(centerLng) ||
      Math.abs(centerLat - target.lat) > 0.00001 ||
      Math.abs(centerLng - target.lng) > 0.00001
    ) {
      courierDeliveryMap.setCenter(target);
    }
    if (courierDeliveryMap.getZoom?.() !== 15) courierDeliveryMap.setZoom(15);
    return true;
  }

  const bounds = new google.maps.LatLngBounds();
  positions.forEach((position) => bounds.extend(position));
  courierMapBounds = bounds;

  if (options.forceFit === true || !courierDeliveryMap.getBounds()) {
    courierDeliveryMap.fitBounds(bounds, 55);
  }
  return true;
}

function courierFriendlyDeliveryError(error) {
  const message = String(error?.message || "");
  if (/upsert_courier_live_location|delivery_assignment|assign_nearest|function .* does not exist|schema cache/i.test(message)) {
    return "La asignacion de entregas cercanas aun no esta disponible. Intenta nuevamente mas tarde.";
  }
  if (/Courier profile is not approved/i.test(message)) return "Tu perfil debe estar aprobado por la administracion antes de recibir pedidos.";
  if (/Invalid location/i.test(message)) return "La ubicacion no es valida. Intenta compartirla de nuevo.";
  if (/not authenticated/i.test(message)) return "Inicia sesion como colaborador.";
  if (/offer is no longer available|assignment transition is not allowed/i.test(message)) return "Este pedido ya cambio de estado o fue aceptado por otro colaborador. Actualiza la lista.";
  if (/not authorized|permission denied/i.test(message)) return "No tienes permiso para realizar esta accion.";
  return "No se pudo actualizar la entrega.";
}

function courierLogError(operation, error, context = {}) {
  console.error("RC_ORDERA_ERROR", {
    operation,
    error_code: String(error?.code || error?.status || "unknown"),
    message: String(error?.message || "Error no identificado"),
    user_id: courierUser?.id || null,
    order_id: context.orderId || null,
    assignment_id: context.assignmentId || null,
    timestamp: new Date().toISOString(),
  });
}

function courierEscapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function courierFormatMoney(amount) {
  const value = Number(amount) || 0;
  return `${COURIER_MONEY_FORMATTER.format(value)} zl`;
}

function courierOrderItems(assignment) {
  return Array.isArray(assignment?.order_json?.items) ? assignment.order_json.items : [];
}

function courierItemName(item) {
  return String(item?.product_name_snapshot || item?.name || item?.productName || "Producto").trim();
}

function courierItemQuantity(item) {
  const qty = Number.parseInt(item?.quantity ?? item?.qty, 10);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function courierDeliveryAddress(assignment) {
  const delivery = assignment?.order_json?.delivery || {};
  return [delivery.address, delivery.neighborhood, delivery.reference].filter(Boolean).join(" - ") ||
    assignment?.table_label ||
    "Direccion del cliente pendiente";
}

function courierCoordinatesUrl(lat, lng) {
  const cleanLat = Number.parseFloat(lat);
  const cleanLng = Number.parseFloat(lng);
  if (!Number.isFinite(cleanLat) || !Number.isFinite(cleanLng)) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${cleanLat},${cleanLng}`)}`;
}

function courierDeliveryGpsUrl(assignment) {
  const location = assignment?.order_json?.delivery?.location || {};
  return courierCoordinatesUrl(location.lat, location.lng);
}

function courierAssignmentStatusLabel(status) {
  if (status === "offered") return "Pedido ofrecido";
  if (status === "accepted") return "Aceptado";
  if (status === "arrived_restaurant") return "Llegaste al restaurante";
  if (status === "picked_up") return "Pedido recogido";
  if (status === "arrived_customer") return "Llegaste al cliente";
  if (status === "delivered") return "Entregado";
  if (status === "rejected") return "Rechazado";
  if (status === "cancelled") return "Cancelado";
  return "Pendiente";
}

function courierActiveAssignment() {
  return courierAssignments.find((assignment) =>
    ["accepted", "arrived_restaurant", "picked_up", "arrived_customer"].includes(assignment.status)
  );
}

function courierNeedsDeliveryRuntime() {
  return Boolean(
    courierUser &&
    courierProfile?.status === "approved" &&
    (courierAvailable || courierActiveAssignment())
  );
}

function courierShouldPollOffersFallback() {
  return Boolean(
    courierNeedsDeliveryRuntime() &&
    navigator.onLine &&
    courierDeliveryRealtimeStatus !== "SUBSCRIBED"
  );
}

function courierSetStepButtons() {
  const active = courierActiveAssignment();
  courierActiveAssignmentId = active?.assignment_id || "";
  const status = active?.status || "";
  const actionByStatus = {
    accepted: courierElements.arrivedRestaurantButton,
    arrived_restaurant: courierElements.pickedUpButton,
    picked_up: courierElements.arrivedCustomerButton,
    arrived_customer: courierElements.deliveredButton,
  };
  [
    courierElements.arrivedRestaurantButton,
    courierElements.pickedUpButton,
    courierElements.arrivedCustomerButton,
    courierElements.deliveredButton,
  ].forEach((button) => {
    if (!button) return;
    button.hidden = true;
    button.disabled = true;
  });
  const nextButton = actionByStatus[status];
  if (active && nextButton) {
    nextButton.hidden = false;
    nextButton.disabled = false;
  }
}

function courierRenderActiveDelivery() {
  if (!courierElements.activeDeliveryCard) return;
  const active = courierActiveAssignment();
  let html = "";

  if (!courierUser) {
    html = `<div class="customer-empty">Inicia sesion para ver tu entrega activa.</div>`;
  } else if (!active) {
    html = `<div class="customer-empty">No tienes una entrega activa.</div>`;
  } else {
    const pickupUrl = courierCoordinatesUrl(active.pickup_lat, active.pickup_lng);
    const deliveryUrl = courierDeliveryGpsUrl(active);
    const items = courierOrderItems(active);
    html = `
      <article class="courier-offer-card courier-active-card ${active.assignment_id === courierTargetAssignmentId ? "is-targeted" : ""}" data-assignment-id="${courierEscapeHtml(active.assignment_id)}">
        <div class="client-order-head">
          <div>
            <strong>${courierEscapeHtml(active.restaurant_name || "Restaurante")}</strong>
            <span>${courierEscapeHtml(courierAssignmentStatusLabel(active.status))}</span>
            <span>Cliente: ${courierEscapeHtml(active.customer_name || active.table_label || "Cliente")}</span>
            <span>Destino: ${courierEscapeHtml(courierDeliveryAddress(active))}</span>
          </div>
          <strong>${courierFormatMoney(active.total)}</strong>
        </div>
        <div class="client-order-items">
          ${items
            .map(
              (item) => `
                <div>
                  <strong>${courierItemQuantity(item)} x ${courierEscapeHtml(courierItemName(item))}</strong>
                  ${item.note ? `<span>NOTA: ${courierEscapeHtml(String(item.note).toUpperCase())}</span>` : ""}
                </div>
              `
            )
            .join("")}
        </div>
        <div class="client-order-actions">
          ${pickupUrl ? `<a href="${courierEscapeHtml(pickupUrl)}" target="_blank" rel="noopener">GPS restaurante</a>` : ""}
          ${deliveryUrl ? `<a href="${courierEscapeHtml(deliveryUrl)}" target="_blank" rel="noopener">GPS cliente</a>` : ""}
        </div>
      </article>`;
  }

  courierSetHtmlIfChanged(courierElements.activeDeliveryCard, html);
  courierSetStepButtons();

  if (courierCurrentView === "active") {
    courierRenderDeliveryMap({ forceFit: false }).catch(() => {});
  }
}

async function courierLoadHistory(options = {}) {
  const client = courierEnsureClient();
  const userId = courierUser?.id || "";
  const force = options.force === true;

  if (!client || !userId || courierProfile?.status !== "approved") {
    courierHistory = [];
    courierHistoryLastLoadedAt = 0;
    courierRenderHistory();
    return false;
  }

  if (
    !force &&
    courierHistoryLastLoadedAt > 0 &&
    Date.now() - courierHistoryLastLoadedAt < COURIER_HISTORY_REFRESH_MIN_MS
  ) {
    return true;
  }

  if (courierHistoryLoadInFlight && courierHistoryLoadUserId === userId) {
    if (!force) return courierHistoryLoadInFlight;
    await courierHistoryLoadInFlight.catch(() => false);
    if (courierUser?.id !== userId) return false;
  }

  const operation = (async () => {
    const { data, error } = await client.rpc("get_my_courier_delivery_history");
    if (courierUser?.id !== userId) return false;
    if (error) {
      courierLogError("load_delivery_history", error);
      return false;
    }
    courierHistory = Array.isArray(data) ? data : [];
    courierHistoryLastLoadedAt = Date.now();
    courierRenderHistory();
    return true;
  })();

  courierHistoryLoadInFlight = operation;
  courierHistoryLoadUserId = userId;
  try {
    return await operation;
  } finally {
    if (courierHistoryLoadInFlight === operation) {
      courierHistoryLoadInFlight = null;
      courierHistoryLoadUserId = "";
    }
  }
}

function courierRenderHistory() {
  if (!courierElements.historyList) return;
  let html = "";

  if (!courierUser) {
    html = `<div class="customer-empty">Inicia sesion para consultar el historial.</div>`;
  } else if (!courierHistory.length) {
    html = `<div class="customer-empty">Todavia no hay entregas finalizadas.</div>`;
  } else {
    html = courierHistory
      .map(
        (assignment) => `
          <article class="courier-offer-card">
            <div class="client-order-head">
              <div>
                <strong>${courierEscapeHtml(assignment.restaurant_name || "Restaurante")}</strong>
                <span>${courierEscapeHtml(courierAssignmentStatusLabel(assignment.status))}</span>
                <span>${courierEscapeHtml(courierDeliveryAddress(assignment))}</span>
              </div>
              <strong>${courierFormatMoney(assignment.total)}</strong>
            </div>
          </article>`
      )
      .join("");
  }

  courierSetHtmlIfChanged(courierElements.historyList, html);
}

function courierRenderDeliveryOffers() {
  if (!courierElements.offersList) return;
  let html = "";

  if (!courierUser) {
    html = "";
  } else if (courierProfile?.status !== "approved") {
    html = `<div class="customer-empty">La administracion debe aprobar tu perfil antes de recibir pedidos.</div>`;
  } else {
    const offeredAssignments = courierAssignments.filter(
      (assignment) => assignment.status === "offered"
    );

    if (!offeredAssignments.length) {
      html = `<div class="customer-empty">No tienes pedidos disponibles ahora. Activa disponibilidad y comparte ubicacion.</div>`;
    } else {
      html = offeredAssignments
        .map((assignment) => {
          const pickupUrl = courierCoordinatesUrl(assignment.pickup_lat, assignment.pickup_lng);
          const deliveryUrl = courierDeliveryGpsUrl(assignment);
          const items = courierOrderItems(assignment);
          const status = assignment.status;
          const distance = Number.parseFloat(assignment.distance_km);
          return `
            <article class="courier-offer-card ${assignment.assignment_id === courierTargetAssignmentId ? "is-targeted" : ""}" data-assignment-id="${courierEscapeHtml(assignment.assignment_id)}">
              <div class="client-order-head">
                <div>
                  <strong>${courierEscapeHtml(assignment.restaurant_name || "Restaurante")}</strong>
                  <span>${courierEscapeHtml(courierAssignmentStatusLabel(status))}</span>
                  <span>Cliente: ${courierEscapeHtml(assignment.customer_name || assignment.table_label || "Cliente")}</span>
                  <span>Destino: ${courierEscapeHtml(courierDeliveryAddress(assignment))}</span>
                  ${Number.isFinite(distance) ? `<span>Distancia al restaurante: ${distance.toFixed(2)} km</span>` : ""}
                </div>
                <strong>${courierFormatMoney(assignment.total)}</strong>
              </div>
              <div class="client-order-items">
                ${items
                  .map(
                    (item) => `
                      <div>
                        <strong>${courierItemQuantity(item)} x ${courierEscapeHtml(courierItemName(item))}</strong>
                        ${item.note ? `<span>NOTA: ${courierEscapeHtml(String(item.note).toUpperCase())}</span>` : ""}
                      </div>`
                  )
                  .join("")}
              </div>
              <div class="client-order-actions">
                ${pickupUrl ? `<a href="${courierEscapeHtml(pickupUrl)}" target="_blank" rel="noopener">GPS restaurante</a>` : ""}
                ${deliveryUrl ? `<a href="${courierEscapeHtml(deliveryUrl)}" target="_blank" rel="noopener">GPS cliente</a>` : ""}
                ${status === "offered" ? `
                  <button type="button" data-action="accept-assignment">Aceptar</button>
                  <button type="button" data-action="reject-assignment">Rechazar</button>` : ""}
              </div>
            </article>`;
        })
        .join("");
    }
  }

  courierSetHtmlIfChanged(courierElements.offersList, html);
  courierRenderActiveDelivery();
}

function courierCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
  });
}

let courierLocationWritePending = null;

async function courierPersistLiveLocation(available = courierAvailable) {
  const client = courierEnsureClient();
  if (!client || !courierUser || !courierLastLocation) return false;
  const payload = {
    p_available: Boolean(available),
    p_lat: Number(courierLastLocation.lat),
    p_lng: Number(courierLastLocation.lng),
    p_accuracy_m: Number.parseInt(courierLastLocation.accuracy, 10) || 0,
  };
  const signature = JSON.stringify([courierUser.id, payload]);

  if (
    courierLocationWritePending?.client === client &&
    courierLocationWritePending.signature === signature
  ) {
    return courierLocationWritePending.promise;
  }

  const operation = Promise.resolve().then(async () => {
    const { error } = await client.rpc("upsert_courier_live_location", payload);
    if (error) throw error;
    return true;
  });

  courierLocationWritePending = { client, signature, promise: operation };

  try {
    return await operation;
  } finally {
    if (courierLocationWritePending?.promise === operation) {
      courierLocationWritePending = null;
    }
  }
}

async function courierShareLocation(options = {}) {
  if (!navigator.geolocation) {
    courierSetMessage(courierElements.locationMessage, "Este dispositivo no permite compartir ubicacion.", "error");
    return;
  }
  if (courierProfile?.status !== "approved") {
    courierSetMessage(courierElements.locationMessage, "Tu perfil debe estar aprobado antes de compartir ubicacion para entregas.", "error");
    return;
  }

  courierElements.shareLocationButton.disabled = true;
  courierSetMessage(courierElements.locationMessage, "Solicitando ubicacion...");
  try {
    const position = await courierCurrentPosition();
    courierLastLocation = {
      lat: Number(position.coords.latitude).toFixed(6),
      lng: Number(position.coords.longitude).toFixed(6),
      accuracy: Math.round(position.coords.accuracy || 0),
      updatedAt: new Date().toISOString(),
    };
    courierRenderDeliveryMap({
  forceFit: true
}).catch(() => {});
    
    const nextAvailable = options.makeAvailable ? true : courierAvailable;
    await courierPersistLiveLocation(nextAvailable);
    if (options.makeAvailable) courierAvailable = true;
    if (courierAvailable) await courierLoadDeliveryOffers({ silent: true });
    if (courierElements.openGpsButton) courierElements.openGpsButton.disabled = false;
    courierSetMessage(
      courierElements.locationMessage,
      `Ubicacion guardada: ${courierLastLocation.lat}, ${courierLastLocation.lng}. Precision aprox: ${courierLastLocation.accuracy} m.`,
      "ok"
    );
    return true;
  } catch (error) {
    courierLogError("share_location", error);
    courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
    return false;
  } finally {
    courierElements.shareLocationButton.disabled = false;
    courierRender();
  }
}

function courierStopLocationWatch() {
  if (courierLocationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(courierLocationWatchId);
  }
  courierLocationWatchId = null;
}

function courierSyncLocationWatch() {
  const shouldWatch = Boolean(
    navigator.geolocation &&
    courierUser &&
    courierProfile?.status === "approved" &&
    (courierAvailable || courierActiveAssignment())
  );

  if (!shouldWatch) {
    courierStopLocationWatch();
    return;
  }
  if (courierLocationWatchId !== null) return;

  courierLocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();
      courierLastLocation = {
        lat: Number(position.coords.latitude).toFixed(6),
        lng: Number(position.coords.longitude).toFixed(6),
        accuracy: Math.round(position.coords.accuracy || 0),
        updatedAt: new Date(now).toISOString(),
      };

      if (
        courierCurrentView === "active" &&
        now - courierMapLastRenderAt >= COURIER_MAP_RENDER_MIN_MS
      ) {
        courierMapLastRenderAt = now;
        courierRenderDeliveryMap({ forceFit: false }).catch(() => {});
      }

      if (!courierRegistrationRegion.countryCode) {
        courierRegistrationRegion = {
          ...courierRegistrationRegion,
          ...courierDetectedRegion(position.coords),
          city: courierRegistrationRegion.city,
          region: courierRegistrationRegion.region,
          postalCode: courierRegistrationRegion.postalCode,
        };
      }

      if (courierElements.openGpsButton) {
        courierElements.openGpsButton.disabled = !courierHasValidCoordinates();
      }

      if (now - courierLastLocationWriteAt >= COURIER_LOCATION_WRITE_MIN_MS) {
        courierLastLocationWriteAt = now;
        courierPersistLiveLocation(courierAvailable).catch((error) => {
          courierSetMessage(
            courierElements.locationMessage,
            courierFriendlyDeliveryError(error),
            "error"
          );
        });
      }
    },
    (error) => {
      courierSetMessage(
        courierElements.locationMessage,
        courierFriendlyDeliveryError(error),
        "error"
      );
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
  );
}

function courierOpenGps() {
  const url = courierGpsUrl();
  if (!url) {
    courierSetMessage(courierElements.locationMessage, "Primero comparte tu ubicacion actual.", "error");
    return;
  }
  window.open(url, "_blank", "noopener");
}
async function courierArmAlarm() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return false;

    if (!courierAlarmContext) {
      courierAlarmContext = new AudioContextClass();
    }

    if (courierAlarmContext.state === "suspended") {
      await courierAlarmContext.resume();
    }

    courierAlarmArmed = true;
    return true;
  } catch (error) {
    console.warn("No se pudo activar la alarma:", error);
    return false;
  }
}

function courierPlayAlarmPulse() {
  if (
    !courierAlarmArmed ||
    !courierAlarmContext ||
    courierAlarmContext.state !== "running"
  ) {
    return;
  }

  const now = courierAlarmContext.currentTime;

  const oscillator = courierAlarmContext.createOscillator();
  const gain = courierAlarmContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.setValueAtTime(660, now + 0.25);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
  gain.gain.setValueAtTime(0.35, now + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  oscillator.connect(gain);
  gain.connect(courierAlarmContext.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.65);

  if (navigator.vibrate) {
    navigator.vibrate([600, 250, 600]);
  }
}

function courierStartOfferAlarm() {
  if (courierAlarmTimer) return;

  courierPlayAlarmPulse();

  courierAlarmTimer = window.setInterval(() => {
    courierPlayAlarmPulse();
  }, 1500);
}

function courierStopOfferAlarm() {
  if (courierAlarmTimer) {
    window.clearInterval(courierAlarmTimer);
    courierAlarmTimer = null;
  }

  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

function courierSyncOfferAlarm() {
  const hasPendingOffer = courierAssignments.some(
    (assignment) => assignment.status === "offered"
  );

  if (courierAvailable && hasPendingOffer) {
    courierStartOfferAlarm();
  } else {
    courierStopOfferAlarm();
  }
}

function courierOffersPollDelay() {
  return Math.min(120000, Math.round(courierOffersPollingDelay * (1 + Math.random() * 0.2)));
}

function courierScheduleOffersRetry() {
  if (courierOffersRetryTimer || !courierShouldPollOffersFallback()) return;

  courierOffersRetryTimer = window.setTimeout(() => {
    courierOffersRetryTimer = null;
    if (!courierShouldPollOffersFallback()) return;

    courierLoadDeliveryOffers({ silent: true })
      .catch((error) => courierLogError("delivery_retry", error))
      .finally(() => courierSyncOffersPolling());
  }, Math.max(0, courierOffersRetryNotBefore - Date.now()));
}

function courierDeferOffersRetry() {
  courierOffersPollingDelay = Math.min(courierOffersPollingDelay * 2, 120000);
  courierOffersRetryNotBefore = Date.now() + courierOffersPollDelay();
  courierScheduleOffersRetry();
}

async function courierLoadDeliveryOffers(options = {}) {
  const force = options.force === true;

  if (!force && !courierNeedsDeliveryRuntime()) {
    courierStopOffersPolling();
    return false;
  }

  if (courierOffersLoadInFlight) {
    if (options.reconcileAfterInFlight) courierOffersLoadPending = true;
    return courierOffersLoadInFlight;
  }
  if (!navigator.onLine) return false;
  if (!force && Date.now() < courierOffersRetryNotBefore) {
    courierScheduleOffersRetry();
    return false;
  }
  courierOffersLoadInFlight = courierLoadDeliveryOffersNow(options);
  let succeeded = false;
  try {
    const loaded = await courierOffersLoadInFlight;
    succeeded = loaded === true;
    if (loaded === false) {
      courierDeferOffersRetry();
    } else if (succeeded) {
      courierOffersPollingDelay = 15000;
      courierOffersRetryNotBefore = 0;
      if (courierOffersRetryTimer) window.clearTimeout(courierOffersRetryTimer);
      courierOffersRetryTimer = null;
    }
    return loaded;
  } catch (error) {
    courierDeferOffersRetry();
    throw error;
  } finally {
    courierOffersLoadInFlight = null;
    if (courierOffersLoadPending) {
      courierOffersLoadPending = false;
      if (succeeded) {
      queueMicrotask(() => {
        courierLoadDeliveryOffers({ silent: true }).catch((error) => {
          courierLogError("coalesced_delivery_reload", error);
        });
      });
      }
    }
  }
}

async function courierLoadDeliveryOffersNow(options = {}) {
  const { silent = false } = options;
  const client = courierEnsureClient();
  if (!client || !courierUser || courierProfile?.status !== "approved") {
  courierAssignments = [];
  courierStopOfferAlarm();
  courierRenderDeliveryOffers();
  return;
}

  if (!silent) courierSetMessage(courierElements.locationMessage, "Actualizando pedidos disponibles...");
  const requestedUserId = courierUser.id;
  const { data, error } = await client.rpc("get_courier_delivery_offers");
  if (courierUser?.id !== requestedUserId) return;
  if (error) {
    courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
    return false;
  }

  const previousOffered = new Set(courierAssignments.filter((assignment) => assignment.status === "offered").map((assignment) => assignment.assignment_id));
  courierAssignments = Array.isArray(data) ? data : [];

  if (courierTargetAssignmentId) {
    const targetedAssignment = courierAssignments.find((assignment) => assignment.assignment_id === courierTargetAssignmentId);
    if (targetedAssignment) {
      courierSetView(["accepted", "arrived_restaurant", "picked_up", "arrived_customer"].includes(targetedAssignment.status) ? "active" : "home", { keepScroll: true });
    } else {
      courierSetMessage(courierElements.locationMessage, "Esta oferta ya no esta disponible.", "error");
      courierTargetAssignmentId = "";
    }
  }

const hasNewOffer = courierAssignments.some(
  (assignment) =>
    assignment.status === "offered" &&
    !previousOffered.has(assignment.assignment_id)
);

courierSyncOfferAlarm();

courierRenderDeliveryOffers();
  
  if (hasNewOffer) {
    courierSetMessage(courierElements.locationMessage, "Nuevo pedido disponible. Revisa y acepta si puedes tomarlo.", "ok");
  } else if (!silent) {
    courierSetMessage(courierElements.locationMessage, "Pedidos actualizados.", "ok");
  }
  return true;
}

function courierSyncOffersPolling() {
  if (!courierShouldPollOffersFallback()) {
    courierStopOffersPolling();
    return;
  }

  if (courierOffersTimer || courierOffersRetryTimer) return;

  const poll = async () => {
    courierOffersTimer = null;
    if (!courierShouldPollOffersFallback()) return;

    try {
      await courierLoadDeliveryOffers({ silent: true });
    } catch (error) {
      courierLogError("delivery_poll_fallback", error);
    }

    if (courierShouldPollOffersFallback() && !courierOffersRetryTimer) {
      courierOffersTimer = window.setTimeout(poll, courierOffersPollDelay());
    }
  };

  courierOffersTimer = window.setTimeout(poll, courierOffersPollDelay());
}

function courierStopOffersPolling() {
  if (courierOffersTimer) {
    window.clearTimeout(courierOffersTimer);
    courierOffersTimer = null;
  }
  if (courierOffersRetryTimer) {
    window.clearTimeout(courierOffersRetryTimer);
    courierOffersRetryTimer = null;
  }
}

function courierStopDeliveryRealtime() {
  courierStopOffersPolling();
  if (courierOffersRetryTimer) window.clearTimeout(courierOffersRetryTimer);
  courierOffersRetryTimer = null;
  courierOffersLoadPending = false;
  if (courierDeliveryRealtimeRetryTimer) {
    window.clearTimeout(courierDeliveryRealtimeRetryTimer);
    courierDeliveryRealtimeRetryTimer = null;
  }
  if (courierDeliveryRealtimeStableTimer) {
    window.clearTimeout(courierDeliveryRealtimeStableTimer);
    courierDeliveryRealtimeStableTimer = null;
  }
  const channel = courierDeliveryChannel;
  courierDeliveryChannel = null;
  courierDeliveryRealtimeStatus = "idle";
  if (channel && courierClient?.removeChannel) {
    courierClient.removeChannel(channel).catch((error) => courierLogError("close_delivery_realtime", error));
  }
}

function courierScheduleDeliveryRealtimeReconnect() {
  if (
    courierDeliveryRealtimeRetryTimer ||
    !window.navigator.onLine ||
    !courierClient?.channel ||
    !courierUser ||
    courierProfile?.status !== "approved"
  ) {
    return;
  }

  const retryDelay = courierDeliveryRealtimeRetryDelay;
  courierDeliveryRealtimeRetryDelay = Math.min(
    retryDelay * 2,
    COURIER_REALTIME_RECONNECT_MAX_MS
  );

  courierDeliveryRealtimeRetryTimer = window.setTimeout(() => {
    courierDeliveryRealtimeRetryTimer = null;
    courierStartDeliveryRealtime();
  }, retryDelay);
}

function courierStartDeliveryRealtime() {
  if (!courierClient?.channel || !courierUser || courierProfile?.status !== "approved") return;
  if (courierDeliveryChannel) return;

  courierDeliveryRealtimeStatus = "connecting";
  const channel = courierClient
    .channel(`courier-deliveries-${courierUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "delivery_assignments",
        filter: `courier_user_id=eq.${courierUser.id}`,
      },
      (payload) => {
        const assignment = payload?.new || payload?.old || {};
        const assignmentId = String(assignment.id || "");
        const index = courierAssignments.findIndex((entry) => entry.assignment_id === assignmentId);
       if (index >= 0 && assignment.status) {
  courierAssignments[index] = {
    ...courierAssignments[index],
    status: assignment.status,
    updated_at: assignment.updated_at
  };

  courierSyncOfferAlarm();
  courierRenderDeliveryOffers();
}
       else {
          courierLoadDeliveryOffers({ silent: true, reconcileAfterInFlight: true }).catch((error) => courierLogError("realtime_delivery_reload", error));
        }
        if (["delivered", "cancelled", "rejected", "expired"].includes(assignment.status)) {
          courierLoadHistory({ force: true }).catch((error) => courierLogError("realtime_history_reload", error));
        }
      }
    );

  courierDeliveryChannel = channel;

  channel.subscribe((status) => {
      if (channel !== courierDeliveryChannel) return;
      courierDeliveryRealtimeStatus = status;
      if (status === "SUBSCRIBED") {
        if (courierDeliveryRealtimeRetryTimer) {
          window.clearTimeout(courierDeliveryRealtimeRetryTimer);
          courierDeliveryRealtimeRetryTimer = null;
        }
        if (courierDeliveryRealtimeStableTimer) {
          window.clearTimeout(courierDeliveryRealtimeStableTimer);
        }
        courierDeliveryRealtimeStableTimer = window.setTimeout(() => {
          courierDeliveryRealtimeStableTimer = null;
          if (
            channel === courierDeliveryChannel &&
            courierDeliveryRealtimeStatus === "SUBSCRIBED"
          ) {
            courierDeliveryRealtimeRetryDelay = COURIER_REALTIME_RECONNECT_MIN_MS;
          }
        }, COURIER_REALTIME_STABLE_MS);
        courierStopOffersPolling();
        courierLoadDeliveryOffers({ silent: true, reconcileAfterInFlight: true }).catch((error) => courierLogError("realtime_delivery_resync", error));
        return;
      }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        if (courierDeliveryRealtimeStableTimer) {
          window.clearTimeout(courierDeliveryRealtimeStableTimer);
          courierDeliveryRealtimeStableTimer = null;
        }
        courierDeliveryChannel = null;
        if (courierClient?.removeChannel) {
          courierClient.removeChannel(channel).catch((error) => courierLogError("close_failed_delivery_realtime", error));
        }
        courierSyncOffersPolling();
        courierScheduleDeliveryRealtimeReconnect();
      }
    });
  courierSyncOffersPolling();
}

async function courierConfirmDeliveryPayment(assignment) {
  if (!assignment?.customer_order_id || !courierClient) return false;
  const { data, error } = await courierClient.functions.invoke("marketplace-confirm-delivery", {
    body: { orderId: assignment.customer_order_id, publicToken: "", actor: "courier" },
  });
  if (error) {
    courierLogError("confirm_delivery_payment", error, { assignmentId: assignment.assignment_id });
    return false;
  }
  return data?.courierConfirmed === true;
}

async function courierUpdateAssignmentStatus(assignmentId, status) {
  const client = courierEnsureClient();
  if (!client || !courierUser) return;
  const currentAssignment = courierAssignments.find((assignment) => assignment.assignment_id === assignmentId) || null;
  courierSetMessage(courierElements.locationMessage, "Actualizando entrega...");
  const { error } = await client.rpc("update_delivery_assignment_status", {
    p_assignment_id: assignmentId,
    p_status: status,
  });
  if (error) {
    courierLogError("update_delivery_status", error, { assignmentId });
    courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
    return;
  }

  let paymentConfirmationSaved = true;
  if (status === "delivered" && currentAssignment) {
    paymentConfirmationSaved = await courierConfirmDeliveryPayment(currentAssignment);
  }

  await courierLoadDeliveryOffers({ silent: true });

  if (["delivered", "rejected", "cancelled"].includes(status)) {
    await courierLoadHistory({ force: true });
  }

  courierSetMessage(
    courierElements.locationMessage,
    status === "delivered" && !paymentConfirmationSaved
      ? "Entrega guardada. La confirmacion del pago quedo pendiente de sincronizacion."
      : `${courierAssignmentStatusLabel(status)}.`,
    status === "delivered" && !paymentConfirmationSaved ? "error" : "ok"
  );
  if (["delivered", "rejected", "cancelled"].includes(status) && courierTargetAssignmentId === assignmentId) {
    courierTargetAssignmentId = "";
  }
  courierSetView(status === "delivered" || status === "rejected" ? "home" : "active");
}

function courierFriendlyAuthError(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "Correo o contrasena incorrectos.";
  if (/email not confirmed/i.test(message)) {
    return "RC ORDERA envio un correo de verificacion. Revisa tu correo, confirma la cuenta y vuelve a iniciar sesion.";
  }
  if (/already registered|already exists|user already/i.test(message)) {
    return "Ese correo ya tiene cuenta. Inicia sesion aqui con ese correo y despues envia la solicitud de colaborador.";
  }
  return "No se pudo completar el acceso.";
}

function courierSplitName(fullName = "") {
  const cleanName = courierNormalizeText(fullName);
  if (!cleanName) return { firstName: "", lastName: "" };
  const parts = cleanName.split(" ");
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" "),
  };
}

function courierFullName() {
  return courierNormalizeText(`${courierInputValue(courierElements.firstNameInput)} ${courierInputValue(courierElements.lastNameInput)}`);
}

function courierGeneralProfilePayload() {
  const countryCode = courierInputValue(courierElements.countryInput).toUpperCase();
  return {
    user_id: courierUser.id,
    first_name: courierInputValue(courierElements.firstNameInput),
    last_name: courierInputValue(courierElements.lastNameInput),
    full_name: courierFullName(),
    phone: courierInputValue(courierElements.phoneInput),
    country: courierCountryName(countryCode),
    city: courierInputValue(courierElements.cityInput),
    country_code: countryCode,
    region: courierInputValue(courierElements.regionInput),
    postal_code: courierInputValue(courierElements.postalCodeInput),
    preferred_language: courierRegistrationRegion.preferredLanguage,
    registration_latitude: courierRegistrationRegion.latitude,
    registration_longitude: courierRegistrationRegion.longitude,
    detected_timezone: courierRegistrationRegion.timezone,
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

function courierProfilePayload() {
  const termsAcceptedAt = courierProfile?.terms_accepted_at || new Date().toISOString();
  const countryCode = courierInputValue(courierElements.countryInput).toUpperCase();
  return {
    user_id: courierUser.id,
    first_name: courierInputValue(courierElements.firstNameInput),
    last_name: courierInputValue(courierElements.lastNameInput),
    phone: courierInputValue(courierElements.phoneInput),
    birth_date: courierInputValue(courierElements.birthDateInput) || null,
    country: courierCountryName(countryCode),
    city: courierInputValue(courierElements.cityInput),
    country_code: countryCode,
    region: courierInputValue(courierElements.regionInput),
    postal_code: courierInputValue(courierElements.postalCodeInput),
    preferred_language: courierRegistrationRegion.preferredLanguage,
    detected_timezone: courierRegistrationRegion.timezone,
    registration_latitude: courierRegistrationRegion.latitude,
    registration_longitude: courierRegistrationRegion.longitude,
    address: courierInputValue(courierElements.addressInput),
    identity_document: courierInputValue(courierElements.identityInput),
    identity_document_url: courierInputValue(courierElements.identityFileUrlInput),
    photo_url: courierInputValue(courierElements.photoUrlInput),
    verification_selfie_url: courierInputValue(courierElements.selfieUrlInput),
    work_permit_url: courierInputValue(courierElements.workPermitUrlInput),
    vehicle_type: courierInputValue(courierElements.vehicleTypeInput),
    vehicle_plate: courierInputValue(courierElements.vehiclePlateInput),
    driver_license: courierInputValue(courierElements.driverLicenseInput),
    driver_license_url: courierInputValue(courierElements.driverLicenseFileUrlInput),
    insurance_info: courierInputValue(courierElements.insuranceInput),
    insurance_url: courierInputValue(courierElements.insuranceFileUrlInput),
    bank_account: courierInputValue(courierElements.bankInput),
    availability: { text: courierInputValue(courierElements.availabilityInput) },
    terms_accepted_at: termsAcceptedAt,
    updated_at: new Date().toISOString(),
  };
}

function courierMetadataProfile() {
  const metadata = courierUser?.user_metadata || {};
  const fullName = metadata.full_name || "";
  const nameParts = courierSplitName(fullName);
  return {
    first_name: metadata.first_name || nameParts.firstName,
    last_name: metadata.last_name || nameParts.lastName,
    phone: metadata.phone || "",
    birth_date: metadata.birth_date || "",
    country: metadata.country || "",
    city: metadata.city || "",
    country_code: metadata.country_code || "",
    region: metadata.region || "",
    postal_code: metadata.postal_code || "",
    address: metadata.address || "",
    identity_document: metadata.identity_document || "",
    identity_document_url: metadata.identity_document_url || "",
    vehicle_type: metadata.vehicle_type || "",
    vehicle_plate: metadata.vehicle_plate || "",
    driver_license: metadata.driver_license || "",
    driver_license_url: metadata.driver_license_url || "",
    insurance_info: metadata.insurance_info || "",
    insurance_url: metadata.insurance_url || "",
    bank_account: metadata.bank_account || "",
    availability: metadata.availability || {},
    photo_url: metadata.photo_url || "",
    verification_selfie_url: metadata.verification_selfie_url || "",
    work_permit_url: metadata.work_permit_url || "",
    status: "draft",
  };
}

function courierApplyProfileFields(profile = {}) {
  const savedCountry = courierNormalizeText(profile.country).toLowerCase();
  const savedCountryCode = courierNormalizeText(profile.country_code).toUpperCase()
    || (/^pl$/i.test(savedCountry) || /polonia|poland|polska/.test(savedCountry) ? "PL" : "")
    || (/^co$/i.test(savedCountry) || /colombia/.test(savedCountry) ? "CO" : "")
    || courierRegistrationRegion.countryCode;
  courierRegistrationRegion = {
    ...courierRegistrationRegion,
    countryCode: savedCountryCode,
    country: courierCountryName(savedCountryCode) || courierNormalizeText(profile.country || courierRegistrationRegion.country),
    city: courierNormalizeText(profile.city || courierRegistrationRegion.city),
    region: courierNormalizeText(profile.region || courierRegistrationRegion.region),
    postalCode: courierNormalizeText(profile.postal_code || courierRegistrationRegion.postalCode),
    preferredLanguage: courierNormalizeText(profile.preferred_language || courierRegistrationRegion.preferredLanguage),
    timezone: courierNormalizeText(profile.detected_timezone || courierRegistrationRegion.timezone),
    latitude: Number.isFinite(Number(profile.registration_latitude))
      ? Number(profile.registration_latitude)
      : courierRegistrationRegion.latitude,
    longitude: Number.isFinite(Number(profile.registration_longitude))
      ? Number(profile.registration_longitude)
      : courierRegistrationRegion.longitude,
  };
  courierElements.firstNameInput.value = profile.first_name || "";
  courierElements.lastNameInput.value = profile.last_name || "";
  courierElements.phoneInput.value = profile.phone || "";
  courierElements.birthDateInput.value = profile.birth_date || "";
  courierElements.countryInput.value = courierRegistrationRegion.countryCode || "";
  courierRenderRegionOptions(courierRegistrationRegion.countryCode, courierRegistrationRegion.region);
  courierElements.cityInput.value = profile.city || "";
  courierElements.regionInput.value = profile.region || "";
  courierElements.cityInput.disabled = !courierElements.regionInput.value;
  courierElements.postalCodeInput.value = profile.postal_code || "";
  courierElements.addressInput.value = profile.address || "";
  courierElements.identityInput.value = profile.identity_document || "";
  courierElements.identityFileUrlInput.value = profile.identity_document_url || "";
  courierElements.vehicleTypeInput.value = profile.vehicle_type || "";
  courierElements.vehiclePlateInput.value = profile.vehicle_plate || "";
  courierElements.driverLicenseInput.value = profile.driver_license || "";
  courierElements.driverLicenseFileUrlInput.value = profile.driver_license_url || "";
  courierElements.insuranceInput.value = profile.insurance_info || "";
  courierElements.insuranceFileUrlInput.value = profile.insurance_url || "";
  courierElements.bankInput.value = profile.bank_account || "";
  courierElements.availabilityInput.value = profile.availability?.text || "";
  courierElements.photoUrlInput.value = profile.photo_url || "";
  courierElements.selfieUrlInput.value = profile.verification_selfie_url || "";
  courierElements.workPermitUrlInput.value = profile.work_permit_url || "";
  courierElements.termsInput.checked = Boolean(profile.terms_accepted_at);
  courierRefreshFileStatuses();
  courierRenderVehicleRequirements();
}

function courierCountryCode() {
  const value = String(courierProfile?.country || courierElements.countryInput?.value || "").trim().toUpperCase();
  if (value === "PL" || value.includes("POL")) return "PL";
  if (value === "CO" || value.includes("COL")) return "CO";
  return value;
}

function courierRenderPayoutState() {
  if (!courierElements.payoutPanel || !courierElements.payoutStatus || !courierElements.payoutButton) return;
  const approved = Boolean(courierUser && courierProfile?.status === "approved");
  const countryCode = courierCountryCode();
  const complete = courierPayoutState?.onboardingStatus === "complete"
    && courierPayoutState?.payoutsEnabled === true;
  courierElements.payoutPanel.hidden = !approved;
  if (!approved) return;
  if (countryCode !== "PL") {
    courierElements.payoutStatus.textContent = "No disponible en este pais";
    courierElements.payoutStatus.dataset.state = "inactive";
    courierElements.payoutButton.textContent = "No disponible";
    courierElements.payoutButton.disabled = true;
    return;
  }
  courierElements.payoutButton.disabled = !navigator.onLine;
  courierElements.payoutStatus.textContent = complete
    ? "Verificada"
    : courierPayoutState?.onboardingStatus === "pending"
      ? "Pendiente"
      : "Sin configurar";
  courierElements.payoutStatus.dataset.state = complete ? "complete" : "pending";
  courierElements.payoutButton.textContent = complete ? "Revisar cuenta" : "Configurar pagos";
}

async function courierRefreshPayoutState(action = "status") {
  if (!courierClient || !courierUser || courierProfile?.status !== "approved") return false;
  if (courierCountryCode() !== "PL") {
    courierRenderPayoutState();
    return false;
  }

  if (
    action === "status" &&
    courierPayoutState &&
    courierPayoutLastLoadedAt > 0 &&
    Date.now() - courierPayoutLastLoadedAt < COURIER_PAYOUT_REFRESH_MIN_MS
  ) {
    courierRenderPayoutState();
    return courierPayoutState?.onboardingStatus === "complete" && courierPayoutState?.payoutsEnabled === true;
  }

  courierElements.payoutButton.disabled = true;
  courierElements.payoutStatus.textContent = "Comprobando...";
  const { data, error } = await courierClient.functions.invoke("marketplace-onboarding", {
    body: { accountType: "courier", action },
  });
  if (error) {
    console.error("No fue posible verificar la cuenta de pagos:", error);
    courierSetMessage(
      courierElements.profileMessage,
      "No fue posible verificar la cuenta de pagos. Intenta nuevamente o contacta al soporte.",
      "error"
    );
    courierRenderPayoutState();
    return false;
  }
  if (data?.url && action !== "status") {
    window.location.assign(data.url);
    return true;
  }
  courierPayoutState = data || null;
  courierPayoutLastLoadedAt = Date.now();
  courierRenderPayoutState();
  return courierPayoutState?.onboardingStatus === "complete" && courierPayoutState?.payoutsEnabled === true;
}

function courierRender() {
  const email = courierUser?.email || "";
  const status = courierProfile?.status || "draft";
  const statusLabel = COURIER_STATUS_LABELS[status] || "Sin enviar";

  courierElements.accountSummary.textContent = courierUser
    ? `Sesion activa: ${email}`
    : "Inicia sesion o crea una cuenta para enviar tu solicitud.";
  courierElements.authFields.hidden = Boolean(courierUser) && !courierRecoveringPassword;
  courierElements.signOutButton.hidden = !courierUser;
  courierElements.statusBadge.textContent = courierUser ? statusLabel : "Sin enviar";
  courierElements.statusBadge.dataset.status = status;

  if (courierElements.headerStatus) {
    courierElements.headerStatus.textContent = !courierUser
      ? "Sin iniciar sesion"
      : status === "approved"
        ? courierAvailable ? "🟢 EN LINEA" : "⚫ FUERA DE LINEA"
        : statusLabel;
  }

  if (courierElements.dashboardStatus) {
    courierElements.dashboardStatus.textContent = !courierUser
      ? "SIN INICIAR SESION"
      : status === "approved"
        ? courierAvailable ? "EN LINEA" : "FUERA DE LINEA"
        : statusLabel.toUpperCase();
  }

  courierElements.profileStatus.textContent = courierUser
    ? `Estado actual: ${statusLabel}.`
    : "Puedes llenar los datos, pero debes iniciar sesion para guardar la solicitud.";

  courierElements.dashboard.hidden = !courierUser;
  if (courierElements.homeSignedOut) courierElements.homeSignedOut.hidden = Boolean(courierUser);
  courierElements.availabilityButton.disabled = status !== "approved";
  if (courierElements.shareLocationButton) courierElements.shareLocationButton.disabled = status !== "approved";
  if (courierElements.refreshOffersButton) courierElements.refreshOffersButton.disabled = status !== "approved";
  if (courierElements.openGpsButton) courierElements.openGpsButton.disabled = !courierHasValidCoordinates();

  courierElements.dashboardText.textContent = status === "approved"
    ? courierAvailable
      ? `EN LINEA. Ultima ubicacion ${courierLocationAgeLabel(courierLastLocation?.updatedAt)}. Estas disponible para recibir pedidos.`
      : "FUERA DE LINEA. Pulsa PONERME EN LINEA para empezar a recibir pedidos."
    : "Tu perfil debe ser aprobado antes de recibir pedidos.";

  courierElements.availabilityButton.textContent = courierAvailable
    ? "DESCONECTARME"
    : "PONERME EN LINEA";

  courierRenderPayoutState();
  courierRenderVehicleRequirements();
  courierRenderDeliveryOffers();
  courierRenderHistory();
  courierSyncOffersPolling();
  courierSyncLocationWatch();
}

function courierValidateProfile() {
  const requiredFields = [
    [courierElements.firstNameInput, "Escribe tu nombre."],
    [courierElements.lastNameInput, "Escribe tus apellidos."],
    [courierElements.phoneInput, "Escribe tu telefono."],
    [courierElements.birthDateInput, "Escribe tu fecha de nacimiento."],
    [courierElements.countryInput, "Escribe tu pais."],
    [courierElements.cityInput, "Escribe tu ciudad."],
    [courierElements.regionInput, "Escribe tu provincia, departamento o region."],
    [courierElements.addressInput, "Escribe tu direccion."],
    [courierElements.identityInput, "Escribe tu documento de identidad."],
    [courierElements.vehicleTypeInput, "Selecciona el tipo de vehiculo."],
    [courierElements.bankInput, "Escribe tu cuenta bancaria o datos de pago."],
  ];

  for (const [input, message] of requiredFields) {
    if (!courierInputValue(input)) {
      courierSetMessage(courierElements.profileMessage, message, "error");
      input?.focus();
      return false;
    }
  }

  if (!courierElements.termsInput.checked) {
    courierSetMessage(courierElements.profileMessage, "Debes aceptar contrato, terminos y privacidad.", "error");
    courierElements.termsInput.focus();
    return false;
  }

  if (courierVehicleRequiresDrivingDocs()) {
    const drivingDocs = [
      [courierElements.vehiclePlateInput, "Para motocicleta o automovil escribe la matricula."],
      [courierElements.driverLicenseInput, "Para motocicleta o automovil escribe la licencia."],
      [courierElements.insuranceInput, "Para motocicleta o automovil escribe el seguro."],
    ];
    for (const [input, message] of drivingDocs) {
      if (!courierInputValue(input)) {
        courierSetMessage(courierElements.profileMessage, message, "error");
        input?.focus();
        return false;
      }
    }
  }

  return true;
}

async function courierActivateRole() {
  try {
    const { error } = await courierClient.rpc("activate_user_role", {
      p_role: "platform_courier",
      p_scope_type: "platform",
      p_scope_id: COURIER_PLATFORM_SCOPE_ID,
    });
    if (error) throw error;
  } catch (error) {
    console.warn("No se pudo activar el rol de colaborador en la nube.", error);
  }
}

async function courierSaveProfile() {
  if (!courierClient || !courierUser) {
    courierSetMessage(courierElements.profileMessage, "Primero inicia sesion o crea tu cuenta.", "error");
    return;
  }
  if (!courierValidateProfile()) return;

  courierRegistrationRegion = {
    ...courierRegistrationRegion,
    countryCode: courierInputValue(courierElements.countryInput).toUpperCase() || courierRegistrationRegion.countryCode,
    country: courierCountryName(courierInputValue(courierElements.countryInput).toUpperCase()) || courierRegistrationRegion.country,
    city: courierInputValue(courierElements.cityInput) || courierRegistrationRegion.city,
    region: courierInputValue(courierElements.regionInput) || courierRegistrationRegion.region,
    postalCode: courierInputValue(courierElements.postalCodeInput) || courierRegistrationRegion.postalCode,
  };

  courierSetMessage(courierElements.profileMessage, "Guardando solicitud...");
  try {
    const { error: profileError } = await courierClient.from("user_profiles").upsert(courierGeneralProfilePayload());
    if (profileError) throw profileError;
  } catch (error) {
    console.warn("No se pudo guardar el perfil general del colaborador.", error);
  }

  await courierActivateRole();

  try {
    const { error } = await courierClient.from("courier_profiles").upsert(courierProfilePayload());
    if (error) throw error;
    await courierLoadProfile({ force: true });
    const missingDocs = courierMissingDocumentLabels();
    const isApproved = courierProfile?.status === "approved";
    courierSetMessage(
      courierElements.profileMessage,
      isApproved
        ? "Perfil actualizado. Tu aprobacion permanece activa."
        : missingDocs.length
        ? `Solicitud guardada. Para revision completa faltan: ${missingDocs.join(", ")}. Puedes subirlos aqui o enviarlos a ${COURIER_VERIFICATION_EMAIL}.`
        : "Solicitud guardada con documentos. Queda pendiente de revision y aprobacion para empezar a trabajar.",
      "ok"
    );
  } catch (error) {
    courierSetMessage(courierElements.profileMessage, "No se pudo guardar la solicitud.", "error");
  }
}
async function courierLoadAvailability() {
  const client = courierEnsureClient();
  const userId = courierUser?.id || "";
  if (!client || !userId) return false;

  if (courierAvailabilityLoadInFlight && courierAvailabilityLoadUserId === userId) {
    return courierAvailabilityLoadInFlight;
  }

  const operation = (async () => {
    const { data, error } = await client
      .from("courier_live_locations")
      .select("available, lat, lng, accuracy_m, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      courierLogError("load_availability", error);
      return false;
    }
    if (courierUser?.id !== userId || !data) return false;

    courierAvailable = data.available === true;
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    ) {
      courierLastLocation = {
        lat: String(data.lat),
        lng: String(data.lng),
        accuracy: Number(data.accuracy_m) || 0,
        updatedAt: data.updated_at || "",
      };
    }
    return true;
  })();

  courierAvailabilityLoadInFlight = operation;
  courierAvailabilityLoadUserId = userId;
  try {
    return await operation;
  } finally {
    if (courierAvailabilityLoadInFlight === operation) {
      courierAvailabilityLoadInFlight = null;
      courierAvailabilityLoadUserId = "";
    }
  }
}

async function courierLoadProfile(options = {}) {
  const client = courierClient;
  const userId = courierUser?.id || "";
  const force = options.force === true;
  const refreshOffers = options.refreshOffers !== false;
  const refreshHistory = options.refreshHistory !== false;
  const refreshPayout = options.refreshPayout !== false;

  if (!client || !userId) return false;

  if (
    !force &&
    courierProfile &&
    courierProfileLastLoadedAt > 0 &&
    Date.now() - courierProfileLastLoadedAt < COURIER_PROFILE_REFRESH_MIN_MS
  ) {
    courierRender();
    if (courierProfile.status === "approved") {
      courierStartDeliveryRealtime();
      if (refreshOffers) courierLoadDeliveryOffers({ silent: true }).catch(() => {});
      if (refreshHistory) courierLoadHistory().catch(() => {});
      if (refreshPayout) courierRefreshPayoutState("status").catch(() => {});
    }
    return true;
  }

  if (courierProfileLoadInFlight && courierProfileLoadUserId === userId) {
    if (!force) return courierProfileLoadInFlight;
    await courierProfileLoadInFlight.catch(() => false);
    if (courierUser?.id !== userId) return false;
  }

  const operation = (async () => {
    const { data, error } = await client
      .from("courier_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (courierUser?.id !== userId) return false;
    if (error) {
      courierLogError("load_profile", error);
      return false;
    }

    if (!data) {
      courierProfile = null;
      courierProfileLastLoadedAt = Date.now();
      courierApplyProfileFields(courierMetadataProfile());
      courierStopDeliveryRealtime();
      courierRender();
      return false;
    }

    const { data: approvalRows, error: approvalError } = await client.rpc("get_my_courier_approval");
    if (courierUser?.id !== userId) return false;
    const approval = Array.isArray(approvalRows) ? approvalRows[0] : approvalRows;
    if (!approvalError && approval) {
      data.status = approval.approved === true
        ? "approved"
        : approval.profile_status || data.status;
    }

    courierProfile = data;
    courierProfileLastLoadedAt = Date.now();
    courierApplyProfileFields(data);

    if (data.status === "approved") {
      await courierLoadAvailability();
    } else {
      courierStopDeliveryRealtime();
    }

    courierRender();

    if (data.status === "approved") {
      courierStartDeliveryRealtime();
      if (refreshOffers) courierLoadDeliveryOffers({ silent: true }).catch(() => {});
      if (refreshHistory) courierLoadHistory().catch(() => {});

      const paymentsReturn = new URLSearchParams(window.location.search).get("payments");
      if (paymentsReturn === "return" || paymentsReturn === "refresh") {
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.delete("payments");
        window.history.replaceState(window.history.state, "", returnUrl.href);
      }
      if (refreshPayout || paymentsReturn === "refresh") {
        courierRefreshPayoutState(paymentsReturn === "refresh" ? "onboarding" : "status").catch(() => {});
      }
    }
    return true;
  })();

  courierProfileLoadInFlight = operation;
  courierProfileLoadUserId = userId;
  try {
    return await operation;
  } finally {
    if (courierProfileLoadInFlight === operation) {
      courierProfileLoadInFlight = null;
      courierProfileLoadUserId = "";
    }
  }
}

function courierStopApprovalRealtime() {
  if (courierApprovalRealtimeRetryTimer) {
    window.clearTimeout(courierApprovalRealtimeRetryTimer);
    courierApprovalRealtimeRetryTimer = null;
  }
  courierApprovalRealtimeRetryDelay = COURIER_REALTIME_RECONNECT_MIN_MS;
  const channel = courierApprovalChannel;
  courierApprovalChannel = null;
  if (channel && courierClient?.removeChannel) {
    courierClient.removeChannel(channel).catch(() => {});
  }
}

function courierScheduleApprovalRealtimeReconnect() {
  if (
    courierApprovalRealtimeRetryTimer ||
    !navigator.onLine ||
    !courierClient?.channel ||
    !courierUser
  ) {
    return;
  }

  const delay = courierApprovalRealtimeRetryDelay;
  courierApprovalRealtimeRetryDelay = Math.min(
    delay * 2,
    COURIER_REALTIME_RECONNECT_MAX_MS
  );
  courierApprovalRealtimeRetryTimer = window.setTimeout(() => {
    courierApprovalRealtimeRetryTimer = null;
    courierStartApprovalRealtime();
  }, delay);
}

function courierStartApprovalRealtime() {
  if (!courierClient?.channel || !courierUser || !navigator.onLine) return;
  if (courierApprovalChannel) return;

  const userId = courierUser.id;
  const channel = courierClient
    .channel(`courier-approval-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "courier_profiles",
        filter: `user_id=eq.${userId}`,
      },
      () => courierLoadProfile({
        force: true,
        refreshOffers: true,
        refreshHistory: false,
        refreshPayout: false,
      }).catch(() => {})
    );

  courierApprovalChannel = channel;
  channel.subscribe((status) => {
    if (channel !== courierApprovalChannel) return;

    if (status === "SUBSCRIBED") {
      if (courierApprovalRealtimeRetryTimer) {
        window.clearTimeout(courierApprovalRealtimeRetryTimer);
        courierApprovalRealtimeRetryTimer = null;
      }
      courierApprovalRealtimeRetryDelay = COURIER_REALTIME_RECONNECT_MIN_MS;
      return;
    }

    if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
      courierApprovalChannel = null;
      if (courierClient?.removeChannel) {
        courierClient.removeChannel(channel).catch(() => {});
      }
      courierScheduleApprovalRealtimeReconnect();
    }
  });
}

async function courierSignIn() {
  if (!courierEnsureClient()) await courierLoadSupabaseLibrary();
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  const password = courierElements.passwordInput.value;
  if (!client) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  if (!email || !password) {
    courierSetMessage(courierElements.authMessage, "Escribe correo y contrasena.", "error");
    return;
  }

  courierElements.signInButton.disabled = true;
  courierSetMessage(courierElements.authMessage, "Iniciando sesion...");
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      courierSetMessage(courierElements.authMessage, courierFriendlyAuthError(error), "error");
      return;
    }
    courierUser = data?.user || data?.session?.user || null;
    courierElements.passwordInput.value = "";
    courierSetView("home", { instant: true });
    courierRender();
    await courierLoadProfile();
    courierStartApprovalRealtime();
    courierSetMessage(courierElements.authMessage, "Sesion iniciada.", "ok");
  } finally {
    courierElements.signInButton.disabled = false;
  }
}

async function courierSignUp() {
  if (!courierEnsureClient()) await courierLoadSupabaseLibrary();
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  const password = courierElements.passwordInput.value;
  if (!client) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  if (!email || password.length < 6) {
    courierSetMessage(courierElements.authMessage, "Usa correo y contrasena de minimo 6 caracteres.", "error");
    return;
  }
  courierSetMessage(courierElements.authMessage, "Detectando pais e idioma...");
  try {
    const position = await courierCurrentPosition();
    const detected = courierDetectedRegion(position.coords);
    courierRegistrationRegion = {
      ...courierRegistrationRegion,
      ...detected,
      city: courierInputValue(courierElements.cityInput) || courierRegistrationRegion.city,
      region: courierInputValue(courierElements.regionInput) || courierRegistrationRegion.region,
      postalCode: courierInputValue(courierElements.postalCodeInput) || courierRegistrationRegion.postalCode,
    };
  } catch {
    const detected = courierDetectedRegion();
    courierRegistrationRegion = {
      ...courierRegistrationRegion,
      ...detected,
      city: courierInputValue(courierElements.cityInput) || courierRegistrationRegion.city,
      region: courierInputValue(courierElements.regionInput) || courierRegistrationRegion.region,
      postalCode: courierInputValue(courierElements.postalCodeInput) || courierRegistrationRegion.postalCode,
    };
  }
  if (!courierInputValue(courierElements.countryInput) && courierRegistrationRegion.country) {
    courierElements.countryInput.value = courierRegistrationRegion.countryCode;
    courierRenderRegionOptions(courierRegistrationRegion.countryCode, courierRegistrationRegion.region);
  }
  const selectedCountryCode = courierInputValue(courierElements.countryInput).toUpperCase();
  if (courierRegistrationRegion.countryCode && selectedCountryCode !== courierRegistrationRegion.countryCode) {
    courierRegistrationRegion.latitude = null;
    courierRegistrationRegion.longitude = null;
  }
  courierRegistrationRegion.countryCode = selectedCountryCode;
  courierRegistrationRegion.country = courierCountryName(selectedCountryCode);
  courierRegistrationRegion.timezone = selectedCountryCode === "PL" ? "Europe/Warsaw" : "America/Bogota";
  if (!courierValidateProfile()) return;

  const profile = courierProfilePayloadForMetadata();
  courierSetMessage(courierElements.authMessage, "Creando cuenta...");
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
      data: {
        account_type: "platform_courier",
        full_name: `${profile.first_name} ${profile.last_name}`.trim(),
        preferred_language: courierRegistrationRegion.preferredLanguage,
        country_code: courierRegistrationRegion.countryCode,
        timezone: courierRegistrationRegion.timezone,
        registration_latitude: courierRegistrationRegion.latitude,
        registration_longitude: courierRegistrationRegion.longitude,
        ...profile,
      },
    },
  });

  if (error) {
    courierSetMessage(courierElements.authMessage, courierFriendlyAuthError(error), "error");
    return;
  }

  courierElements.passwordInput.value = "";
  if (data?.session?.user) {
    courierUser = data.session.user;
    await courierSaveProfile();
  }
  courierSetMessage(
    courierElements.authMessage,
    "Cuenta creada. RC ORDERA te envio un correo de verificacion. Abre ese correo, confirma la cuenta y despues inicia sesion como colaborador.",
    "ok"
  );
}

async function courierSendPasswordResetEmail() {
  if (!courierEnsureClient()) await courierLoadSupabaseLibrary();
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  if (!client) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  if (!email) {
    courierSetMessage(courierElements.authMessage, "Escribe tu correo electronico para recuperar la contrasena.", "error");
    courierElements.emailInput?.focus();
    return;
  }

  courierSetMessage(courierElements.authMessage, "RC ORDERA esta enviando el correo de recuperacion...");
  const redirectTo = window.location.href.split("#")[0];
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    courierSetMessage(courierElements.authMessage, courierFriendlyAuthError(error), "error");
    return;
  }
  courierSetMessage(
    courierElements.authMessage,
    "Correo enviado por RC ORDERA. Abre el enlace para crear una contrasena nueva.",
    "ok"
  );
}

async function courierResendVerificationEmail() {
  if (!courierEnsureClient()) await courierLoadSupabaseLibrary();
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  if (!client) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  if (!email) {
    courierSetMessage(courierElements.authMessage, "Escribe tu correo electronico para reenviar la verificacion.", "error");
    courierElements.emailInput?.focus();
    return;
  }

  courierSetMessage(courierElements.authMessage, "RC ORDERA esta reenviando el correo de verificacion...");
  const redirectTo = window.location.href.split("#")[0].split("?")[0];
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    courierSetMessage(courierElements.authMessage, courierFriendlyAuthError(error), "error");
    return;
  }
  courierSetMessage(
    courierElements.authMessage,
    "Correo de verificacion reenviado por RC ORDERA. Revisa entrada, spam o promociones.",
    "ok"
  );
}

function courierShowPasswordRecoveryForm() {
  courierRecoveringPassword = true;
  courierElements.authFields.hidden = false;
  courierElements.emailInput.closest("label").hidden = true;
  courierElements.passwordInput.closest("label").hidden = true;
  courierElements.signInButton.hidden = true;
  courierElements.signUpButton.hidden = true;
  courierElements.resetPasswordButton.hidden = true;
  if (courierElements.resendVerificationButton) courierElements.resendVerificationButton.hidden = true;
  courierElements.passwordRecoveryPanel.hidden = false;
  courierSetMessage(
    courierElements.authMessage,
    "RC ORDERA verifico el enlace. Escribe tu nueva contrasena.",
    "ok"
  );
  window.setTimeout(() => courierElements.newPasswordInput?.focus(), 50);
}

function courierHidePasswordRecoveryForm(message = "") {
  courierRecoveringPassword = false;
  courierElements.passwordRecoveryPanel.hidden = true;
  courierElements.newPasswordInput.value = "";
  courierElements.emailInput.closest("label").hidden = false;
  courierElements.passwordInput.closest("label").hidden = false;
  courierElements.signInButton.hidden = false;
  courierElements.signUpButton.hidden = false;
  courierElements.resetPasswordButton.hidden = false;
  if (courierElements.resendVerificationButton) courierElements.resendVerificationButton.hidden = false;
  courierRender();
  if (message) courierSetMessage(courierElements.authMessage, message, "ok");
}

async function courierUpdateRecoveredPassword() {
  if (!courierEnsureClient()) await courierLoadSupabaseLibrary();
  const client = courierEnsureClient();
  const password = courierElements.newPasswordInput.value;
  if (!client) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  if (password.length < 6) {
    courierSetMessage(courierElements.authMessage, "La nueva contrasena debe tener minimo 6 caracteres.", "error");
    courierElements.newPasswordInput.focus();
    return;
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    courierSetMessage(courierElements.authMessage, courierFriendlyAuthError(error), "error");
    return;
  }
  courierHidePasswordRecoveryForm("Contrasena actualizada. Ya puedes iniciar sesion en RC ORDERA.");
}

function courierProfilePayloadForMetadata() {
  const countryCode = courierInputValue(courierElements.countryInput).toUpperCase();
  return {
    first_name: courierInputValue(courierElements.firstNameInput),
    last_name: courierInputValue(courierElements.lastNameInput),
    phone: courierInputValue(courierElements.phoneInput),
    birth_date: courierInputValue(courierElements.birthDateInput),
    country: courierCountryName(countryCode),
    city: courierInputValue(courierElements.cityInput),
    region: courierInputValue(courierElements.regionInput),
    postal_code: courierInputValue(courierElements.postalCodeInput),
    address: courierInputValue(courierElements.addressInput),
    identity_document: courierInputValue(courierElements.identityInput),
    identity_document_url: courierInputValue(courierElements.identityFileUrlInput),
    vehicle_type: courierInputValue(courierElements.vehicleTypeInput),
    vehicle_plate: courierInputValue(courierElements.vehiclePlateInput),
    driver_license: courierInputValue(courierElements.driverLicenseInput),
    driver_license_url: courierInputValue(courierElements.driverLicenseFileUrlInput),
    insurance_info: courierInputValue(courierElements.insuranceInput),
    insurance_url: courierInputValue(courierElements.insuranceFileUrlInput),
    bank_account: courierInputValue(courierElements.bankInput),
    availability: { text: courierInputValue(courierElements.availabilityInput) },
    photo_url: courierInputValue(courierElements.photoUrlInput),
    verification_selfie_url: courierInputValue(courierElements.selfieUrlInput),
    work_permit_url: courierInputValue(courierElements.workPermitUrlInput),
    preferred_language: courierRegistrationRegion.preferredLanguage,
    country_code: countryCode,
    timezone: courierRegistrationRegion.timezone,
    registration_latitude: courierRegistrationRegion.latitude,
    registration_longitude: courierRegistrationRegion.longitude,
  };
}

async function courierSignOut() {
  if (!courierClient) return;
  const previousAvailability = courierAvailable;
  courierStopLocationWatch();
  try {
    const { error: availabilityError } = await courierClient.rpc("set_courier_availability", {
      p_available: false,
    });
    if (availabilityError) throw availabilityError;
    const { error: signOutError } = await courierClient.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
  } catch (error) {
    courierAvailable = previousAvailability;
    courierSyncLocationWatch();
    courierRender();
    courierLogError("courier_sign_out", error);
    courierSetMessage(
      courierElements.locationMessage || courierElements.authMessage,
      "No fue posible desconectarte en la nube. Revisa internet e intenta cerrar sesion nuevamente.",
      "error"
    );
    return;
  }
  courierStopApprovalRealtime();
  courierStopDeliveryRealtime();
  courierStopLocationWatch();
  courierUser = null;
  courierProfile = null;
  courierAvailable = false;
  courierAssignments = [];
  courierHistory = [];
  courierPayoutState = null;
  courierProfileLastLoadedAt = 0;
  courierHistoryLastLoadedAt = 0;
  courierPayoutLastLoadedAt = 0;
  courierPushRegisteredUserId = "";
  window.location.replace(`index.html?app=${COURIER_APP_VERSION}`);
}
function courierBase64UrlToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) => char.charCodeAt(0))
  );
}

async function courierRegisterPushNotifications() {
  const client = courierEnsureClient();
  const userId = courierUser?.id || "";
  if (!client || !userId) return false;

  if (courierPushRegisteredUserId === userId) return true;
  if (courierPushRegistrationPromise) return courierPushRegistrationPromise;

  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    console.warn("Este dispositivo no soporta Web Push.");
    return false;
  }

  const operation = (async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      await navigator.serviceWorker.ready;
      if (courierUser?.id !== userId) return false;

      let permission = Notification.permission;
      if (permission === "default") permission = await Notification.requestPermission();
      if (permission !== "granted") {
        courierSetMessage(
          courierElements.locationMessage,
          "Estas disponible, pero las notificaciones estan desactivadas. Activalas para recibir pedidos en segundo plano.",
          "error"
        );
        return false;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: courierBase64UrlToUint8Array(COURIER_VAPID_PUBLIC_KEY),
        });
      }

      const subscriptionJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh || "";
      const authKey = subscriptionJson.keys?.auth || "";
      if (!endpoint || !p256dh || !authKey) {
        throw new Error("La suscripcion Push no devolvio todas las claves.");
      }
      if (courierUser?.id !== userId) return false;

      const { error } = await client
        .from("courier_push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth_key: authKey,
            user_agent: navigator.userAgent || "",
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" }
        );
      if (error) throw error;

      courierPushRegisteredUserId = userId;
      return true;
    } catch (error) {
      courierLogError("register_push", error);
      courierSetMessage(
        courierElements.locationMessage,
        "No se pudieron activar las notificaciones de pedidos. Revisa los permisos del dispositivo.",
        "error"
      );
      return false;
    }
  })();

  courierPushRegistrationPromise = operation;
  try {
    return await operation;
  } finally {
    if (courierPushRegistrationPromise === operation) {
      courierPushRegistrationPromise = null;
    }
  }
}

async function courierToggleAvailability() {
  if (courierProfile?.status !== "approved") return;

  await courierLoadAvailability();

const nextAvailable = !courierAvailable;
  if (nextAvailable && !courierLastLocation) {
    courierSetMessage(courierElements.locationMessage, "Para estar disponible primero comparte tu ubicacion actual.");
    await courierShareLocation({ makeAvailable: true });
    return;
  }

  courierElements.availabilityButton.disabled = true;
  try {
    const client = courierEnsureClient();
    const { data, error } = await client.rpc("set_courier_availability", {
      p_available: nextAvailable,
   
    
    
    
    
    
    
    
    });
    if (error) throw error;

    const confirmed = Array.isArray(data) ? data[0] : data;
    courierAvailable = confirmed?.available === true;
    if (courierAvailable) {
      courierArmAlarm().catch(() => {});
      courierRegisterPushNotifications().catch((pushError) => courierLogError("register_push", pushError));
      courierLoadDeliveryOffers({ silent: true }).catch(() => {});
    }
    courierSetMessage(
      courierElements.locationMessage,
      courierAvailable ? "Estas disponible para recibir pedidos cercanos." : "Estas desconectado para nuevas entregas.",
      "ok"
    );
  } catch (error) {
    courierLogError("set_availability", error);
    await courierLoadAvailability().catch(() => {});
    courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
  } finally {
    courierElements.availabilityButton.disabled = false;
    courierRender();
  }
}

async function courierResumeRuntime(options = {}) {
  const force = options.force === true;
  if (document.visibilityState === "hidden" || courierResumePromise || !courierClient) {
    return courierResumePromise;
  }

  const now = Date.now();
  if (!force && now - courierLastRuntimeResumeAt < COURIER_RUNTIME_RESUME_MIN_MS) {
    return false;
  }

  courierResumePromise = (async () => {
    const { data, error } = await courierClient.auth.getSession();
    if (error) throw error;
    const sessionUser = data.session?.user || courierUser || null;
    if (!sessionUser) {
      console.warn("No se pudo recuperar la sesión todavía. Se conserva el estado actual del colaborador.");
      return false;
    }

    const userChanged = !courierUser || courierUser.id !== sessionUser.id;
    if (userChanged) {
      courierStopApprovalRealtime();
      courierStopDeliveryRealtime();
      courierStopLocationWatch();
      courierStopOfferAlarm();
      courierProfile = null;
      courierAssignments = [];
      courierHistory = [];
      courierAvailable = false;
      courierLastLocation = null;
      courierPayoutState = null;
      courierProfileLastLoadedAt = 0;
      courierHistoryLastLoadedAt = 0;
      courierPayoutLastLoadedAt = 0;
      courierPushRegisteredUserId = "";
    }

    courierUser = sessionUser;
    await courierLoadProfile({
      force: userChanged,
      refreshOffers: true,
      refreshHistory: false,
      refreshPayout: false,
    });
    courierStartApprovalRealtime();
    if (courierProfile?.status === "approved") courierStartDeliveryRealtime();
    courierSyncOffersPolling();
    courierSyncLocationWatch();

    if (courierProfile?.status === "approved" && courierAvailable) {
      courierRegisterPushNotifications().catch((pushError) => courierLogError("resume_push", pushError));
    }

    const locationAge = Date.now() - Date.parse(courierLastLocation?.updatedAt || "");
    const hasRecentLocation =
      courierHasValidCoordinates() &&
      Number.isFinite(locationAge) &&
      locationAge >= 0 &&
      locationAge < COURIER_LOCATION_WRITE_MIN_MS;

    if (
      courierProfile?.status === "approved" &&
      courierAvailable &&
      navigator.geolocation &&
      navigator.onLine &&
      !hasRecentLocation
    ) {
      try {
        const position = await courierCurrentPosition();
        courierLastLocation = {
          lat: Number(position.coords.latitude).toFixed(6),
          lng: Number(position.coords.longitude).toFixed(6),
          accuracy: Math.round(position.coords.accuracy || 0),
          updatedAt: new Date().toISOString(),
        };
        courierLastLocationWriteAt = Date.now();
        await courierPersistLiveLocation(true);
      } catch (locationError) {
        courierLogError("resume_location", locationError);
      }
    }

    courierLastRuntimeResumeAt = Date.now();
    return true;
  })()
    .catch((error) => {
      courierLogError("resume_runtime", error);
      return false;
    })
    .finally(() => {
      courierResumePromise = null;
      courierRender();
    });

  return courierResumePromise;
}

function courierUrlLooksLikeRecovery() {
  return /type=recovery/i.test(window.location.hash) || /[?&](type=recovery|recovery=1)/i.test(window.location.search);
}

async function courierInitialize() {
  if (courierAuthReady) return;
  const config = courierSupabaseConfig();
  if (!config.url || !config.anonKey) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  if (!window.supabase?.createClient && !(await courierLoadSupabaseLibrary())) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  const client = courierEnsureClient();
  if (!client) {
    courierSetMessage(courierElements.authMessage, courierConnectionMessage(), "error");
    return;
  }
  courierAuthReady = true;

  const { data, error } = await client.auth.getSession();
  if (error) courierLogError("initial_session", error);
  courierUser = data?.session?.user || null;

  if (courierUrlLooksLikeRecovery()) courierRecoveringPassword = true;
  const requestedView = courierParams.get("view");
  courierSetView(
    courierUser && requestedView === "active" ? "active" : courierUser ? "home" : "profile",
    { instant: true }
  );
  courierRender();
  if (courierRecoveringPassword) courierShowPasswordRecoveryForm();
  if (courierUser) {
    await courierLoadProfile({ force: true });
    courierStartApprovalRealtime();
  }

  client.auth.onAuthStateChange(async (event, session) => {
    const nextUser = session?.user || null;

    if (event === "PASSWORD_RECOVERY") {
      courierUser = nextUser;
      courierSetView("profile", { instant: true });
      courierShowPasswordRecoveryForm();
      return;
    }

    if (event === "SIGNED_OUT") {
      courierUser = null;
      courierProfile = null;
      courierAssignments = [];
      courierHistory = [];
      courierAvailable = false;
      courierLastLocation = null;
      courierPayoutState = null;
      courierProfileLastLoadedAt = 0;
      courierHistoryLastLoadedAt = 0;
      courierPayoutLastLoadedAt = 0;
      courierPushRegisteredUserId = "";

      courierStopApprovalRealtime();
      courierStopDeliveryRealtime();
      courierStopLocationWatch();
      courierStopOfferAlarm();

      courierSetView("profile", { instant: true });
      courierRender();
      return;
    }

    if (!nextUser) {
      console.warn("Auth temporalmente sin usuario. Se conserva el estado del colaborador.");
      return;
    }

    const userChanged = !courierUser || courierUser.id !== nextUser.id;
    if (userChanged) {
      courierStopApprovalRealtime();
      courierStopDeliveryRealtime();
      courierStopLocationWatch();
      courierStopOfferAlarm();
      courierProfile = null;
      courierAssignments = [];
      courierHistory = [];
      courierAvailable = false;
      courierLastLocation = null;
      courierPayoutState = null;
      courierProfileLastLoadedAt = 0;
      courierHistoryLastLoadedAt = 0;
      courierPayoutLastLoadedAt = 0;
      courierPushRegisteredUserId = "";
    }

    courierUser = nextUser;

    // Supabase puede emitir estos eventos varias veces para la misma sesión.
    // Si ya tenemos el runtime cargado, conservarlo evita consultas y renders
    // redundantes sin perder Realtime, GPS o polling de respaldo.
    if (
      !userChanged &&
      courierProfile &&
      ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event)
    ) {
      courierStartApprovalRealtime();
      if (courierProfile.status === "approved") courierStartDeliveryRealtime();
      courierSyncLocationWatch();
      courierSyncOffersPolling();
      return;
    }

    await courierLoadProfile({ force: userChanged || event === "USER_UPDATED" });
    courierSetView("home", { instant: true });
    courierStartApprovalRealtime();
    if (courierProfile?.status === "approved") courierStartDeliveryRealtime();
    courierSyncLocationWatch();
    courierSyncOffersPolling();
    courierRender();
  });
}

courierElements.signInButton.addEventListener("click", courierSignIn);
courierElements.signUpButton.addEventListener("click", () => {
  if (!courierRegistrationMode) {
    courierRegistrationMode = true;

    if (courierElements.registrationPanel) {
      courierElements.registrationPanel.hidden = false;
    }

    courierElements.signUpButton.textContent = "Crear cuenta y enviar solicitud";

    courierSetMessage(
      courierElements.authMessage,
      "Completa tus datos para crear la cuenta de colaborador.",
      "ok"
    );

    courierElements.firstNameInput?.focus();
    return;
  }

  courierSignUp();
});
courierElements.resetPasswordButton.addEventListener("click", courierSendPasswordResetEmail);
courierElements.resendVerificationButton?.addEventListener("click", courierResendVerificationEmail);
courierElements.updatePasswordButton.addEventListener("click", courierUpdateRecoveredPassword);
courierElements.cancelRecoveryButton.addEventListener("click", () => courierHidePasswordRecoveryForm());
courierElements.signOutButton.addEventListener("click", courierSignOut);
courierElements.saveProfileButton.addEventListener("click", courierSaveProfile);
courierElements.availabilityButton.addEventListener("click", courierToggleAvailability);
courierElements.vehicleTypeInput.addEventListener("change", courierRenderVehicleRequirements);
courierElements.countryInput?.addEventListener("change", () => {
  const countryCode = courierElements.countryInput.value;

  courierElements.cityInput.value = "";
  courierElements.postalCodeInput.value = "";

  courierRegistrationRegion = {
    ...courierRegistrationRegion,
    countryCode,
    country: courierCountryName(countryCode),
    region: "",
    city: "",
    postalCode: "",
    latitude: null,
    longitude: null,
    timezone:
      countryCode === "PL"
        ? "Europe/Warsaw"
        : countryCode === "CO"
          ? "America/Bogota"
          : courierRegistrationRegion.timezone,
  };

  courierRenderRegionOptions(countryCode);
  courierElements.regionInput.value = "";
  courierPreparePlaceAutocomplete().catch(() => {});
});
courierElements.regionInput?.addEventListener("change", () => {
  const region = courierInputValue(courierElements.regionInput);
  courierElements.cityInput.value = "";
  courierElements.postalCodeInput.value = "";
  courierRegistrationRegion = {
    ...courierRegistrationRegion,
    region,
    city: "",
    postalCode: "",
    latitude: null,
    longitude: null,
  };
  courierElements.cityInput.disabled = !region;
  if (region) courierPreparePlaceAutocomplete().catch(() => {});
});
courierElements.cityInput?.addEventListener("input", () => {
  courierRegistrationRegion.city = courierInputValue(courierElements.cityInput);
});
courierElements.cityInput?.addEventListener("focus", () => {
  courierPreparePlaceAutocomplete().catch(() => {});
});
courierElements.shareLocationButton?.addEventListener("click", courierShareLocation);
courierElements.mapCenterButton?.addEventListener(
  "click",
  () => {
    courierRenderDeliveryMap({
      forceFit: true
    }).catch(() => {});
  }
);
courierElements.openGpsButton?.addEventListener("click", courierOpenGps);
courierElements.refreshOffersButton?.addEventListener("click", () =>
  courierLoadDeliveryOffers({ force: true })
);
courierElements.offersList?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest(".courier-offer-card");
  if (!button || !card) return;
  if (button.dataset.action === "accept-assignment") courierUpdateAssignmentStatus(card.dataset.assignmentId, "accepted");
  if (button.dataset.action === "reject-assignment") courierUpdateAssignmentStatus(card.dataset.assignmentId, "rejected");
});
courierElements.arrivedRestaurantButton?.addEventListener("click", () => {
  if (courierActiveAssignmentId) courierUpdateAssignmentStatus(courierActiveAssignmentId, "arrived_restaurant");
});
courierElements.pickedUpButton?.addEventListener("click", () => {
  if (courierActiveAssignmentId) courierUpdateAssignmentStatus(courierActiveAssignmentId, "picked_up");
});
courierElements.arrivedCustomerButton?.addEventListener("click", () => {
  if (courierActiveAssignmentId) courierUpdateAssignmentStatus(courierActiveAssignmentId, "arrived_customer");
});
courierElements.deliveredButton?.addEventListener("click", () => {
  if (courierActiveAssignmentId) courierUpdateAssignmentStatus(courierActiveAssignmentId, "delivered");
});
courierElements.payoutButton?.addEventListener("click", () => courierRefreshPayoutState("onboarding"));
courierElements.viewButtons.forEach((button) => {
  button.addEventListener("click", () => courierSetView(button.dataset.courierViewTarget));
});
courierElements.identityFileInput?.addEventListener("change", () =>
  courierHandleFileUpload(courierElements.identityFileInput, courierElements.identityFileUrlInput, "documento-identidad", "Documento de identidad")
);
courierElements.driverLicenseFileInput?.addEventListener("change", () =>
  courierHandleFileUpload(courierElements.driverLicenseFileInput, courierElements.driverLicenseFileUrlInput, "licencia", "Licencia")
);
courierElements.insuranceFileInput?.addEventListener("change", () =>
  courierHandleFileUpload(courierElements.insuranceFileInput, courierElements.insuranceFileUrlInput, "seguro", "Seguro")
);
courierElements.photoFileInput?.addEventListener("change", () =>
  courierHandleFileUpload(courierElements.photoFileInput, courierElements.photoUrlInput, "foto", "Foto")
);
courierElements.selfieFileInput?.addEventListener("change", () =>
  courierHandleFileUpload(courierElements.selfieFileInput, courierElements.selfieUrlInput, "selfie", "Selfie de verificacion")
);
courierElements.workPermitFileInput?.addEventListener("change", () =>
  courierHandleFileUpload(courierElements.workPermitFileInput, courierElements.workPermitUrlInput, "permiso-trabajo", "Permiso de trabajo")
);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") courierResumeRuntime();
});
window.addEventListener("pageshow", () => courierResumeRuntime());
window.addEventListener("online", () => courierResumeRuntime({ force: true }));
window.addEventListener("offline", () => {
  courierStopOffersPolling();
  courierSetMessage(
    courierElements.locationMessage,
    "Sin conexion. Tu estado en linea permanece guardado y la app se sincronizara al reconectar.",
    "error"
  );
});

if (courierElements.countryInput && !courierElements.countryInput.value) {
  courierElements.countryInput.value = courierRegistrationRegion.countryCode || "";
}
courierRenderRegionOptions(courierRegistrationRegion.countryCode, courierRegistrationRegion.region);
courierRenderVehicleRequirements();
courierSetView(courierCurrentView, { instant: true });
courierInitialize();
