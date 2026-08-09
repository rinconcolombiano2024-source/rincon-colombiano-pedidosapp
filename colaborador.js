const COURIER_PLATFORM_SCOPE_ID = "00000000-0000-0000-0000-000000000000";
const COURIER_DOCUMENT_BUCKET = "courier-documents";

function courierDetectedRegion(coords = null) {
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
  firstNameInput: document.querySelector("#courierFirstNameInput"),
  lastNameInput: document.querySelector("#courierLastNameInput"),
  phoneInput: document.querySelector("#courierPhoneInput"),
  birthDateInput: document.querySelector("#courierBirthDateInput"),
  countryInput: document.querySelector("#courierCountryInput"),
  cityInput: document.querySelector("#courierCityInput"),
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
  homeSignedOut: document.querySelector("#courierHomeSignedOut"),
  activeDeliveryCard: document.querySelector("#courierActiveDeliveryCard"),
  historyList: document.querySelector("#courierHistoryList"),
  steps: document.querySelector("#courierSteps"),
  views: Array.from(document.querySelectorAll("[data-courier-view]")),
  viewButtons: Array.from(document.querySelectorAll("[data-courier-view-target]")),
};

const COURIER_STATUS_LABELS = {
  draft: "Borrador",
  pending_review: "Pendiente de revision",
  approved: "Aprobado",
  rejected: "Rechazado",
  suspended: "Suspendido",
  inactive: "Inactivo",
};

let courierClient = null;
let courierUser = null;
let courierAuthReady = false;
let courierProfile = null;
let courierAvailable = false;
let courierLastLocation = null;
let courierRecoveringPassword = false;
let courierAssignments = [];
let courierActiveAssignmentId = "";
let courierOffersTimer = null;
let courierCurrentView = "profile";
let courierApprovalChannel = null;
let courierRegistrationRegion = courierDetectedRegion();

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
}

function courierNormalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function courierInputValue(input) {
  return courierNormalizeText(input?.value || "");
}

function courierSupabaseConfig() {
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

function courierConnectionMessage() {
  const config = courierSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return "Falta configurar la conexion de Supabase para usar colaboradores.";
  }
  if (!window.supabase?.createClient) {
    return "No se pudo cargar la conexion de Supabase. Revisa internet, actualiza la pagina o intenta de nuevo.";
  }
  return "No se pudo iniciar la conexion de colaborador.";
}

function courierLoadSupabaseLibrary() {
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

function courierEnsureClient() {
  if (courierClient) return courierClient;
  const config = courierSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
  courierClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
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
  const nameExtension = String(file?.name || "").split(".").pop().toLowerCase();
  const cleanNameExtension = nameExtension.replace(/[^a-z0-9]/g, "");
  if (cleanNameExtension && cleanNameExtension.length <= 5) return cleanNameExtension;
  if (file?.type === "application/pdf") return "pdf";
  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  return "jpg";
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
      error.message || "No se pudo subir el archivo. Revisa internet, el tipo de archivo o los permisos de Storage.",
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
  if (!courierLastLocation) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${courierLastLocation.lat},${courierLastLocation.lng}`
  )}`;
}

function courierFriendlyDeliveryError(error) {
  const message = String(error?.message || "");
  if (/upsert_courier_live_location|delivery_assignment|assign_nearest|function .* does not exist|schema cache/i.test(message)) {
    return "La asignacion de entregas cercanas aun no esta activa en la nube. Revisa la configuracion de Supabase.";
  }
  if (/Courier profile is not approved/i.test(message)) return "Tu perfil debe estar aprobado por la administracion antes de recibir pedidos.";
  if (/Invalid location/i.test(message)) return "La ubicacion no es valida. Intenta compartirla de nuevo.";
  if (/not authenticated/i.test(message)) return "Inicia sesion como colaborador.";
  return message || "No se pudo actualizar la entrega.";
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
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} zl`;
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
  if (!courierUser) {
    courierElements.activeDeliveryCard.innerHTML = `<div class="customer-empty">Inicia sesion para ver tu entrega activa.</div>`;
    courierSetStepButtons();
    return;
  }
  if (!active) {
    courierElements.activeDeliveryCard.innerHTML = `<div class="customer-empty">No tienes una entrega activa.</div>`;
    courierSetStepButtons();
    return;
  }

  const pickupUrl = courierCoordinatesUrl(active.pickup_lat, active.pickup_lng);
  const deliveryUrl = courierDeliveryGpsUrl(active);
  const items = courierOrderItems(active);
  courierElements.activeDeliveryCard.innerHTML = `
    <article class="courier-offer-card courier-active-card" data-assignment-id="${courierEscapeHtml(active.assignment_id)}">
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
    </article>
  `;
  courierSetStepButtons();
}

function courierRenderHistory() {
  if (!courierElements.historyList) return;
  if (!courierUser) {
    courierElements.historyList.innerHTML = `<div class="customer-empty">Inicia sesion para consultar el historial.</div>`;
    return;
  }
  const history = courierAssignments.filter((assignment) =>
    ["delivered", "rejected", "cancelled"].includes(assignment.status)
  );
  if (!history.length) {
    courierElements.historyList.innerHTML = `<div class="customer-empty">Todavia no hay entregas finalizadas en esta sesion.</div>`;
    return;
  }
  courierElements.historyList.innerHTML = history
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
        </article>
      `
    )
    .join("");
}

function courierRenderDeliveryOffers() {
  if (!courierElements.offersList) return;
  if (!courierUser) {
    courierElements.offersList.innerHTML = "";
    courierRenderActiveDelivery();
    courierRenderHistory();
    courierSetStepButtons();
    return;
  }
  if (courierProfile?.status !== "approved") {
    courierElements.offersList.innerHTML = `<div class="customer-empty">La administracion debe aprobar tu perfil antes de recibir pedidos.</div>`;
    courierRenderActiveDelivery();
    courierRenderHistory();
    courierSetStepButtons();
    return;
  }
  const offeredAssignments = courierAssignments.filter((assignment) => assignment.status === "offered");
  if (!offeredAssignments.length) {
    courierElements.offersList.innerHTML = `<div class="customer-empty">No tienes pedidos disponibles ahora. Activa disponibilidad y comparte ubicacion.</div>`;
    courierRenderActiveDelivery();
    courierRenderHistory();
    courierSetStepButtons();
    return;
  }

  courierElements.offersList.innerHTML = offeredAssignments
    .map((assignment) => {
      const pickupUrl = courierCoordinatesUrl(assignment.pickup_lat, assignment.pickup_lng);
      const deliveryUrl = courierDeliveryGpsUrl(assignment);
      const items = courierOrderItems(assignment);
      const status = assignment.status;
      const distance = Number.parseFloat(assignment.distance_km);
      return `
        <article class="courier-offer-card" data-assignment-id="${courierEscapeHtml(assignment.assignment_id)}">
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
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="client-order-actions">
            ${pickupUrl ? `<a href="${courierEscapeHtml(pickupUrl)}" target="_blank" rel="noopener">GPS restaurante</a>` : ""}
            ${deliveryUrl ? `<a href="${courierEscapeHtml(deliveryUrl)}" target="_blank" rel="noopener">GPS cliente</a>` : ""}
            ${
              status === "offered"
                ? `
                  <button type="button" data-action="accept-assignment">Aceptar</button>
                  <button type="button" data-action="reject-assignment">Rechazar</button>
                `
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
  courierRenderActiveDelivery();
  courierRenderHistory();
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

async function courierPersistLiveLocation(available = courierAvailable) {
  const client = courierEnsureClient();
  if (!client || !courierUser || !courierLastLocation) return false;
  const { error } = await client.rpc("upsert_courier_live_location", {
    p_available: Boolean(available),
    p_lat: Number(courierLastLocation.lat),
    p_lng: Number(courierLastLocation.lng),
    p_accuracy_m: Number.parseInt(courierLastLocation.accuracy, 10) || 0,
  });
  if (error) throw error;
  return true;
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
    if (options.makeAvailable) courierAvailable = true;
    await courierPersistLiveLocation(courierAvailable);
    if (courierAvailable) await courierLoadDeliveryOffers({ silent: true });
    if (courierElements.openGpsButton) courierElements.openGpsButton.disabled = false;
    courierSetMessage(
      courierElements.locationMessage,
      `Ubicacion guardada: ${courierLastLocation.lat}, ${courierLastLocation.lng}. Precision aprox: ${courierLastLocation.accuracy} m.`,
      "ok"
    );
  } catch (error) {
    courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
  } finally {
    courierElements.shareLocationButton.disabled = false;
    courierRender();
  }
}

function courierOpenGps() {
  const url = courierGpsUrl();
  if (!url) {
    courierSetMessage(courierElements.locationMessage, "Primero comparte tu ubicacion actual.", "error");
    return;
  }
  window.open(url, "_blank", "noopener");
}

async function courierLoadDeliveryOffers(options = {}) {
  const { silent = false } = options;
  const client = courierEnsureClient();
  if (!client || !courierUser || courierProfile?.status !== "approved") {
    courierAssignments = [];
    courierRenderDeliveryOffers();
    return;
  }

  if (!silent) courierSetMessage(courierElements.locationMessage, "Actualizando pedidos disponibles...");
  const { data, error } = await client.rpc("get_courier_delivery_offers");
  if (error) {
    courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
    return;
  }

  const previousOffered = new Set(courierAssignments.filter((assignment) => assignment.status === "offered").map((assignment) => assignment.assignment_id));
  courierAssignments = Array.isArray(data) ? data : [];
  const hasNewOffer = courierAssignments.some((assignment) => assignment.status === "offered" && !previousOffered.has(assignment.assignment_id));
  courierRenderDeliveryOffers();
  courierRender();
  if (hasNewOffer) {
    courierSetMessage(courierElements.locationMessage, "Nuevo pedido disponible. Revisa y acepta si puedes tomarlo.", "ok");
  } else if (!silent) {
    courierSetMessage(courierElements.locationMessage, "Pedidos actualizados.", "ok");
  }
}

function courierSyncOffersPolling() {
  const shouldPoll = Boolean(courierUser && courierProfile?.status === "approved");
  if (!shouldPoll && courierOffersTimer) {
    window.clearInterval(courierOffersTimer);
    courierOffersTimer = null;
  }
  if (shouldPoll && !courierOffersTimer) {
    courierOffersTimer = window.setInterval(() => {
      courierLoadDeliveryOffers({ silent: true }).catch(() => {});
      if (courierAvailable && courierLastLocation) courierPersistLiveLocation(true).catch(() => {});
    }, 15000);
  }
}

async function courierUpdateAssignmentStatus(assignmentId, status) {
  const client = courierEnsureClient();
  if (!client || !courierUser) return;
  courierSetMessage(courierElements.locationMessage, "Actualizando entrega...");
  const { error } = await client.rpc("update_delivery_assignment_status", {
    p_assignment_id: assignmentId,
    p_status: status,
  });
  if (error) {
    courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
    return;
  }
  if (status === "accepted") courierAvailable = false;
  if (status === "delivered") courierAvailable = true;
  await courierLoadDeliveryOffers({ silent: true });
  courierSetMessage(courierElements.locationMessage, `${courierAssignmentStatusLabel(status)}.`, "ok");
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
  return message || "No se pudo completar el acceso.";
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
  return {
    user_id: courierUser.id,
    first_name: courierInputValue(courierElements.firstNameInput),
    last_name: courierInputValue(courierElements.lastNameInput),
    full_name: courierFullName(),
    phone: courierInputValue(courierElements.phoneInput),
    country: courierInputValue(courierElements.countryInput),
    city: courierInputValue(courierElements.cityInput),
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
  return {
    user_id: courierUser.id,
    first_name: courierInputValue(courierElements.firstNameInput),
    last_name: courierInputValue(courierElements.lastNameInput),
    phone: courierInputValue(courierElements.phoneInput),
    birth_date: courierInputValue(courierElements.birthDateInput) || null,
    country: courierInputValue(courierElements.countryInput),
    city: courierInputValue(courierElements.cityInput),
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
  courierElements.firstNameInput.value = profile.first_name || "";
  courierElements.lastNameInput.value = profile.last_name || "";
  courierElements.phoneInput.value = profile.phone || "";
  courierElements.birthDateInput.value = profile.birth_date || "";
  courierElements.countryInput.value = profile.country || "";
  courierElements.cityInput.value = profile.city || "";
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
    courierElements.headerStatus.textContent = courierUser ? statusLabel : "Sin iniciar sesion";
  }
  courierElements.profileStatus.textContent = courierUser
    ? `Estado actual: ${statusLabel}.`
    : "Puedes llenar los datos, pero debes iniciar sesion para guardar la solicitud.";

  courierElements.dashboard.hidden = !courierUser;
  if (courierElements.homeSignedOut) courierElements.homeSignedOut.hidden = Boolean(courierUser);
  courierElements.availabilityButton.disabled = status !== "approved";
  if (courierElements.shareLocationButton) courierElements.shareLocationButton.disabled = status !== "approved";
  if (courierElements.refreshOffersButton) courierElements.refreshOffersButton.disabled = status !== "approved";
  courierElements.dashboardText.textContent = status === "approved"
    ? "Perfil aprobado. Activa disponibilidad, comparte ubicacion y recibiras pedidos cercanos."
    : "Tu perfil debe ser aprobado antes de recibir pedidos.";
  courierElements.availabilityButton.textContent = courierAvailable ? "Disponible" : "Desconectado";
  courierRenderVehicleRequirements();
  courierRenderDeliveryOffers();
  courierSyncOffersPolling();
}

function courierValidateProfile() {
  const requiredFields = [
    [courierElements.firstNameInput, "Escribe tu nombre."],
    [courierElements.lastNameInput, "Escribe tus apellidos."],
    [courierElements.phoneInput, "Escribe tu telefono."],
    [courierElements.birthDateInput, "Escribe tu fecha de nacimiento."],
    [courierElements.countryInput, "Escribe tu pais."],
    [courierElements.cityInput, "Escribe tu ciudad."],
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
    await courierLoadProfile();
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
    courierSetMessage(courierElements.profileMessage, error.message || "No se pudo guardar la solicitud.", "error");
  }
}

async function courierLoadProfile() {
  if (!courierClient || !courierUser) return;
  const { data, error } = await courierClient
    .from("courier_profiles")
    .select("*")
    .eq("user_id", courierUser.id)
    .maybeSingle();

  if (error || !data) {
    courierProfile = null;
    courierApplyProfileFields(courierMetadataProfile());
    courierRender();
    return;
  }

  const { data: approvalRows, error: approvalError } = await courierClient.rpc("get_my_courier_approval");
  const approval = Array.isArray(approvalRows) ? approvalRows[0] : approvalRows;
  if (!approvalError && approval) {
    data.status = approval.approved === true ? "approved" : approval.profile_status || data.status;
  }
  courierProfile = data;
  courierApplyProfileFields(data);
  courierRender();
  if (data.status === "approved") {
    courierLoadDeliveryOffers({ silent: true }).catch(() => {});
  }
}

function courierStopApprovalRealtime() {
  const channel = courierApprovalChannel;
  courierApprovalChannel = null;
  if (channel && courierClient?.removeChannel) courierClient.removeChannel(channel).catch(() => {});
}

function courierStartApprovalRealtime() {
  courierStopApprovalRealtime();
  if (!courierClient?.channel || !courierUser) return;
  courierApprovalChannel = courierClient
    .channel(`courier-approval-${courierUser.id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "courier_profiles", filter: `user_id=eq.${courierUser.id}` },
      () => courierLoadProfile().catch(() => {})
    )
    .subscribe();
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

  courierSetMessage(courierElements.authMessage, "Iniciando sesion...");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    courierSetMessage(courierElements.authMessage, courierFriendlyAuthError(error), "error");
    return;
  }
  courierElements.passwordInput.value = "";
  courierSetMessage(courierElements.authMessage, "Sesion iniciada.", "ok");
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
    courierRegistrationRegion = courierDetectedRegion(position.coords);
  } catch {
    courierRegistrationRegion = courierDetectedRegion();
  }
  if (!courierInputValue(courierElements.countryInput) && courierRegistrationRegion.country) {
    courierElements.countryInput.value = courierRegistrationRegion.country;
  }
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
  return {
    first_name: courierInputValue(courierElements.firstNameInput),
    last_name: courierInputValue(courierElements.lastNameInput),
    phone: courierInputValue(courierElements.phoneInput),
    birth_date: courierInputValue(courierElements.birthDateInput),
    country: courierInputValue(courierElements.countryInput),
    city: courierInputValue(courierElements.cityInput),
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
    country_code: courierRegistrationRegion.countryCode,
    timezone: courierRegistrationRegion.timezone,
    registration_latitude: courierRegistrationRegion.latitude,
    registration_longitude: courierRegistrationRegion.longitude,
  };
}

async function courierSignOut() {
  if (!courierClient) return;
  try {
    await courierClient.auth.signOut({ scope: "local" });
  } finally {
    courierStopApprovalRealtime();
    courierUser = null;
    courierProfile = null;
    window.location.replace("index.html?app=v74");
  }
}

function courierToggleAvailability() {
  if (courierProfile?.status !== "approved") return;
  const nextAvailable = !courierAvailable;
  if (nextAvailable && !courierLastLocation) {
    courierSetMessage(courierElements.locationMessage, "Para estar disponible primero comparte tu ubicacion actual.");
    courierShareLocation({ makeAvailable: true });
    return;
  }

  courierAvailable = nextAvailable;
  courierRender();
  courierPersistLiveLocation(courierAvailable)
    .then(() => {
      courierSetMessage(
        courierElements.locationMessage,
        courierAvailable ? "Estas disponible para recibir pedidos cercanos." : "Estas desconectado para nuevas entregas.",
        "ok"
      );
      if (courierAvailable) courierLoadDeliveryOffers({ silent: true }).catch(() => {});
    })
    .catch((error) => {
      courierSetMessage(courierElements.locationMessage, courierFriendlyDeliveryError(error), "error");
    });
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

  const { data } = await client.auth.getSession();
  courierUser = data.session?.user || null;
  if (courierUrlLooksLikeRecovery()) courierRecoveringPassword = true;
  courierSetView(courierUser ? "home" : "profile", { instant: true });
  courierRender();
  if (courierRecoveringPassword) courierShowPasswordRecoveryForm();
  if (courierUser) await courierLoadProfile();
  if (courierUser) courierStartApprovalRealtime();

  client.auth.onAuthStateChange(async (event, session) => {
    courierUser = session?.user || null;
    courierProfile = null;
    courierAssignments = [];
    courierAvailable = false;
    courierStopApprovalRealtime();
    if (event === "PASSWORD_RECOVERY") {
      courierSetView("profile", { instant: true });
      courierShowPasswordRecoveryForm();
      return;
    }
    courierSetView(courierUser ? "home" : "profile", { instant: true });
    courierRender();
    if (courierUser) {
      await courierLoadProfile();
      courierStartApprovalRealtime();
    }
  });
}

courierElements.signInButton.addEventListener("click", courierSignIn);
courierElements.signUpButton.addEventListener("click", courierSignUp);
courierElements.resetPasswordButton.addEventListener("click", courierSendPasswordResetEmail);
courierElements.resendVerificationButton?.addEventListener("click", courierResendVerificationEmail);
courierElements.updatePasswordButton.addEventListener("click", courierUpdateRecoveredPassword);
courierElements.cancelRecoveryButton.addEventListener("click", () => courierHidePasswordRecoveryForm());
courierElements.signOutButton.addEventListener("click", courierSignOut);
courierElements.saveProfileButton.addEventListener("click", courierSaveProfile);
courierElements.availabilityButton.addEventListener("click", courierToggleAvailability);
courierElements.vehicleTypeInput.addEventListener("change", courierRenderVehicleRequirements);
courierElements.shareLocationButton?.addEventListener("click", courierShareLocation);
courierElements.openGpsButton?.addEventListener("click", courierOpenGps);
courierElements.refreshOffersButton?.addEventListener("click", () => courierLoadDeliveryOffers());
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

courierRenderVehicleRequirements();
courierSetView(courierCurrentView, { instant: true });
courierInitialize();
