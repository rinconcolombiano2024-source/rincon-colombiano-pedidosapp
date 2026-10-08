
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

// RC ORDERA V91-43
// Lectura paginada de pedidos externos.
// Sin polling, cron ni escrituras.
// Acceso inicial: propietario autenticado.

const MAX_PAGE = 30;

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
    },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "GET") {
    return response(405, {
      error: "METHOD_NOT_ALLOWED",
    });
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  ) || "";

  if (!url || !serviceKey) {
    return response(503, {
      error: "SERVICE_UNAVAILABLE",
    });
  }

  const token = /^Bearer (.+)$/i.exec(
    request.headers.get("authorization") || "",
  )?.[1];

  if (!token) {
    return response(401, {
      error: "AUTH_REQUIRED",
    });
  }

  const client = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: authData, error: authError } =
    await client.auth.getUser(token);

  if (authError || !authData.user) {
    return response(401, {
      error: "INVALID_SESSION",
    });
  }

  // Versión inicial: únicamente pedidos cuyo
  // propietario sea el usuario autenticado.
  // Nunca aceptar restaurant_user_id del cliente.
  const restaurantUserId = authData.user.id;

  const requestUrl = new URL(request.url);

  const rawLimit = requestUrl.searchParams.get(
    "limit",
  ) || "20";

  if (!/^\d{1,2}$/.test(rawLimit)) {
    return response(400, {
      error: "INVALID_LIMIT",
    });
  }

  const limit = Number(rawLimit);

  if (limit < 1 || limit > MAX_PAGE) {
    return response(400, {
      error: "INVALID_LIMIT",
    });
  }

  const status = requestUrl.searchParams.get(
    "status",
  ) || "received";

  const statuses = new Set([
    "received",
    "needs_review",
    "imported",
    "cancelled",
  ]);

  if (!statuses.has(status)) {
    return response(400, {
      error: "INVALID_STATUS",
    });
  }

  const cursorTime = requestUrl.searchParams.get(
    "before",
  );

  const cursorId = requestUrl.searchParams.get(
    "before_id",
  );

  // No permitir cursores incompletos.
  if ((cursorTime === null) !== (cursorId === null)) {
    return response(400, {
      error: "INVALID_CURSOR",
    });
  }

  let query = client
    .from("rc_external_delivery_inbox")
    .select(
      "id,platform,external_order_id," +
      "source_status,processing_status," +
      "currency,total_grosz,received_at",
    )
    .eq("restaurant_user_id", restaurantUserId)
    .eq("processing_status", status)
    .order("received_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (cursorTime !== null && cursorId !== null) {
    const milliseconds = Date.parse(cursorTime);

    if (
      !Number.isFinite(milliseconds) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(cursorId)
    ) {
      return response(400, {
        error: "INVALID_CURSOR",
      });
    }

    // Cursor estable: timestamp + UUID.
    // Utilizamos el filtro PostgreSQL compuesto.
    const safeTime = new Date(milliseconds)
      .toISOString();

    query = query.or(
      `received_at.gt.${safeTime},` +
      `and(received_at.eq.${safeTime},id.gt.${cursorId})`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("EXTERNAL_INBOX_READ", {
      code: error.code,
    });

    return response(503, {
      error: "INBOX_UNAVAILABLE",
    });
  }

  const rows = data || [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  return response(200, {
    orders: page,
    hasMore,
    nextCursor:
      hasMore && last
        ? {
            before: last.received_at,
            before_id: last.id,
          }
        : null,
  });
});
