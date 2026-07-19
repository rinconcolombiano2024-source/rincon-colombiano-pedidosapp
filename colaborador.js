const COURIER_PLATFORM_SCOPE_ID = "00000000-0000-0000-0000-000000000000";

const courierElements = {
  accountSummary: document.querySelector("#courierAccountSummary"),
  authFields: document.querySelector("#courierAuthFields"),
  emailInput: document.querySelector("#courierEmailInput"),
  passwordInput: document.querySelector("#courierPasswordInput"),
  signInButton: document.querySelector("#courierSignInButton"),
  signUpButton: document.querySelector("#courierSignUpButton"),
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
  vehicleTypeInput: document.querySelector("#courierVehicleTypeInput"),
  vehiclePlateInput: document.querySelector("#courierVehiclePlateInput"),
  driverLicenseInput: document.querySelector("#courierDriverLicenseInput"),
  insuranceInput: document.querySelector("#courierInsuranceInput"),
  bankInput: document.querySelector("#courierBankInput"),
  availabilityInput: document.querySelector("#courierAvailabilityInput"),
  photoUrlInput: document.querySelector("#courierPhotoUrlInput"),
  selfieUrlInput: document.querySelector("#courierSelfieUrlInput"),
  workPermitUrlInput: document.querySelector("#courierWorkPermitUrlInput"),
  termsInput: document.querySelector("#courierTermsInput"),
  saveProfileButton: document.querySelector("#courierSaveProfileButton"),
  profileMessage: document.querySelector("#courierProfileMessage"),
  dashboard: document.querySelector("#courierDashboard"),
  dashboardText: document.querySelector("#courierDashboardText"),
  availabilityButton: document.querySelector("#courierAvailabilityButton"),
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

function courierSetMessage(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = !message;
}

function courierFriendlyAuthError(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "Correo o contrasena incorrectos.";
  if (/email not confirmed/i.test(message)) return "Confirma tu correo electronico antes de iniciar sesion.";
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
    photo_url: courierInputValue(courierElements.photoUrlInput),
    verification_selfie_url: courierInputValue(courierElements.selfieUrlInput),
    work_permit_url: courierInputValue(courierElements.workPermitUrlInput),
    vehicle_type: courierInputValue(courierElements.vehicleTypeInput),
    vehicle_plate: courierInputValue(courierElements.vehiclePlateInput),
    driver_license: courierInputValue(courierElements.driverLicenseInput),
    insurance_info: courierInputValue(courierElements.insuranceInput),
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
    vehicle_type: metadata.vehicle_type || "",
    vehicle_plate: metadata.vehicle_plate || "",
    driver_license: metadata.driver_license || "",
    insurance_info: metadata.insurance_info || "",
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
  courierElements.vehicleTypeInput.value = profile.vehicle_type || "";
  courierElements.vehiclePlateInput.value = profile.vehicle_plate || "";
  courierElements.driverLicenseInput.value = profile.driver_license || "";
  courierElements.insuranceInput.value = profile.insurance_info || "";
  courierElements.bankInput.value = profile.bank_account || "";
  courierElements.availabilityInput.value = profile.availability?.text || "";
  courierElements.photoUrlInput.value = profile.photo_url || "";
  courierElements.selfieUrlInput.value = profile.verification_selfie_url || "";
  courierElements.workPermitUrlInput.value = profile.work_permit_url || "";
  courierElements.termsInput.checked = Boolean(profile.terms_accepted_at);
}

function courierRender() {
  const email = courierUser?.email || "";
  const status = courierProfile?.status || "draft";
  const statusLabel = COURIER_STATUS_LABELS[status] || "Sin enviar";

  courierElements.accountSummary.textContent = courierUser
    ? `Sesion activa: ${email}`
    : "Inicia sesion o crea una cuenta para enviar tu solicitud.";
  courierElements.authFields.hidden = Boolean(courierUser);
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
    courierSetMessage(courierElements.profileMessage, "Solicitud guardada. Queda pendiente de revision.", "ok");
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
    "Cuenta creada. Revisa el correo para confirmar y luego inicia sesion como colaborador.",
    "ok"
  );
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
    vehicle_type: courierInputValue(courierElements.vehicleTypeInput),
    vehicle_plate: courierInputValue(courierElements.vehiclePlateInput),
    driver_license: courierInputValue(courierElements.driverLicenseInput),
    insurance_info: courierInputValue(courierElements.insuranceInput),
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

async function courierInitialize() {
  const client = courierEnsureClient();
  if (!client || courierAuthReady) {
    if (!client) courierSetMessage(courierElements.authMessage, "Configura Supabase para usar colaborador.", "error");
    return;
  }
  courierAuthReady = true;

  const { data } = await client.auth.getSession();
  courierUser = data.session?.user || null;
  courierRender();
  if (courierUser) await courierLoadProfile();

  client.auth.onAuthStateChange(async (_event, session) => {
    courierUser = session?.user || null;
    courierProfile = null;
    courierRender();
    if (courierUser) await courierLoadProfile();
  });
}

courierElements.signInButton.addEventListener("click", courierSignIn);
courierElements.signUpButton.addEventListener("click", courierSignUp);
courierElements.signOutButton.addEventListener("click", courierSignOut);
courierElements.saveProfileButton.addEventListener("click", courierSaveProfile);
courierElements.availabilityButton.addEventListener("click", courierToggleAvailability);

courierInitialize();
