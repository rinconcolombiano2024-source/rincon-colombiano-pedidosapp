const PLATFORM_ADMIN_DOCUMENT_BUCKET = "courier-documents";

const adminElements = {
  accountSummary: document.querySelector("#adminAccountSummary"),
  authFields: document.querySelector("#adminAuthFields"),
  emailInput: document.querySelector("#adminEmailInput"),
  passwordInput: document.querySelector("#adminPasswordInput"),
  signInButton: document.querySelector("#adminSignInButton"),
  magicLinkButton: document.querySelector("#adminMagicLinkButton"),
  resetPasswordButton: document.querySelector("#adminResetPasswordButton"),
  passwordRecoveryPanel: document.querySelector("#adminPasswordRecoveryPanel"),
  newPasswordInput: document.querySelector("#adminNewPasswordInput"),
  updatePasswordButton: document.querySelector("#adminUpdatePasswordButton"),
  cancelRecoveryButton: document.querySelector("#adminCancelRecoveryButton"),
  signOutButton: document.querySelector("#adminSignOutButton"),
  authMessage: document.querySelector("#adminAuthMessage"),
  refreshCouriersButton: document.querySelector("#adminRefreshCouriersButton"),
  courierList: document.querySelector("#adminCourierList"),
  installButton: document.querySelector("#adminInstallButton"),
};

let adminClient = null;
let adminUser = null;
let adminAuthReady = false;
let adminRecoveringPassword = false;
let adminInstallPrompt = null;

function adminSupabaseConfig() {
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

function adminConnectionMessage() {
  const config = adminSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return "La administracion en la nube aun no esta disponible.";
  }
  if (!window.supabase?.createClient) {
    return "No se pudo cargar la administracion. Revisa internet e intenta nuevamente.";
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
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4";
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
  const code = String(error?.code || error?.status || "");
  if (/invalid login credentials/i.test(message)) {
    return "Correo o contrasena incorrectos. Tambien puedes recuperar la contrasena.";
  }
  if (/email not confirmed/i.test(message)) return "Confirma el correo electronico antes de iniciar sesion.";
  if (/email address not authorized/i.test(message)) {
    return "No fue posible enviar el correo de recuperacion. Contacta al soporte de la plataforma.";
  }
  if (code === "429" || /rate limit|too many requests|over_email_send_rate_limit/i.test(message)) {
    return "Se alcanzo el limite temporal de correos. Espera unos minutos e intenta nuevamente.";
  }
  if (/redirect|not allowed|site url/i.test(message)) {
    return "La recuperacion no esta disponible desde esta direccion. Abre la app publicada e intenta nuevamente.";
  }
  if (/failed to fetch|network|fetch/i.test(message)) {
    return "No fue posible conectar con la administracion. Revisa internet e intenta nuevamente.";
  }
  if (/expired|invalid.*token|otp/i.test(message)) {
    return "El enlace de recuperacion vencio o ya fue utilizado. Solicita uno nuevo.";
  }
  return "No se pudo completar la accion. Intenta nuevamente o contacta al soporte de la plataforma.";
}

function adminStatusLabel(status) {
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  if (status === "suspended") return "Suspendido";
  if (status === "inactive") return "Inactivo";
  if (status === "draft") return "Borrador";
  return "Pendiente de revision";
}

function adminCourierRpcMessage(error, action = "load") {
  const code = String(error?.code || error?.status || "");
  const message = String(error?.message || "");
  if (code === "PGRST202" || /get_courier_review_queue|review_courier_profile|schema cache/i.test(message)) {
    return "La revision de colaboradores aun no esta disponible. Contacta al soporte de la plataforma.";
  }
  if (code === "42501" || /not authorized|permission denied/i.test(message)) {
    return "Esta cuenta no tiene permiso administrativo para revisar colaboradores.";
  }
  if (/courier profile not found/i.test(message)) {
    return "La solicitud del colaborador ya no existe. Actualiza la lista.";
  }
  if (/invalid courier status|courier user id is required/i.test(message)) {
    return "La solicitud contiene un estado no valido. Actualiza la lista e intenta nuevamente.";
  }
  return action === "review"
    ? "No se pudo actualizar el colaborador. Revisa la conexion e intenta nuevamente."
    : "No se pudo cargar la revision de colaboradores. Revisa la conexion e intenta nuevamente.";
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
  if (adminElements.accountSummary) {
    adminElements.accountSummary.textContent = adminUser
      ? "Sesion administrativa activa y verificada."
      : "Acceso privado para la cuenta administradora autorizada.";
  }
  if (adminElements.authFields) adminElements.authFields.hidden = Boolean(adminUser) && !adminRecoveringPassword;
  if (adminElements.signOutButton) adminElements.signOutButton.hidden = !adminUser;
  if (adminElements.emailInput?.closest("label")) adminElements.emailInput.closest("label").hidden = adminRecoveringPassword;
  if (adminElements.passwordInput?.closest("label")) adminElements.passwordInput.closest("label").hidden = adminRecoveringPassword;
  if (adminElements.signInButton) adminElements.signInButton.hidden = adminRecoveringPassword;
  if (adminElements.magicLinkButton) adminElements.magicLinkButton.hidden = adminRecoveringPassword;
  if (adminElements.resetPasswordButton) adminElements.resetPasswordButton.hidden = adminRecoveringPassword;
  if (adminElements.passwordRecoveryPanel) adminElements.passwordRecoveryPanel.hidden = !adminRecoveringPassword;
}

async function adminValidateAuthorizedSession(client, user) {
  if (!client || !user) return false;
  const { data, error } = await client.rpc("is_platform_owner");
  if (error) {
    console.warn("No se pudo validar el permiso administrativo.", {
      code: error.code || error.status || "",
      message: error.message || "",
    });
    return false;
  }
  return data === true;
}

function adminHttpsReturnUrl(parameter = "") {
  const returnUrl = new URL(window.location.href);
  returnUrl.hash = "";
  returnUrl.search = "";
  if (parameter) returnUrl.searchParams.set(parameter, "1");
  return /^https?:$/.test(returnUrl.protocol) ? returnUrl.toString() : "";
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
      const location = [row.country, row.region, row.city, row.postal_code].filter(Boolean).join(" / ") || "Ubicacion no indicada";
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
              <span>${adminEscapeHtml(row.phone || "Telefono no indicado")}</span>
              <span>Ubicacion: ${adminEscapeHtml(location)}</span>
              <span>Estado: ${adminEscapeHtml(adminStatusLabel(row.status))}</span>
              <span>Vehiculo: ${adminEscapeHtml(vehicle)}</span>
            </div>
            <strong>${adminEscapeHtml(row.created_at ? new Date(row.created_at).toLocaleDateString(
              { es: "es-ES", pl: "pl-PL", en: "en-GB" }[document.documentElement.lang] || "es-ES"
            ) : "")}</strong>
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
            ${row.status !== "approved" ? '<button type="button" data-action="approve">Aprobar para trabajar</button>' : ""}
            <button type="button" data-action="reject" ${row.status === "rejected" ? "disabled" : ""}>Rechazar</button>
            ${row.status === "approved" ? '<button type="button" data-action="suspend">Suspender</button>' : ""}
            ${["suspended", "inactive", "rejected"].includes(row.status) ? '<button type="button" data-action="reactivate">Reactivar</button>' : ""}
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
      adminCourierRpcMessage(error),
      "error"
    );
    if (adminElements.courierList) {
      adminElements.courierList.innerHTML = `<div class="customer-empty">${adminEscapeHtml(adminCourierRpcMessage(error))}</div>`;
    }
    return null;
  }

  adminSetMessage(adminElements.authMessage, "Colaboradores actualizados.", "ok");
  const rows = Array.isArray(data) ? data : [];
  adminRenderCourierList(rows);
  return rows;
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
  const actionLabels = {
    approved: "aprobar o reactivar para trabajar",
    rejected: "rechazar",
    suspended: "suspender",
    inactive: "desactivar",
  };
  const action = actionLabels[status] || "actualizar";
  if (!confirm(`Confirmas ${action} este colaborador?`)) return;

  adminSetMessage(adminElements.authMessage, "Actualizando colaborador...");
  const { error } = await client.rpc("review_courier_profile", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) {
    adminSetMessage(adminElements.authMessage, adminCourierRpcMessage(error, "review"), "error");
    return false;
  }

  const { data: verificationData, error: verificationError } = await client.rpc("get_courier_review_result", {
    p_user_id: userId,
  });
  let confirmed = Array.isArray(verificationData) ? verificationData[0] : verificationData;
  if (verificationError && (verificationError.code === "PGRST202" || /get_courier_review_result/i.test(verificationError.message || ""))) {
    const rows = await adminLoadCouriers();
    const fallback = rows?.find((row) => row.user_id === userId);
    confirmed = fallback ? {
      profile_status: fallback.status,
      role_status: status === "approved" ? "active" : status === "rejected" ? "revoked" : status,
    } : null;
  } else {
    await adminLoadCouriers();
  }

  const expectedRoleStatus = status === "approved" ? "active" : status === "rejected" ? "revoked" : status;
  if (
    (verificationError && !confirmed) ||
    !confirmed ||
    confirmed.profile_status !== status ||
    confirmed.role_status !== expectedRoleStatus
  ) {
    adminSetMessage(
      adminElements.authMessage,
      "No se pudo confirmar el cambio del colaborador. Actualiza la lista e intenta nuevamente.",
      "error"
    );
    return false;
  }
  adminSetMessage(
    adminElements.authMessage,
    status === "approved"
      ? "Colaborador aprobado y confirmado. Ya puede trabajar."
      : status === "suspended"
        ? "Colaborador suspendido y desconectado."
        : status === "inactive"
          ? "Colaborador desactivado y desconectado."
          : "Solicitud rechazada y confirmada.",
    "ok"
  );
  return true;
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
  adminSetMessage(adminElements.authMessage, "Iniciando sesion...");
  if (adminElements.signInButton) adminElements.signInButton.disabled = true;
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(error), "error");
      return;
    }

    const isAuthorized = await adminValidateAuthorizedSession(client, data.session?.user);
    if (!isAuthorized) {
      await client.auth.signOut();
      adminUser = null;
      adminSetMessage(
        adminElements.authMessage,
        "La cuenta no tiene permiso administrativo activo. Revisa la configuracion de acceso de la plataforma.",
        "error"
      );
      adminRender();
      return;
    }

    adminUser = data.session?.user || null;
    adminElements.passwordInput.value = "";
    adminSetMessage(adminElements.authMessage, "Sesion administrativa iniciada correctamente.", "ok");
    adminRender();
    await adminLoadCouriers();
  } catch (error) {
    adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(error), "error");
  } finally {
    if (adminElements.signInButton) adminElements.signInButton.disabled = false;
  }
}

async function adminSendMagicLink() {
  if (!adminEnsureClient()) await adminLoadSupabaseLibrary();
  const client = adminEnsureClient();
  const email = adminInputValue(adminElements.emailInput);
  if (!client) {
    adminSetMessage(adminElements.authMessage, adminConnectionMessage(), "error");
    return;
  }
  if (!email) {
    adminSetMessage(adminElements.authMessage, "Escribe el correo de la cuenta administradora.", "error");
    return;
  }

  const returnUrl = adminHttpsReturnUrl("access");
  if (!returnUrl) {
    adminSetMessage(
      adminElements.authMessage,
      "El enlace seguro se solicita desde la app publicada o instalada, no desde un archivo local.",
      "error"
    );
    return;
  }

  if (adminElements.magicLinkButton) adminElements.magicLinkButton.disabled = true;
  adminSetMessage(adminElements.authMessage, "Solicitando enlace seguro...");
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: returnUrl,
      },
    });
    if (error) throw error;
    adminSetMessage(
      adminElements.authMessage,
      "Si la cuenta existe y esta autorizada, recibiras un enlace de acceso de un solo uso. Revisa tambien spam.",
      "ok"
    );
  } catch (error) {
    adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(error), "error");
  } finally {
    if (adminElements.magicLinkButton) adminElements.magicLinkButton.disabled = false;
  }
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
  const redirectUrl = adminHttpsReturnUrl("recovery");
  if (!redirectUrl) {
    adminSetMessage(
      adminElements.authMessage,
      "La recuperacion se solicita desde la app publicada o instalada, no desde un archivo local.",
      "error"
    );
    return;
  }

  if (adminElements.resetPasswordButton) adminElements.resetPasswordButton.disabled = true;
  adminSetMessage(adminElements.authMessage, "Solicitando correo de recuperacion...");
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    if (error) {
      console.warn("No se pudo enviar recuperacion administrativa.", {
        code: error.code || error.status || "",
        message: error.message || "",
      });
      adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(error), "error");
      return;
    }
    adminSetMessage(
      adminElements.authMessage,
      "La solicitud fue aceptada. Revisa entrada, spam y promociones. El envio puede tardar algunos minutos.",
      "ok"
    );
  } catch (error) {
    adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(error), "error");
  } finally {
    if (adminElements.resetPasswordButton) adminElements.resetPasswordButton.disabled = false;
  }
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

  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    adminSetMessage(adminElements.authMessage, adminFriendlyAuthError(sessionError), "error");
  }
  adminUser = data.session?.user || null;
  if (adminUser && !(await adminValidateAuthorizedSession(client, adminUser))) {
    await client.auth.signOut();
    adminUser = null;
    adminSetMessage(
      adminElements.authMessage,
      "La sesion no tiene permiso para administrar la plataforma.",
      "error"
    );
  }
  adminRender();
  if (adminUser) await adminLoadCouriers();

  const recoveryInUrl =
    /[?&](type=recovery|recovery=1)/i.test(window.location.search) || /type=recovery/i.test(window.location.hash);
  const urlAuthError =
    new URLSearchParams(window.location.search).get("error_description") ||
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
  if (urlAuthError) {
    adminSetMessage(adminElements.authMessage, adminFriendlyAuthError({ message: urlAuthError }), "error");
  } else if (recoveryInUrl && adminUser) {
    adminShowPasswordRecoveryForm();
  } else if (recoveryInUrl && !adminUser) {
    adminSetMessage(
      adminElements.authMessage,
      "El enlace de recuperacion no contiene una sesion valida. Solicita un enlace nuevo.",
      "error"
    );
  }

  client.auth.onAuthStateChange(async (event, session) => {
    adminUser = session?.user || null;
    if (event === "PASSWORD_RECOVERY") {
      if (await adminValidateAuthorizedSession(client, adminUser)) {
        adminShowPasswordRecoveryForm();
      } else {
        await client.auth.signOut();
        adminUser = null;
        adminSetMessage(adminElements.authMessage, "El enlace no tiene permiso administrativo.", "error");
        adminRender();
      }
      return;
    }
    if (adminUser && !(await adminValidateAuthorizedSession(client, adminUser))) {
      await client.auth.signOut();
      adminUser = null;
      adminSetMessage(adminElements.authMessage, "La cuenta no tiene permiso administrativo.", "error");
    }
    adminRender();
    if (adminUser) await adminLoadCouriers();
    if (!adminUser && adminElements.courierList) {
      adminElements.courierList.innerHTML = `<div class="customer-empty">Inicia sesion para cargar colaboradores.</div>`;
    }
  });
}

async function adminInstallPanel() {
  if (adminInstallPrompt) {
    adminInstallPrompt.prompt();
    await adminInstallPrompt.userChoice;
    adminInstallPrompt = null;
    return;
  }
  if (!window.location.protocol.startsWith("http")) {
    alert("Abre el panel publicado en Vercel para instalarlo como aplicacion.");
    return;
  }
  alert("En el menu del navegador selecciona Instalar aplicacion o Agregar a pantalla de inicio.");
}

adminElements.signInButton?.addEventListener("click", adminSignIn);
adminElements.magicLinkButton?.addEventListener("click", adminSendMagicLink);
adminElements.resetPasswordButton?.addEventListener("click", adminSendPasswordResetEmail);
adminElements.updatePasswordButton?.addEventListener("click", adminUpdateRecoveredPassword);
adminElements.cancelRecoveryButton?.addEventListener("click", () => adminHidePasswordRecoveryForm());
adminElements.signOutButton?.addEventListener("click", adminSignOut);
adminElements.refreshCouriersButton?.addEventListener("click", adminLoadCouriers);
adminElements.installButton?.addEventListener("click", adminInstallPanel);
adminElements.courierList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || button.disabled) return;
  if (button.dataset.action === "open-doc") {
    await adminOpenCourierDocument(button.dataset.doc);
    return;
  }

  const card = event.target.closest(".platform-courier-card");
  if (!card) return;
  button.disabled = true;
  try {
    if (button.dataset.action === "approve") await adminReviewCourier(card.dataset.courierId, "approved");
    if (button.dataset.action === "reject") await adminReviewCourier(card.dataset.courierId, "rejected");
    if (button.dataset.action === "suspend") await adminReviewCourier(card.dataset.courierId, "suspended");
    if (button.dataset.action === "reactivate") await adminReviewCourier(card.dataset.courierId, "approved");
  } finally {
    if (button.isConnected) button.disabled = false;
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  adminInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  adminInstallPrompt = null;
  adminSetMessage(adminElements.authMessage, "Panel administrativo instalado.", "ok");
});

if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

adminInitialize();
