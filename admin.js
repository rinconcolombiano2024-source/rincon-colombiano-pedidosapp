const PLATFORM_ADMIN_DOCUMENT_BUCKET = "courier-documents";

const adminElements = {
  accountSummary: document.querySelector("#adminAccountSummary"),
  authFields: document.querySelector("#adminAuthFields"),
  emailInput: document.querySelector("#adminEmailInput"),
  passwordInput: document.querySelector("#adminPasswordInput"),
  signInButton: document.querySelector("#adminSignInButton"),
  signOutButton: document.querySelector("#adminSignOutButton"),
  authMessage: document.querySelector("#adminAuthMessage"),
  refreshCouriersButton: document.querySelector("#adminRefreshCouriersButton"),
  courierList: document.querySelector("#adminCourierList"),
};

let adminClient = null;
let adminUser = null;
let adminAuthReady = false;

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

function adminEnsureClient() {
  if (adminClient) return adminClient;
  const config = adminSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
  adminClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
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
      ? `Sesion activa: ${email}.`
      : "Inicia sesion con una cuenta autorizada como administracion de plataforma.";
  }
  if (adminElements.authFields) adminElements.authFields.hidden = Boolean(adminUser);
  if (adminElements.signOutButton) adminElements.signOutButton.hidden = !adminUser;
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
      "No se pudo cargar. Ejecuta la migracion v60 y confirma que tu cuenta tenga rol platform_admin.",
      "error"
    );
    if (adminElements.courierList) {
      adminElements.courierList.innerHTML = `<div class="customer-empty">Sin permiso o migracion pendiente.</div>`;
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
  const client = adminEnsureClient();
  const email = adminInputValue(adminElements.emailInput);
  const password = adminElements.passwordInput.value;
  if (!client) {
    adminSetMessage(adminElements.authMessage, "Supabase no esta configurado.", "error");
    return;
  }
  if (!email || !password) {
    adminSetMessage(adminElements.authMessage, "Escribe correo y contrasena.", "error");
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

async function adminSignOut() {
  const client = adminEnsureClient();
  if (!client) return;
  await client.auth.signOut();
  adminSetMessage(adminElements.authMessage, "Sesion cerrada.", "ok");
}

async function adminInitialize() {
  const client = adminEnsureClient();
  if (!client || adminAuthReady) {
    if (!client) adminSetMessage(adminElements.authMessage, "Configura Supabase para usar administracion.", "error");
    return;
  }
  adminAuthReady = true;

  const { data } = await client.auth.getSession();
  adminUser = data.session?.user || null;
  adminRender();
  if (adminUser) await adminLoadCouriers();

  client.auth.onAuthStateChange(async (_event, session) => {
    adminUser = session?.user || null;
    adminRender();
    if (adminUser) await adminLoadCouriers();
    if (!adminUser && adminElements.courierList) {
      adminElements.courierList.innerHTML = `<div class="customer-empty">Inicia sesion para cargar colaboradores.</div>`;
    }
  });
}

adminElements.signInButton?.addEventListener("click", adminSignIn);
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
