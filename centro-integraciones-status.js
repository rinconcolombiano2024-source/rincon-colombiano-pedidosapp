
"use strict";

/**
 * RC ORDERA — Integration Dashboard Status V1
 *
 * Solo lectura.
 * Reutiliza la sesión de Supabase.
 * Una solicitud por clic.
 * Sin polling, cron ni temporizadores.
 * No activa operaciones fiscales,
 * pedidos externos ni movimientos de dinero.
 */

(() => {
  const config = window.RC_ORDERA_SUPABASE;

  const fiscalPanel =
    document.getElementById("panel-fiscal");

  const deliveryPanel =
    document.getElementById("panel-delivery");

  if (!fiscalPanel || !deliveryPanel) {
    return;
  }

  const controls = document.createElement("section");
  controls.setAttribute(
    "aria-label",
    "Diagnóstico de integraciones"
  );

  controls.style.cssText = [
    "margin:0 0 20px",
    "padding:16px",
    "border:1px solid #35534a",
    "border-radius:14px",
    "background:#19322b"
  ].join(";");

  const heading = document.createElement("h3");
  heading.textContent = "Diagnóstico del sistema";

  const message = document.createElement("p");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.style.margin = "12px 0";
  message.textContent =
    "Consulta manual. No se realizan conexiones automáticas.";

  const refreshButton =
    document.createElement("button");

  refreshButton.type = "button";
  refreshButton.className = "action";
  refreshButton.textContent = "Consultar estado";

  const results = document.createElement("div");
  results.style.marginTop = "14px";

  controls.append(
    heading,
    message,
    refreshButton,
    results
  );

  fiscalPanel.prepend(controls);

  function addResult(label, value) {
    const row = document.createElement("p");
    row.style.margin = "8px 0";

    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;

    const text = document.createTextNode(
      String(value)
    );

    row.append(strong, text);
    results.append(row);
  }

  function validCount(value) {
    return Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  }

  async function loadStatus() {
    if (refreshButton.disabled) return;

    refreshButton.disabled = true;
    results.replaceChildren();

    message.textContent =
      "Consultando información del servidor...";

    try {
      if (
        !config ||
        typeof config.url !== "string" ||
        typeof config.anonKey !== "string" ||
        !window.supabase?.createClient
      ) {
        throw new Error("CLIENT_NOT_CONFIGURED");
      }

      const projectUrl = new URL(config.url);

      if (
        projectUrl.protocol !== "https:" ||
        !projectUrl.hostname.endsWith(
          ".supabase.co"
        )
      ) {
        throw new Error("INVALID_PROJECT_URL");
      }

      const client = window.supabase.createClient(
        config.url,
        config.anonKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        }
      );

      const {
        data: sessionData,
        error: sessionError
      } = await client.auth.getSession();

      const token =
        sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error("LOGIN_REQUIRED");
      }

      const endpoint = new URL(
        "/functions/v1/integration-status",
        projectUrl.origin
      );

      const response = await fetch(
        endpoint.toString(),
        {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          credentials: "omit",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: config.anonKey
          }
        }
      );

      if (!response.ok) {
        throw new Error("STATUS_UNAVAILABLE");
      }

      const data = await response.json();

      if (
        !data ||
        typeof data !== "object" ||
        !data.fiscal ||
        !data.delivery ||
        !data.payment
      ) {
        throw new Error("INVALID_RESPONSE");
      }

      const devices = validCount(
        data.fiscal.registeredDevices
      );

      const unknown = validCount(
        data.fiscal.unknownOperations
      );

      const pending = validCount(
        data.delivery.pendingReview
      );

      if (
        devices === null ||
        unknown === null ||
        pending === null
      ) {
        throw new Error("INVALID_COUNTS");
      }

      addResult(
        "Dispositivos registrados",
        devices
      );

      addResult(
        "Operaciones fiscales por conciliar",
        unknown
      );

      addResult(
        "Pedidos externos por revisar",
        pending
      );

      addResult(
        "Impresión fiscal",
        "No autorizada"
      );

      addResult(
        "Conectores de reparto",
        "No verificados"
      );

      addResult(
        "Stripe y BLIK",
        "Por verificar"
      );

      message.textContent =
        "Diagnóstico consultado correctamente. " +
        "Los controles operativos permanecen bloqueados.";

    } catch (error) {
      const code =
        error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR";

      message.textContent =
        code === "LOGIN_REQUIRED"
          ? "Inicia sesión en RC ORDERA para consultar el estado."
          : "No fue posible verificar el estado. " +
            "Comprueba la sesión y el despliegue del servicio.";

      results.replaceChildren();
    } finally {
      refreshButton.disabled = false;
    }
  }

  refreshButton.addEventListener(
    "click",
    loadStatus
  );
})();
