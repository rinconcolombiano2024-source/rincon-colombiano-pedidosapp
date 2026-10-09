
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

/**
 * RC ORDERA — Integration Status V1
 *
 * Endpoint de diagnóstico, solo lectura.
 * - Identidad obtenida de Supabase Auth.
 * - Consultas limitadas al restaurante autenticado.
 * - No acepta restaurantId proporcionado por cliente.
 * - No imprime, cobra, importa ni confirma pedidos.
 * - Sin polling, cron ni procesos persistentes.
 *
 * Requiere despliegue y pruebas en staging.
 */

const providers = [
  "uber_eats",
  "wolt",
  "glovo",
  "bolt_food",
  "pyszne",
] as const;

function respond(
  status: number,
  body: Record<string, unknown>,
  cors: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "vary": "Origin, Authorization",
    },
  });
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const configured =
    Deno.env.get("RC_EXTERNAL_ALLOWED_ORIGINS") || "";

  for (const entry of configured.split(",")) {
    const value = entry.trim();

    try {
      const url = new URL(value);

      if (
        url.protocol === "https:" &&
        url.origin === value &&
        !url.username &&
        !url.password
      ) {
        origins.add(value);
      }
    } catch {
      // Ignorar configuraciones inválidas.
    }
  }

  return origins;
}

function corsFor(
  request: Request,
): Record<string, string> | null {
  const origin = request.headers.get("origin");

  if (!origin) return {};

  if (!allowedOrigins().has(origin)) {
    return null;
  }

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers":
      "authorization, apikey, content-type",
    "access-control-max-age": "600",
  };
}

function getBearer(
  header: string | null,
): string | null {
  if (!header) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(
    header.trim(),
  );

  if (
    !match ||
    match[1].length < 10 ||
    match[1].length > 8192
  ) {
    return null;
  }

  return match[1];
}

Deno.serve(async (request: Request) => {
  const cors = corsFor(request);

  if (cors === null) {
    return respond(403, {
      error: "ORIGIN_NOT_ALLOWED",
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors,
    });
  }

  if (request.method !== "GET") {
    return respond(
      405,
      { error: "METHOD_NOT_ALLOWED" },
      cors,
    );
  }

  const token = getBearer(
    request.headers.get("authorization"),
  );

  if (!token) {
    return respond(
      401,
      { error: "AUTH_REQUIRED" },
      cors,
    );
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (!url || !serviceKey) {
    return respond(
      503,
      { error: "SERVICE_UNAVAILABLE" },
      cors,
    );
  }

  try {
    const db = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: auth,
      error: authError,
    } = await db.auth.getUser(token);

    const restaurantUserId = auth?.user?.id;

    if (authError || !restaurantUserId) {
      return respond(
        401,
        { error: "INVALID_SESSION" },
        cors,
      );
    }

    /*
     * Consultas agregadas:
     * No se descargan pedidos ni payloads.
     * No se exponen credenciales.
     * Todas las consultas filtran por propietario.
     */
    const [
      devicesResult,
      fiscalUnknownResult,
      externalReviewResult,
    ] = await Promise.all([
      db.from("fiscal_devices")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("restaurant_user_id", restaurantUserId),

      db.from("fiscal_operations")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("restaurant_user_id", restaurantUserId)
        .eq("state", "unknown"),

      db.from("rc_external_delivery_inbox")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("restaurant_user_id", restaurantUserId)
        .in("processing_status", [
          "received",
          "needs_review",
        ]),
    ]);

    if (
      devicesResult.error ||
      fiscalUnknownResult.error ||
      externalReviewResult.error
    ) {
      console.error("INTEGRATION_STATUS_DB_ERROR", {
        fiscalDevices: devicesResult.error?.code,
        fiscalOperations: fiscalUnknownResult.error?.code,
        deliveryInbox: externalReviewResult.error?.code,
      });

      return respond(
        503,
        { error: "STATUS_UNAVAILABLE" },
        cors,
      );
    }

    return respond(
      200,
      {
        fiscal: {
          registeredDevices: devicesResult.count ?? 0,
          unknownOperations:
            fiscalUnknownResult.count ?? 0,

          // No equivalen a conexión física.
          connected: false,
          printingAuthorized: false,
        },

        delivery: {
          pendingReview:
            externalReviewResult.count ?? 0,

          providers: providers.map((id) => ({
            id,

            // No existen conectores oficiales
            // verificados en este servicio.
            connected: false,
          })),
        },

        payment: {
          // Este endpoint no inspecciona
          // la cuenta real de Stripe.
          stripeVerified: false,
          blikVerified: false,
        },

        operationalActionsEnabled: false,
      },
      cors,
    );
  } catch {
    console.error("INTEGRATION_STATUS_FAILURE");

    return respond(
      503,
      { error: "SERVICE_UNAVAILABLE" },
      cors,
    );
  }
});
