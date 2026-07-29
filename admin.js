const PLATFORM_ADMIN_DOCUMENT_BUCKET = "courier-documents";
const PLATFORM_OWNER_NAME = "Jhon Jarolt Mendez";
const PLATFORM_OWNER_EMAIL = "pedidosapprinconcolombiano@gmail.com";

const adminElements = {
  accountSummary: document.querySelector("#adminAccountSummary"),
  authFields: document.querySelector("#adminAuthFields"),
  emailInput: document.querySelector("#adminEmailInput"),
  passwordInput: document.querySelector("#adminPasswordInput"),
  signInButton: document.querySelector("#adminSignInButton"),
  resetPasswordButton: document.querySelector("#adminResetPasswordButton"),
  passwordRecoveryPanel: document.querySelector("#adminPasswordRecoveryPanel"),
  newPasswordInput: document.querySelector("#adminNewPasswordInput"),
  updatePasswordButton: document.querySelector("#adminUpdatePasswordButton"),
  cancelRecoveryButton: document.querySelector("#adminCancelRecoveryButton"),
  signOutButton: document.querySelector("#adminSignOutButton"),
  authMessage: document.querySelector("#adminAuthMessage"),
  refreshCouriersButton: document.querySelector("#adminRefreshCouriersButton"),
  courierList: document.querySelector("#adminCourierList"),
};

let adminClient = null;
let adminUser = null;
let adminAuthReady = false;
let adminRecoveringPassword = false;

function adminSupabaseConfig() {
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

function adminConnectionMessage() {
  const config = adminSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return "Falta configurar la conexion de Supabase para usar la administracion.";
  }
  if (!window.supabase?.createClient) {
    return "No se pudo cargar la conexion de Supabase. Revisa internet, actualiza la pagina o prueba nuevamente.";
  }
  return "No se pudo iniciar la conexion de administracion.";
}

function adminLoadSupabaseLibrary() {
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

function adminEnsureClient() {
  if (adminClient) return adminClient;
  const config = adminSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
  adminClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "rc_ordera_platform_admin_auth" },
  });
  return adminClient;
}

function adminInputValue(input) {
  return String(input?.value || "").trim();
}

function adminNormalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function adminIsPlatformOwnerEmail(email) {
  return adminNormalizeEmail(email) === PLATFORM_OWNER_EMAIL;
}

function adminSetMessage(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.hidden = !message;
}

function adminEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function adminFriendlyAuthError(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) return "Correo o contrasena incorrectos.";
  if (/email not confirmed/i.test(message)) return "Confirma el correo electronico antes de iniciar sesion.";
  return message || "No se pudo completar la accion.";
}

function adminStatusLabel(status) {
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  if (status === "suspended") return "Suspendido";
  if (status === "inactive") return "Inactivo";
  if (status === "draft") return "Borrador";
  return "Pendiente de revision";
}

function adminCourierDocumentRef(value) {
  const ref = String(value || "").trim();
  if (!ref) return "";
  if (ref.startsWith(`storage:${PLATFORM_ADMIN_DOCUMENT_BUCKET}/`)) {
    return ref.replace(`storage:${PLATFORM_ADMIN_DOCUMENT_BUCKET}/`, "");
  }
  if (ref.startsWith(`${PLATFORM_ADMIN_DOCUMENT_BUCKET}/`)) return ref.replace(`${PLATFORM_ADMIN_DOCUMENT_BUCKET}/`, "");
  return ref;
}

function adminCourierDocumentButton(label, value) {
  const ref = adminCourierDocumentRef(value);
  if (!ref) return `<span>${adminEscapeHtml(label)}: no subido en la app</span>`;
  if (/^https?:\/\//i.test(ref)) {
    return `<a href="${adminEscapeHtml(ref)}" target="_blank" rel="noopener">${adminEscapeHtml(label)}</a>`;
  }
  return `<button type="button" data-action="open-doc" data-doc="${adminEscapeHtml(ref)}">${adminEscapeHtml(label)}</button>`;
}

function adminCourierMissingDocuments(row) {
  const missing = [];
  if (!adminCourierDocumentRef(row.identity_document_url)) missing.push("documento");
  if (!adminCourierDocumentRef(row.photo_url)) missing.push("foto");
  if (!adminCourierDocumentRef(row.verification_selfie_url)) missing.push("selfie");
  if (row.vehicle_type === "motocicleta" || row.vehicle_type === "automovil") {
    if (!adminCourierDocumentRef(row.driver_license_url)) missing.push("licencia");
    if (!adminCourierDocumentRef(row.insurance_url)) missing.push("seguro");
  }
  return missing;
}

function adminRender() {
  const email = adminUser?.email || "";
  if (adminElements.accountSummary) {
    adminElements.accountSummary.textContent = adminUser
      ? `Sesion activa: ${email}. Administrador autorizado: ${PLATFORM_OWNER_NAME}.`
      : `Solo ${PLATFORM_OWNER_NAME} puede administrar la plataforma con ${PLATFORM_OWNER_EMAIL}.`;
  }
  if (adminElements.authFields) adminElements.authFields.hidden = Boolean(adminUser) && !adminRecoveringPassword;
  if (adminElements.signOutButton) adminElements.signOutButton.hidden = !adminUser;
  if (adminElements.emailInput?.closest("label")) adminElements.emailInput.closest("label").hidden = adminRecoveringPassword;
  if (adminElements.passwordInput?.closest("label")) adminElements.passwordInput.closest("label").hidden = adminRecoveringPassword;
  if (adminElements.signInButton) adminElements.signInButton.hidden = adminRecoveringPassword;
  if (adminElements.resetPasswordButton) adminElements.resetPasswordButton.hidden = adminRecoveringPassword;
  if (adminElements.passwordRecoveryPanel) adminElements.passwordRecoveryPanel.hidden = !adminRecoveringPassword;
}

function adminRenderCourierList(rows = []) {
  if (!adminElements.courierList) return;
  if (!rows.length) {
    adminElements.courierList.innerHTML = `<div class="customer-empty">No hay colaboradores registrados.</div>`;
    return;
  }

  adminElements.courierList.innerHTML = rows
    .map((row) => {
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ") || "Colaborador sin nombre";
      const vehicle = [row.vehicle_type, row.vehicle_plate].filter(Boolean).join(" / ") || "Vehiculo no indicado";
      const missingDocs = adminCourierMissingDocuments(row);
      const docs = [
        adminCourierDocumentButton("Documento", row.identity_document_url),
        adminCourierDocumentButton("Foto", row.photo_url),
        adminCourierDocumentButton("Selfie", row.verification_selfie_url),
        adminCourierDocumentButton("Licencia", row.driver_license_url),
        adminCourierDocumentButton("Seguro", row.insurance_url),
        adminCourierDocumentButton("Permiso trabajo", row.work_permit_url),
      ].join("");

      return `
        <article class="client-order-card platform-courier-card" data-courier-id="${adminEscapeHtml(row.user_id)}">
          <div class="client-order-head">
            <div>
              <strong>${adminEscapeHtml(fullName)}</strong>
              <span>${adminEscapeHtml(row.email || "Correo no disponible")}</span>
              <span>${adminEscapeHtml(row.phone || "Telefono no indicado")} / ${adminEscapeHtml(row.city || "")}</span>
              <span>Estado: ${adminEscapeHtml(adminStatusLabel(row.status))}</span>
              <span>Vehiculo: ${adminEscapeHtml(vehicle)}</span>
            </div>
            <strong>${adminEscapeHtml(row.created_at ? new Date(row.created_at).toLocaleDateString("es-US") : "")}</strong>
          </div>
          <p class="client-order-note">Documento escrito: ${adminEscapeHtml(row.identity_document || "No indicado")}</p>
          <p class="client-order-note">Licencia escrita: ${adminEscapeHtml(row.driver_license || "No aplica / no indicada")}</p>
          <p class="client-order-note">Seguro escrito: ${adminEscapeHtml(row.insurance_info || "No aplica / no indicado")}</p>
          <p class="client-order-note">${
            missingDocs.length
              ? `Archivos no subidos en la app: ${adminEscapeHtml(missingDocs.join(", "))}. Si llegaron al correo, puedes aprobar manualmente.`
              : "Archivos minimos subidos en la app."
          }</p>
          <div class="courier-documents">${docs}</div>
          <div class="client-order-actions">
            <button type="button" data-action="approve" ${row.status === "approved" ? "disabled" : ""}>Aprobar para trabajar</button>
            <button type="button" data-action="reject" ${row.status === "rejected" ? "disabled" : ""}>Rechazar</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function adminLoadCouriers() {
  const client = adminEnsureClient();
  if (!client || !adminUser) {
    if (adminElements.courierList) {
      adminElements.courierList.innerHTML = `<div class="customer-empty">Inicia sesion para cargar colaboradores.</div>`;
    }
    return;
  }

  adminSetMessage(adminElements.authMessage, "Cargando colaboradores...");
  if (adminElements.courierList) {
    adminElements.courierList.innerHTML = `<div class="customer-empty">Cargando colaboradores...</div>`;
  }

  const { data, error } = await client.rpc("get_courier_review_queue");
  if (error) {
    adminSetMessage(
      adminElements.authMessage,
      "No se pudo cargar la revision de colaboradores. Confirma que esta cuenta sea la administradora autorizada y que la nube tenga los permisos activos.",
      "error"
    );
    if (adminElements.courierList) {
      adminElements.courierList.innerHTML = `<div class="customer-empty">Sin permiso para ver colaboradores o configuracion pendiente en la nube.</div>`;
    }
    return;
  }

  adminSetMessage(adminElements.authMessage, "Colaboradores actualizados.", "ok");
  adminRenderCourierList(Array.isArray(data) ? data : []);
}

async function adminOpenCourierDocument(ref) {
  const docRef = adminCourierDocumentRef(ref);
  if (!docRef) return;
  if (/^https?:\/\//i.test(docRef)) {
    window.open(docRef, "_blank", "noopener");
    return;
  }
  const client = adminEnsureClient();
  if (!client) return;
  const { data, error } = await client.storage.from(PLATFORM_ADMIN_DOCUMENT_BUCKET).createSignedUrl(docRef, 60 * 10);
  if (error || !data?.signedUrl) {
    adminSetMessage(adminElements.authMessage, "No se pudo abrir el archivo. Revisa permisos de Storage.", "error");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener");
}

async function adminReviewCourier(userId, status) {
  const client = adminEnsureClient();
  if (!client || !adminUser) return;
  const action = status === "approved" ? "aprobar para trabajar" : "rechazar";
  if (!confirm(`Confirmas ${action} este colaborador?`)) return;

  adminSetMessage(adminElements.authMessage, "Actualizando colaborador...");
  const { error } = await client.rpc("review_courier_profile", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) {
    adminSetMessage(adminElements.authMessage, error.message || "No se pudo actualizar el colaborador.", "error");
    return;
  }
  adminSetMessage(
    adminElements.authMessage,
    status === "approved" ? "Colaborador aprobado para trabajar." : "Solicitud rechazada.",
    "ok"
  );
  await adminLoadCouriers();
}

async function adminSignIn() {
  if (!adminEnsureClient()) await adminLoadSupabaseLibrary();
  const client = adminEnsureClient();
  const email = adminInputValue(adminElements.emailInput);
  const password = adminElements.passwordInput.value;
  if (!client) {
    adminSetMessage(adminElements.authMessage, adminConnectionMessage(), "error");
    return;
  }
  if (!email || !password) {
    adminSetMessage(adminElements.authMessage, "Escribe correo y contrasena.", "error");
    return;
  }
  if (!adminIsPlatformOwnerEmail(email)) {
    adminSetMessage(
      adminElements.authMessage,
      `Acceso no autorizado. La administracion de plataforma es solo para ${PLATFORM_OWNER_NAME}: ${PLATFORM_OWNER_EMAIL}.`,
      "error"
    );
    return;
  }

  adminSetMessage(adminElements.authMessage, "Iniciando sesion...");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(error), "error");
    return;
  }
  adminElements.passwordInput.value = "";
  adminSetMessage(adminElements.authMessage, "Sesion iniciada.", "ok");
}

async function adminSendPasswordResetEmail() {
  if (!adminEnsureClient()) await adminLoadSupabaseLibrary();
  const client = adminEnsureClient();
  const email = adminInputValue(adminElements.emailInput);
  if (!client) {
    adminSetMessage(adminElements.authMessage, adminConnectionMessage(), "error");
    return;
  }
  if (!email) {
    adminSetMessage(adminElements.authMessage, "Escribe el correo autorizado para recuperar la contrasena.", "error");
    return;
  }

  const genericMessage = "Si la cuenta existe y esta autorizada, recibiras las instrucciones de recuperacion.";
  if (!adminIsPlatformOwnerEmail(email)) {
    adminSetMessage(adminElements.authMessage, genericMessage, "ok");
    return;
  }

  const redirectTo = `${window.location.href.split("#")[0].split("?")[0]}?recovery=1`;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    console.warn("No se pudo enviar recuperacion administrativa.", error);
  }
  adminSetMessage(adminElements.authMessage, genericMessage, "ok");
}

function adminShowPasswordRecoveryForm() {
  adminRecoveringPassword = true;
  adminRender();
  adminSetMessage(adminElements.authMessage, "RC ORDERA verifico el enlace. Escribe tu nueva contrasena.", "ok");
  window.setTimeout(() => adminElements.newPasswordInput?.focus(), 50);
}

function adminHidePasswordRecoveryForm(message = "") {
  adminRecoveringPassword = false;
  if (adminElements.newPasswordInput) adminElements.newPasswordInput.value = "";
  adminRender();
  if (message) adminSetMessage(adminElements.authMessage, message, "ok");
}

async function adminUpdateRecoveredPassword() {
  if (!adminEnsureClient()) await adminLoadSupabaseLibrary();
  const client = adminEnsureClient();
  const password = adminElements.newPasswordInput?.value || "";
  if (!client) {
    adminSetMessage(adminElements.authMessage, adminConnectionMessage(), "error");
    return;
  }
  if (password.length < 6) {
    adminSetMessage(adminElements.authMessage, "La nueva contrasena debe tener minimo 6 caracteres.", "error");
    adminElements.newPasswordInput?.focus();
    return;
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(error), "error");
    return;
  }
  adminHidePasswordRecoveryForm("Contrasena actualizada. Ya puedes iniciar sesion en RC ORDERA.");
}

async function adminSignOut() {
  const client = adminEnsureClient();
  if (!client) return;
  await client.auth.signOut();
  adminSetMessage(adminElements.authMessage, "Sesion cerrada.", "ok");
}

async function adminInitialize() {
  if (adminAuthReady) return;
  const config = adminSupabaseConfig();
  if (!config.url || !config.anonKey) {
    adminSetMessage(adminElements.authMessage, adminConnectionMessage(), "error");
    return;
  }
  if (!window.supabase?.createClient && !(await adminLoadSupabaseLibrary())) {
    adminSetMessage(adminElements.authMessage, adminConnectionMessage(), "error");
    return;
  }
  const client = adminEnsureClient();
  if (!client) {
    adminSetMessage(adminElements.authMessage, adminConnectionMessage(), "error");
    return;
  }
  adminAuthReady = true;

  const { data } = await client.auth.getSession();
  adminUser = data.session?.user || null;
  if (adminUser && !adminIsPlatformOwnerEmail(adminUser.email)) {
    await client.auth.signOut();
    adminUser = null;
    adminSetMessage(
      adminElements.authMessage,
      `Sesion cerrada. La administracion de plataforma es solo para ${PLATFORM_OWNER_NAME}: ${PLATFORM_OWNER_EMAIL}.`,
      "error"
    );
  }
  adminRender();
  if (adminUser) await adminLoadCouriers();

  if (/[?&](type=recovery|recovery=1)/i.test(window.location.search) || /type=recovery/i.test(window.location.hash)) {
    adminShowPasswordRecoveryForm();
  }

  client.auth.onAuthStateChange(async (event, session) => {
    adminUser = session?.user || null;
    if (event === "PASSWORD_RECOVERY") {
      adminShowPasswordRecoveryForm();
      return;
    }
    if (adminUser && !adminIsPlatformOwnerEmail(adminUser.email)) {
      await client.auth.signOut();
      adminUser = null;
      adminSetMessage(
        adminElements.authMessage,
        `Acceso no autorizado. Usa ${PLATFORM_OWNER_EMAIL}.`,
        "error"
      );
    }
    adminRender();
    if (adminUser) await adminLoadCouriers();
    if (!adminUser && adminElements.courierList) {
      adminElements.courierList.innerHTML = `<div class="customer-empty">Inicia sesion para cargar colaboradores.</div>`;
    }
  });
}

adminElements.signInButton?.addEventListener("click", adminSignIn);
adminElements.resetPasswordButton?.addEventListener("click", adminSendPasswordResetEmail);
adminElements.updatePasswordButton?.addEventListener("click", adminUpdateRecoveredPassword);
adminElements.cancelRecoveryButton?.addEventListener("click", () => adminHidePasswordRecoveryForm());
adminElements.signOutButton?.addEventListener("click", adminSignOut);
adminElements.refreshCouriersButton?.addEventListener("click", adminLoadCouriers);
adminElements.courierList?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "open-doc") {
    adminOpenCourierDocument(button.dataset.doc);
    return;
  }

  const card = event.target.closest(".platform-courier-card");
  if (!card) return;
  if (button.dataset.action === "approve") adminReviewCourier(card.dataset.courierId, "approved");
  if (button.dataset.action === "reject") adminReviewCourier(card.dataset.courierId, "rejected");
});

adminInitialize();
