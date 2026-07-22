const COURIER_PLATFORM_SCOPE_ID = "00000000-0000-0000-0000-000000000000";
const COURIER_DOCUMENT_BUCKET = "courier-documents";

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
  locationMessage: document.querySelector("#courierLocationMessage"),
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

const COURIER_VERIFICATION_EMAIL = "pedidosapprinconcolombiano@gmail.com";
const COURIER_FILE_FIELDS = [
  ["identityFileUrlInput", "Documento de identidad"],
  ["driverLicenseFileUrlInput", "Licencia"],
  ["insuranceFileUrlInput", "Seguro"],
  ["photoUrlInput", "Foto"],
  ["selfieUrlInput", "Selfie de verificacion"],
  ["workPermitUrlInput", "Permiso de trabajo"],
];

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
  courierSetMessage(courierElements.profileMessage, `Subiendo ${label}...`);
  try {
    targetInput.value = await courierUploadDocument(file, kind);
    courierSetFileStatus(targetInput, `${label} subido: ${file.name || courierReadableFileRef(targetInput.value)}`, "ok");
    courierSetMessage(courierElements.profileMessage, `${label} subido correctamente. Presiona Enviar solicitud para guardar.`, "ok");
  } catch (error) {
    courierSetFileStatus(targetInput, `${label} no subio. Intenta de nuevo.`, "error");
    courierSetMessage(
      courierElements.profileMessage,
      error.message || "No se pudo subir el archivo. Ejecuta la migracion v58 o revisa permisos de Storage.",
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

function courierShareLocation() {
  if (!navigator.geolocation) {
    courierSetMessage(courierElements.locationMessage, "Este dispositivo no permite compartir ubicacion.", "error");
    return;
  }

  courierElements.shareLocationButton.disabled = true;
  courierSetMessage(courierElements.locationMessage, "Solicitando ubicacion...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      courierLastLocation = {
        lat: Number(position.coords.latitude).toFixed(6),
        lng: Number(position.coords.longitude).toFixed(6),
        accuracy: Math.round(position.coords.accuracy || 0),
        updatedAt: new Date().toISOString(),
      };
      courierElements.shareLocationButton.disabled = false;
      if (courierElements.openGpsButton) courierElements.openGpsButton.disabled = false;
      courierSetMessage(
        courierElements.locationMessage,
        `Ubicacion lista: ${courierLastLocation.lat}, ${courierLastLocation.lng}. Precision aprox: ${courierLastLocation.accuracy} m.`,
        "ok"
      );
    },
    () => {
      courierElements.shareLocationButton.disabled = false;
      courierSetMessage(courierElements.locationMessage, "No pude obtener ubicacion. Revisa permisos del navegador.", "error");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
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

function courierFriendlyAuthError(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "Correo o contrasena incorrectos.";
  if (/email not confirmed/i.test(message)) {
    return "RINCON COLOMBIANO PEDIDOS envio un correo de verificacion. Revisa tu correo, confirma la cuenta y vuelve a iniciar sesion.";
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
    preferred_language: "es",
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

function courierProfilePayload() {
  const preservedStatus = courierProfile?.status;
  const status = preservedStatus === "approved" || preservedStatus === "suspended" ? preservedStatus : "pending_review";
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
    status,
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
  courierElements.profileStatus.textContent = courierUser
    ? `Estado actual: ${statusLabel}.`
    : "Puedes llenar los datos, pero debes iniciar sesion para guardar la solicitud.";

  courierElements.dashboard.hidden = !courierUser;
  courierElements.availabilityButton.disabled = status !== "approved";
  courierElements.dashboardText.textContent = status === "approved"
    ? "Perfil aprobado. Puedes activar disponibilidad cuando existan pedidos asignados."
    : "Tu perfil debe ser aprobado antes de recibir pedidos.";
  courierElements.availabilityButton.textContent = courierAvailable ? "Disponible" : "Desconectado";
  courierRenderVehicleRequirements();
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
    console.warn("No se pudo activar el rol de colaborador. Ejecuta la migracion de Fase 3 en Supabase.", error);
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
    courierSetMessage(
      courierElements.profileMessage,
      missingDocs.length
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

  courierProfile = data;
  courierApplyProfileFields(data);
  courierRender();
}

async function courierSignIn() {
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  const password = courierElements.passwordInput.value;
  if (!client) {
    courierSetMessage(courierElements.authMessage, "Supabase no esta configurado o no cargo correctamente.", "error");
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
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  const password = courierElements.passwordInput.value;
  if (!client) {
    courierSetMessage(courierElements.authMessage, "Supabase no esta configurado o no cargo correctamente.", "error");
    return;
  }
  if (!email || password.length < 6) {
    courierSetMessage(courierElements.authMessage, "Usa correo y contrasena de minimo 6 caracteres.", "error");
    return;
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
    "Cuenta creada. RINCON COLOMBIANO PEDIDOS te envio un correo de verificacion. Abre ese correo, confirma la cuenta y despues inicia sesion como colaborador.",
    "ok"
  );
}

async function courierSendPasswordResetEmail() {
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  if (!client) {
    courierSetMessage(courierElements.authMessage, "Supabase no esta configurado o no cargo correctamente.", "error");
    return;
  }
  if (!email) {
    courierSetMessage(courierElements.authMessage, "Escribe tu correo electronico para recuperar la contrasena.", "error");
    courierElements.emailInput?.focus();
    return;
  }

  courierSetMessage(courierElements.authMessage, "RINCON COLOMBIANO PEDIDOS esta enviando el correo de recuperacion...");
  const redirectTo = window.location.href.split("#")[0];
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    courierSetMessage(courierElements.authMessage, courierFriendlyAuthError(error), "error");
    return;
  }
  courierSetMessage(
    courierElements.authMessage,
    "Correo enviado por RINCON COLOMBIANO PEDIDOS. Abre el enlace para crear una contrasena nueva.",
    "ok"
  );
}

async function courierResendVerificationEmail() {
  const client = courierEnsureClient();
  const email = courierInputValue(courierElements.emailInput);
  if (!client) {
    courierSetMessage(courierElements.authMessage, "Supabase no esta configurado o no cargo correctamente.", "error");
    return;
  }
  if (!email) {
    courierSetMessage(courierElements.authMessage, "Escribe tu correo electronico para reenviar la verificacion.", "error");
    courierElements.emailInput?.focus();
    return;
  }

  courierSetMessage(courierElements.authMessage, "RINCON COLOMBIANO PEDIDOS esta reenviando el correo de verificacion...");
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
    "Correo de verificacion reenviado por RINCON COLOMBIANO PEDIDOS. Revisa entrada, spam o promociones.",
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
    "RINCON COLOMBIANO PEDIDOS verifico el enlace. Escribe tu nueva contrasena.",
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
  const client = courierEnsureClient();
  const password = courierElements.newPasswordInput.value;
  if (!client) {
    courierSetMessage(courierElements.authMessage, "Supabase no esta configurado o no cargo correctamente.", "error");
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
  courierHidePasswordRecoveryForm("Contrasena actualizada. Ya puedes iniciar sesion en RINCON COLOMBIANO PEDIDOS.");
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
  };
}

async function courierSignOut() {
  if (!courierClient) return;
  await courierClient.auth.signOut();
  courierSetMessage(courierElements.authMessage, "Sesion cerrada.", "ok");
}

function courierToggleAvailability() {
  if (courierProfile?.status !== "approved") return;
  courierAvailable = !courierAvailable;
  courierRender();
}

function courierUrlLooksLikeRecovery() {
  return /type=recovery/i.test(window.location.hash) || /[?&](type=recovery|recovery=1)/i.test(window.location.search);
}

async function courierInitialize() {
  const client = courierEnsureClient();
  if (!client || courierAuthReady) {
    if (!client) courierSetMessage(courierElements.authMessage, "Configura Supabase para usar colaborador.", "error");
    return;
  }
  courierAuthReady = true;

  const { data } = await client.auth.getSession();
  courierUser = data.session?.user || null;
  if (courierUrlLooksLikeRecovery()) courierRecoveringPassword = true;
  courierRender();
  if (courierRecoveringPassword) courierShowPasswordRecoveryForm();
  if (courierUser) await courierLoadProfile();

  client.auth.onAuthStateChange(async (event, session) => {
    courierUser = session?.user || null;
    courierProfile = null;
    if (event === "PASSWORD_RECOVERY") {
      courierShowPasswordRecoveryForm();
      return;
    }
    courierRender();
    if (courierUser) await courierLoadProfile();
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
courierInitialize();
