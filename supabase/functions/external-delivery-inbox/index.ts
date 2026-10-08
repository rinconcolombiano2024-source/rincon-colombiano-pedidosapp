
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

/**
 * RC ORDERA V91-44
 * EXTERNAL DELIVERY INBOX
 *
 * Lectura segura y paginada de pedidos externos.
 *
 * - Autenticacion mediante Supabase Auth.
 * - Acceso limitado al propietario autenticado.
 * - No acepta restaurant_user_id del navegador.
 * - Paginacion estable con precision PostgreSQL.
 * - Limite maximo de 30 pedidos por solicitud.
 * - Sin cron, timers, polling ni escrituras.
 * - Sin acceso a datos fiscales.
 * - No genera ventas ni pedidos internos.
 *
 * IMPORTANTE:
 * Esta version requiere validacion en staging
 * antes de utilizarse en produccion.
 */

const MAX_PAGE = 30;
const DEFAULT_PAGE = 20;

const ALLOWED_STATUSES = new Set([
  "received",
  "needs_review",
  "imported",
  "cancelled",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Formato de timestamp ISO PostgreSQL.
// Conservamos los decimales originales.
// Aceptamos Z y desplazamiento +00:00.

const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/;

function response(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "vary": "Authorization",
    },
  });
}

function validTimestamp(value: string): boolean {
  if (!TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  // Date.parse solo comprueba que la fecha sea
  // interpretable. NO usamos su resultado
  // para reconstruir el cursor.
  const milliseconds = Date.parse(value);

  return Number.isFinite(milliseconds);
}

function validUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function parseLimit(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) {
    return null;
  }

  const limit = Number(raw);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE
  ) {
    return null;
  }

  return limit;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "GET") {
    return response(405, {
      error: "METHOD_NOT_ALLOWED",
    });
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") || "";

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return response(503, {
      error: "SERVICE_UNAVAILABLE",
    });
  }

  const authorization =
    request.headers.get("authorization") || "";

  const token = /^Bearer\s+(.+)$/i.exec(
    authorization.trim(),
  )?.[1]?.trim();

  if (!token) {
    return response(401, {
      error: "AUTH_REQUIRED",
    });
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

  // Autenticar cada solicitud.
  const {
    data: authData,
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return response(401, {
      error: "INVALID_SESSION",
    });
  }

  // Solo propietario.
  // Nunca confiar en un identificador de
  // restaurante suministrado por el cliente.

  const restaurantUserId = authData.user.id;

  const requestUrl = new URL(request.url);

  const rawLimit =
    requestUrl.searchParams.get("limit") ??
    String(DEFAULT_PAGE);

  const limit = parseLimit(rawLimit);

  if (limit === null) {
    return response(400, {
      error: "INVALID_LIMIT",
    });
  }

  const status =
    requestUrl.searchParams.get("status") ??
    "received";

  if (!ALLOWED_STATUSES.has(status)) {
    return response(400, {
      error: "INVALID_STATUS",
    });
  }

  const cursorTime =
    requestUrl.searchParams.get("before");

  const cursorId =
    requestUrl.searchParams.get("before_id");

  // Ambos cursores deben existir juntos.
  if (
    (cursorTime === null) !==
    (cursorId === null)
  ) {
    return response(400, {
      error: "INVALID_CURSOR",
    });
  }

  if (
    cursorTime !== null &&
    cursorId !== null
  ) {
    if (
      !validTimestamp(cursorTime) ||
      !validUuid(cursorId)
    ) {
      return response(400, {
        error: "INVALID_CURSOR",
      });
    }
  }

  // Consulta indexada:
  // restaurante -> estado -> fecha -> ID.

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

  // Cursor compuesto y sin redondeos.
  //
  // received_at > cursorTime
  // OR
  // (
  //   received_at = cursorTime
  //   AND id > cursorId
  // )
  //
  // Mantiene la precision original
  // del timestamp de PostgreSQL.

  if (
    cursorTime !== null &&
    cursorId !== null
  ) {
    query = query.or(
      `received_at.gt.${cursorTime},` +
      `and(received_at.eq.${cursorTime},id.gt.${cursorId})`,
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    console.error(
      "RC_EXTERNAL_INBOX_READ_FAILED",
      {
        code: error.code || "unknown",
      },
    );

    return response(503, {
      error: "INBOX_UNAVAILABLE",
    });
  }

  const rows = data || [];

  const hasMore = rows.length > limit;

  const page = rows.slice(0, limit);

  const last = page.length > 0
    ? page[page.length - 1]
    : null;

  const nextCursor =
    hasMore && last
      ? {
          before: last.received_at,
          before_id: last.id,
        }
      : null;

  return response(200, {
    orders: page,
    hasMore,
    nextCursor,
  });
});
