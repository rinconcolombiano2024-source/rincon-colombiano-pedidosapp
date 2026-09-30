import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/*
 * ============================================================
 * RC ORDERA
 * CREATE CUSTOMER ORDER EDGE GATEWAY
 *
 * Objetivos:
 * - Proteger create_customer_order antes de llegar al RPC.
 * - Aplicar rate limit persistente por red + dispositivo.
 * - Mantener autenticacion del cliente cuando exista.
 * - Mantener pedidos de invitado.
 * - No confiar en precios enviados por el navegador.
 * - No almacenar IP ni User-Agent en claro.
 * - No exponer service_role al cliente.
 * - Conservar idempotencia del RPC actual.
 * ============================================================
 */

const MAX_REQUEST_BYTES = 256 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type JsonRecord = Record<string, unknown>;

type OrderRequest = {
  p_id?: unknown;
  p_user_id?: unknown;
  p_public_token?: unknown;
  p_table_label?: unknown;
  p_customer_name?: unknown;
  p_order_type?: unknown;
  p_order_json?: unknown;
  p_total?: unknown;
};

function jsonResponse(
  status: number,
  body: JsonRecord,
  requestId: string,
) {
  return new Response(
    JSON.stringify({
      ...body,
      requestId,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-rc-request-id": requestId,
      },
    },
  );
}

function cleanString(
  value: unknown,
  maximumLength: number,
) {
  return String(value ?? "")
    .trim()
    .slice(0, maximumLength);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function isClientGuardId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  );

  return Array.from(
    new Uint8Array(digest),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

function firstForwardedAddress(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean) || "";
}

function requestNetworkIdentity(request: Request) {
  /*
   * Supabase Edge se ejecuta detras de infraestructura proxy.
   *
   * cf-connecting-ip tiene prioridad.
   * x-forwarded-for queda como fallback.
   * x-real-ip es una tercera opcion.
   *
   * Nunca persistimos el valor original.
   */
  const cloudflareIp = cleanString(
    request.headers.get("cf-connecting-ip"),
    128,
  );

  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwarded = firstForwardedAddress(
    cleanString(
      request.headers.get("x-forwarded-for"),
      512,
    ),
  );

  if (forwarded) {
    return forwarded;
  }

  const realIp = cleanString(
    request.headers.get("x-real-ip"),
    128,
  );

  if (realIp) {
    return realIp;
  }

  /*
   * Fallback defensivo.
   *
   * Evita que todos los usuarios sin cabecera de red terminen
   * necesariamente bajo una identidad fija "unknown".
   */
  return [
    "network-unavailable",
    cleanString(request.headers.get("origin"), 300),
    cleanString(request.headers.get("user-agent"), 500),
  ].join("|");
}

function safeDatabaseErrorMessage(error: unknown) {
  const message = String(
    (error as { message?: unknown })?.message || "",
  ).trim();

  /*
   * Solo propagamos errores funcionales que cliente.js
   * necesita interpretar.
   *
   * No devolvemos detalles SQL arbitrarios.
   */
  const allowedPatterns = [
    /ORDER_RATE_LIMITED/i,
    /Restaurant is required/i,
    /Restaurant is closed/i,
    /Invalid public token/i,
    /Customer name is required/i,
    /Invalid order type/i,
    /Invalid payment method/i,
    /Online payment is unavailable/i,
    /Invalid product list/i,
    /Invalid product/i,
    /Product not found/i,
    /Product unavailable/i,
    /Invalid product quantity/i,
    /Order quantity limit exceeded/i,
    /delivery quote/i,
    /delivery route/i,
    /Restaurant country does not match/i,
    /Restaurant region does not match/i,
    /Idempotency conflict/i,
    /currency is not configured/i,
  ];

  if (
    allowedPatterns.some((pattern) =>
      pattern.test(message)
    )
  ) {
    return message;
  }

  return "ORDER_CREATE_FAILED";
}

async function authenticatedUserId(
  admin: ReturnType<typeof createClient>,
  authorization: string,
) {
  const token = authorization.replace(
    /^Bearer\s+/i,
    "",
  ).trim();

  if (!token) {
    return null;
  }

  const {
    data,
    error,
  } = await admin.auth.getUser(token);

  if (error || !data?.user?.id) {
    return null;
  }

  return String(data.user.id);
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();

  if (request.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "x-rc-request-id": requestId,
        },
      },
    );
  }

  if (request.method !== "POST") {
    return jsonResponse(
      405,
      {
        error: "METHOD_NOT_ALLOWED",
      },
      requestId,
    );
  }

  /*
   * ==========================================================
   * CONFIGURACION
   * ==========================================================
   */

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") || "";

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") || "";

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey
  ) {
    console.error(
      JSON.stringify({
        event: "customer_order_edge_not_configured",
        requestId,
      }),
    );

    return jsonResponse(
      503,
      {
        error: "ORDER_SERVICE_UNAVAILABLE",
      },
      requestId,
    );
  }

  /*
   * ==========================================================
   * LIMITE DE TAMANO
   * ==========================================================
   */

  const declaredLength = Number(
    request.headers.get("content-length") || 0,
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BYTES
  ) {
    return jsonResponse(
      413,
      {
        error: "ORDER_REQUEST_TOO_LARGE",
      },
      requestId,
    );
  }

  let rawBody = "";

  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse(
      400,
      {
        error: "INVALID_ORDER_REQUEST",
      },
      requestId,
    );
  }

  if (
    !rawBody ||
    rawBody.length > MAX_REQUEST_BYTES
  ) {
    return jsonResponse(
      rawBody
        ? 413
        : 400,
      {
        error: rawBody
          ? "ORDER_REQUEST_TOO_LARGE"
          : "INVALID_ORDER_REQUEST",
      },
      requestId,
    );
  }

  /*
   * ==========================================================
   * PARSEO
   * ==========================================================
   */

  let payload: OrderRequest;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      400,
      {
        error: "INVALID_ORDER_REQUEST",
      },
      requestId,
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return jsonResponse(
      400,
      {
        error: "INVALID_ORDER_REQUEST",
      },
      requestId,
    );
  }

  /*
   * ==========================================================
   * VALIDACION SUPERFICIAL
   *
   * La validacion economica/autoritativa sigue perteneciendo
   * a PostgreSQL.
   * ==========================================================
   */

  const orderId = cleanString(
    payload.p_id,
    64,
  );

  const restaurantUserId = cleanString(
    payload.p_user_id,
    64,
  );

  const publicToken = cleanString(
    payload.p_public_token,
    512,
  );

  const tableLabel = cleanString(
    payload.p_table_label,
    160,
  );

  const customerName = cleanString(
    payload.p_customer_name,
    160,
  );

  const orderType = cleanString(
    payload.p_order_type,
    80,
  );

  if (
    !isUuid(orderId) ||
    !isUuid(restaurantUserId) ||
    publicToken.length < 8 ||
    !customerName ||
    ![
      "Comer en el punto",
      "Recoger en el punto",
      "Domicilio",
    ].includes(orderType)
  ) {
    return jsonResponse(
      400,
      {
        error: "INVALID_ORDER_REQUEST",
      },
      requestId,
    );
  }

  if (
    !payload.p_order_json ||
    typeof payload.p_order_json !== "object" ||
    Array.isArray(payload.p_order_json)
  ) {
    return jsonResponse(
      400,
      {
        error: "INVALID_ORDER_REQUEST",
      },
      requestId,
    );
  }

  const orderJson =
    payload.p_order_json as JsonRecord;

  const clientGuardId = cleanString(
    orderJson.clientGuardId ??
      orderJson.client_guard_id,
    80,
  );

  /*
   * Clientes legacy pueden no tener guard.
   * Los nuevos clientes deben enviarlo.
   */
  const normalizedGuard =
    isClientGuardId(clientGuardId)
      ? clientGuardId.toLowerCase()
      : "legacy-no-valid-guard";

  /*
   * ==========================================================
   * CLIENTES SUPABASE
   * ==========================================================
   */

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const incomingAuthorization =
    cleanString(
      request.headers.get("authorization"),
      4096,
    );

  /*
   * Si existe una sesion autentica, la conservaremos en el RPC
   * que realmente crea el pedido.
   *
   * Para invitado utilizamos anon.
   */
  const authorizationForRpc =
    incomingAuthorization ||
    `Bearer ${anonKey}`;

  const scopedClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: authorizationForRpc,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  /*
   * ==========================================================
   * IDENTIDAD ANTI-ABUSO
   * ==========================================================
   */

  const networkIdentity =
    requestNetworkIdentity(request);

  const userAgent = cleanString(
    request.headers.get("user-agent"),
    500,
  ) || "unknown-agent";

  const networkHash = await sha256(
    networkIdentity,
  );

  const deviceHash = await sha256(
    [
      networkIdentity,
      userAgent,
      normalizedGuard,
    ].join("|"),
  );

  /*
   * ==========================================================
   * RATE LIMIT PERSISTENTE
   *
   * Esta RPC solo puede ser ejecutada con service_role.
   *
   * MUY IMPORTANTE:
   * esta llamada termina antes de comenzar la transaccion que
   * crea el pedido.
   *
   * Por eso un pedido posteriormente rechazado por el core
   * igualmente consume su cuota anti-abuso.
   * ==========================================================
   */

  const {
    data: quotaAllowed,
    error: quotaError,
  } = await admin.rpc(
    "rc_ordera_consume_customer_order_edge_quota",
    {
      p_restaurant_user_id: restaurantUserId,
      p_network_hash: networkHash,
      p_device_hash: deviceHash,
    },
  );

  if (quotaError) {
    console.error(
      JSON.stringify({
        event: "customer_order_edge_quota_error",
        requestId,
        restaurantUserId,
        code: String(
          quotaError.code || "",
        ).slice(0, 32),
      }),
    );

    return jsonResponse(
      503,
      {
        error: "ORDER_SECURITY_UNAVAILABLE",
      },
      requestId,
    );
  }

  if (quotaAllowed !== true) {
    console.warn(
      JSON.stringify({
        event: "customer_order_edge_rate_limited",
        requestId,
        restaurantUserId,
      }),
    );

    return jsonResponse(
      429,
      {
        error: "ORDER_RATE_LIMITED",
      },
      requestId,
    );
  }

  /*
   * ==========================================================
   * IDENTIDAD AUTENTICADA SOLO PARA TELEMETRIA SEGURA
   *
   * No confiamos en customerUserId enviado en order_json.
   * PostgreSQL continuara usando auth.uid().
   * ==========================================================
   */

  const currentUserId =
    incomingAuthorization
      ? await authenticatedUserId(
          admin,
          incomingAuthorization,
        )
      : null;

  /*
   * ==========================================================
   * CREACION REAL
   *
   * No usamos service_role aqui.
   *
   * Esto es CRITICO:
   * el RPC se ejecuta bajo la identidad real del cliente
   * autenticado o bajo anon si es invitado.
   *
   * Por tanto auth.uid(), RLS y contratos actuales conservan
   * su comportamiento.
   * ==========================================================
   */

  const rpcPayload = {
    p_id: orderId,
    p_user_id: restaurantUserId,
    p_public_token: publicToken,
    p_table_label: tableLabel,
    p_customer_name: customerName,
    p_order_type: orderType,
    p_order_json: orderJson,
    p_total: payload.p_total,
  };

  const startedAt = Date.now();

  const {
    data: orderData,
    error: orderError,
  } = await scopedClient.rpc(
    "create_customer_order",
    rpcPayload,
  );

  const elapsedMs =
    Date.now() - startedAt;

  if (orderError) {
    const safeMessage =
      safeDatabaseErrorMessage(orderError);

    const rateLimited =
      /ORDER_RATE_LIMITED/i.test(
        safeMessage,
      );

    console.warn(
      JSON.stringify({
        event: "customer_order_edge_rejected",
        requestId,
        restaurantUserId,
        authenticated:
          Boolean(currentUserId),
        elapsedMs,
        code: String(
          orderError.code || "",
        ).slice(0, 32),
        reason: safeMessage,
      }),
    );

    return jsonResponse(
      rateLimited
        ? 429
        : 400,
      {
        error: safeMessage,
      },
      requestId,
    );
  }

  /*
   * ==========================================================
   * NORMALIZACION DE RESPUESTA
   * ==========================================================
   */

  const row =
    Array.isArray(orderData)
      ? orderData[0]
      : orderData;

  const returnedId =
    cleanString(
      (row as JsonRecord | null)?.id,
      64,
    );

  const returnedToken =
    cleanString(
      (row as JsonRecord | null)?.public_token,
      512,
    );

  if (
    !isUuid(returnedId) ||
    !returnedToken
  ) {
    console.error(
      JSON.stringify({
        event: "customer_order_edge_invalid_rpc_response",
        requestId,
        restaurantUserId,
        elapsedMs,
      }),
    );

    return jsonResponse(
      502,
      {
        error: "ORDER_CREATE_INVALID_RESPONSE",
      },
      requestId,
    );
  }

  console.log(
    JSON.stringify({
      event: "customer_order_edge_created",
      requestId,
      restaurantUserId,
      orderId: returnedId,
      authenticated:
        Boolean(currentUserId),
      elapsedMs,
    }),
  );

  return jsonResponse(
    200,
    {
      ok: true,
      id: returnedId,
      public_token: returnedToken,
    },
    requestId,
  );
});
