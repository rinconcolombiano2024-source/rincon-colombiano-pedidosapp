
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

/**
 * RC ORDERA V91-44.1
 * EXTERNAL DELIVERY INBOX
 *
 * Lectura segura para la tablet del restaurante.
 *
 * Características:
 * - Autenticación Supabase Auth.
 * - Aislamiento por propietario.
 * - Credenciales administrativas solo en servidor.
 * - Paginación compuesta de alta precisión.
 * - Máximo 30 registros por solicitud.
 * - Validación estricta de parámetros.
 * - CORS limitado a orígenes autorizados.
 * - Sin cron, polling, timers ni escrituras.
 * - Sin efectos sobre ventas o fiscalización.
 *
 * IMPORTANTE:
 * El receptor de pedidos externos es independiente.
 * Esta función solamente consulta registros.
 *
 * Requiere pruebas en staging antes de producción.
 */

const MAX_PAGE = 30;
const DEFAULT_PAGE = 20;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|\+00:00)$/;

const ALLOWED_STATUSES = new Set([
  "received",
  "needs_review",
  "imported",
  "cancelled",
]);

type JsonObject = Record<string, unknown>;

type InboxRow = {
  id: string;
  platform: string;
  external_order_id: string;
  source_status: string;
  processing_status: string;
  currency: string;
  total_grosz: number | null;
  received_at: string;
};

function jsonResponse(
  status: number,
  data: JsonObject,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "vary": "Authorization, Origin",
    },
  });
}

/**
 * Orígenes configurados mediante secreto de Supabase:
 *
 * RC_EXTERNAL_ALLOWED_ORIGINS
 *
 * Ejemplo:
 * https://rincon-colombiano-pedidosapp.vercel.app
 *
 * No acepta comodines.
 */
function configuredOrigins(): Set<string> {
  const raw =
    Deno.env.get("RC_EXTERNAL_ALLOWED_ORIGINS") || "";

  const origins = new Set<string>();

  for (const entry of raw.split(",")) {
    const candidate = entry.trim();

    if (!candidate) continue;

    try {
      const url = new URL(candidate);

      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        candidate !== url.origin
      ) {
        continue;
      }

      origins.add(url.origin);
    } catch {
      // Ignorar origen inválido.
    }
  }

  return origins;
}

function corsFor(
  request: Request,
): Record<string, string> | null {
  const origin = request.headers.get("origin");

  // Los clientes no navegador pueden no enviar Origin.
  if (!origin) return {};

  if (!configuredOrigins().has(origin)) {
    return null;
  }

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers":
      "authorization, apikey, x-client-info, content-type",
    "access-control-max-age": "600",
  };
}

function parseLimit(
  value: string,
): number | null {
  if (!/^[0-9]{1,2}$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_PAGE
  ) {
    return null;
  }

  return parsed;
}

function validUuid(
  value: string,
): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Valida un timestamp UTC sin redondear
 * ni reconstruir el valor original.
 *
 * Admite hasta seis decimales.
 */
function validTimestamp(
  value: string,
): boolean {
  const match = TIMESTAMP_PATTERN.exec(value);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  const leap =
    year % 4 === 0 &&
    (year % 100 !== 0 || year % 400 === 0);

  const days = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day >= 1 && day <= days[month - 1];
}

function parseBearer(
  authorization: string | null,
): string | null {
  if (!authorization) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(
    authorization.trim(),
  );

  if (!match) return null;

  const token = match[1];

  if (
    token.length < 10 ||
    token.length > 8192
  ) {
    return null;
  }

  return token;
}

function parseCursor(
  url: URL,
):
  | { time: string; id: string }
  | null
  | "INVALID" {

  const times = url.searchParams.getAll("before");
  const ids = url.searchParams.getAll("before_id");

  if (
    times.length === 0 &&
    ids.length === 0
  ) {
    return null;
  }

  if (
    times.length !== 1 ||
    ids.length !== 1
  ) {
    return "INVALID";
  }

  const time = times[0];
  const id = ids[0];

  if (
    !validTimestamp(time) ||
    !validUuid(id)
  ) {
    return "INVALID";
  }

  return { time, id };
}

Deno.serve(async (request: Request) => {
  const cors = corsFor(request);

  if (cors === null) {
    return jsonResponse(
      403,
      { error: "ORIGIN_NOT_ALLOWED" },
      {},
    );
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "vary": "Origin",
      },
    });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      405,
      { error: "METHOD_NOT_ALLOWED" },
      cors,
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")?.trim() || "";

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        ?.trim() || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        503,
        { error: "SERVICE_UNAVAILABLE" },
        cors,
      );
    }

    const token = parseBearer(
      request.headers.get("authorization"),
    );

    if (!token) {
      return jsonResponse(
        401,
        { error: "AUTH_REQUIRED" },
        cors,
      );
    }

    const requestUrl = new URL(request.url);

    const limits = requestUrl.searchParams.getAll(
      "limit",
    );

    const statuses = requestUrl.searchParams.getAll(
      "status",
    );

    if (
      limits.length > 1 ||
      statuses.length > 1
    ) {
      return jsonResponse(
        400,
        { error: "DUPLICATE_PARAMETERS" },
        cors,
      );
    }

    const limit = parseLimit(
      limits[0] ?? String(DEFAULT_PAGE),
    );

    if (limit === null) {
      return jsonResponse(
        400,
        { error: "INVALID_LIMIT" },
        cors,
      );
    }

    const status = statuses[0] ?? "received";

    if (!ALLOWED_STATUSES.has(status)) {
      return jsonResponse(
        400,
        { error: "INVALID_STATUS" },
        cors,
      );
    }

    const cursor = parseCursor(requestUrl);

    if (cursor === "INVALID") {
      return jsonResponse(
        400,
        { error: "INVALID_CURSOR" },
        cors,
      );
    }

    const client = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Verificar la identidad con Supabase Auth.
    const { data: authData, error: authError } =
      await client.auth.getUser(token);

    if (
      authError ||
      !authData?.user?.id ||
      !validUuid(authData.user.id)
    ) {
      return jsonResponse(
        401,
        { error: "INVALID_SESSION" },
        cors,
      );
    }

    // Identidad derivada de la sesión.
    // No se recibe desde parámetros externos.
    const restaurantUserId = authData.user.id;

    let query = client
      .from("rc_external_delivery_inbox")
      .select(
        [
          "id",
          "platform",
          "external_order_id",
          "source_status",
          "processing_status",
          "currency",
          "total_grosz",
          "received_at",
        ].join(","),
      )
      .eq(
        "restaurant_user_id",
        restaurantUserId,
      )
      .eq(
        "processing_status",
        status,
      )
      .order("received_at", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      })
      .limit(limit + 1);

    /**
     * Paginación compuesta:
     *
     * received_at > cursor.time
     * OR
     * (
     *   received_at = cursor.time
     *   AND id > cursor.id
     * )
     *
     * No convertir timestamp a Date.
     * Se conserva la precisión original.
     */

    if (cursor) {
      // Valores previamente validados.
      // Comillas para literal temporal PostgREST.
      const timestamp = `"${cursor.time}"`;

      query = query.or(
        `received_at.gt.${timestamp},` +
        `and(received_at.eq.${timestamp},` +
        `id.gt.${cursor.id})`,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "RC_EXTERNAL_INBOX_QUERY_FAILED",
        { code: error.code || "UNKNOWN" },
      );

      return jsonResponse(
        503,
        { error: "INBOX_UNAVAILABLE" },
        cors,
      );
    }

    const rows = (data ?? []) as InboxRow[];

    const hasMore = rows.length > limit;
    const orders = rows.slice(0, limit);

    const last =
      orders.length > 0
        ? orders[orders.length - 1]
        : null;

    return jsonResponse(
      200,
      {
        orders,
        hasMore,
        nextCursor:
          hasMore && last
            ? {
                before: last.received_at,
                before_id: last.id,
              }
            : null,
      },
      cors,
    );
  } catch {
    // No devolver errores internos al navegador.
    console.error(
      "RC_EXTERNAL_INBOX_UNEXPECTED_ERROR",
    );

    return jsonResponse(
      503,
      { error: "SERVICE_UNAVAILABLE" },
      cors,
    );
  }
});
