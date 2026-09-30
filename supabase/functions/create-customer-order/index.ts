import { createClient } from "npm:@supabase/supabase-js@2.117.1";

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

function readSupabaseRuntimeKeyCandidates(
  mapEnvName: string,
  singleEnvName: string,
  legacyEnvName: string,
) {
  const values = new Set<string>();

  const mapValue =
    Deno.env.get(mapEnvName)?.trim() || "";

  if (mapValue) {
    try {
      const parsed = JSON.parse(mapValue);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        for (const value of Object.values(parsed)) {
          if (typeof value !== "string") {
            continue;
          }

          const normalized = value.trim();

          if (normalized) {
            values.add(normalized);
          }
        }
      }
    } catch {
      // El helper principal conserva los fallbacks compatibles.
    }
  }

  const singleValue =
    Deno.env.get(singleEnvName)?.trim() || "";

  if (singleValue) {
    values.add(singleValue);
  }

  const legacyValue =
    Deno.env.get(legacyEnvName)?.trim() || "";

  if (legacyValue) {
    values.add(legacyValue);
  }

  return values;
}

function readSupabaseRuntimeKey(
  mapEnvName: string,
  singleEnvName: string,
  legacyEnvName: string,
) {
  const mapValue =
    Deno.env.get(mapEnvName)?.trim() || "";

  if (mapValue) {
    try {
      const parsed = JSON.parse(mapValue);

      const defaultKey =
        typeof parsed?.default === "string"
          ? parsed.default.trim()
          : "";

      if (defaultKey) {
        return defaultKey;
      }
    } catch {
      // Continuamos con los fallbacks controlados.
    }
  }

  const singleValue =
    Deno.env.get(singleEnvName)?.trim() || "";

  if (singleValue) {
    return singleValue;
  }

  /*
   * Compatibilidad temporal con proyectos Supabase
   * que todavía conservan las claves legacy.
   */
  return (
    Deno.env.get(legacyEnvName)?.trim() || ""
  );
}

async function hmacSha256(
  secret: string,
  value: string,
) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  return Array.from(
    new Uint8Array(signature),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

async function readRequestBodyWithLimit(
  request: Request,
  maximumBytes: number,
) {
  if (!request.body) {
    return {
      text: "",
      tooLarge: false,
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // El cuerpo ya sera rechazado; no propagamos error de cancelacion.
        }

        return {
          text: "",
          tooLarge: true,
        };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder().decode(body),
    tooLarge: false,
  };
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

function extractBearerToken(authorization: string) {
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || "";
}

async function authenticatedUserId(
  admin: ReturnType<typeof createClient>,
  accessToken: string,
) {
  if (!accessToken) {
    return null;
  }

  const {
    data,
    error,
  } = await admin.auth.getUser(accessToken);

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
    Deno.env.get("SUPABASE_URL")?.trim() || "";

  const secretKey =
    readSupabaseRuntimeKey(
      "SUPABASE_SECRET_KEYS",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  const publicApplicationKeys =
    readSupabaseRuntimeKeyCandidates(
      "SUPABASE_PUBLISHABLE_KEYS",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
    );

  if (
    !supabaseUrl ||
    publicApplicationKeys.size === 0 ||
    !secretKey
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
    const bodyRead =
      await readRequestBodyWithLimit(
        request,
        MAX_REQUEST_BYTES,
      );

    if (bodyRead.tooLarge) {
      return jsonResponse(
        413,
        {
          error: "ORDER_REQUEST_TOO_LARGE",
        },
        requestId,
      );
    }

    rawBody = bodyRead.text;
  } catch {
    return jsonResponse(
      400,
      {
        error: "INVALID_ORDER_REQUEST",
      },
      requestId,
    );
  }

  if (!rawBody) {
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
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const incomingAuthorization =
    cleanString(
      request.headers.get("authorization"),
      4096,
    );

  const bearerToken =
    extractBearerToken(incomingAuthorization);

  /*
   * Compatibilidad durante la migracion de claves:
   *
   * - Con claves nuevas, Authorization debe contener un JWT de usuario.
   * - Algunos clientes legacy pueden seguir enviando la clave publica
   *   como Bearer. En ese caso se trata como invitado, nunca como usuario.
   */
  const bearerIsPublicApplicationKey = Boolean(
    bearerToken &&
      publicApplicationKeys.has(bearerToken)
  );

  const userAccessToken =
    bearerIsPublicApplicationKey
      ? ""
      : bearerToken;

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

  const networkHash = await hmacSha256(
    secretKey,
    `network:${networkIdentity}`,
  );

  const deviceHash = await hmacSha256(
    secretKey,
    [
      "device",
      networkIdentity,
      userAgent,
      normalizedGuard,
    ].join("|"),
  );

  /*
   * ==========================================================
   * RATE LIMIT PERSISTENTE
   *
   * Esta RPC solo puede ser ejecutada con credencial de servidor
   * (secret key o service_role legacy).
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

  /*
   * Si existe Authorization, solamente aceptamos:
   *
   * - Bearer de aplicacion publica conocido -> invitado; o
   * - JWT de usuario valido -> cliente autenticado.
   *
   * Nunca degradamos silenciosamente un JWT invalido a invitado.
   */
  if (incomingAuthorization && !bearerToken) {
    return jsonResponse(
      401,
      {
        error: "INVALID_AUTH_SESSION",
      },
      requestId,
    );
  }

  const currentUserId =
    userAccessToken
      ? await authenticatedUserId(
          admin,
          userAccessToken,
        )
      : null;

  if (userAccessToken && !currentUserId) {
    return jsonResponse(
      401,
      {
        error: "INVALID_AUTH_SESSION",
      },
      requestId,
    );
  }


  /*
   * ==========================================================
   * CREACION REAL
   *
   * Usamos service_role SOLO desde esta Edge Function para
   * ejecutar un RPC interno que NO tiene permiso para anon ni
   * authenticated.
   *
   * La identidad del cliente se valida arriba con auth.getUser()
   * y se transmite como p_customer_user_id.
   *
   * Esto cierra el bypass directo al RPC desde el navegador.
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
    p_customer_user_id: currentUserId,
    p_total: payload.p_total,
  };

  const startedAt = Date.now();

  const {
    data: orderData,
    error: orderError,
  } = await admin.rpc(
    "rc_ordera_create_customer_order_edge",
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
