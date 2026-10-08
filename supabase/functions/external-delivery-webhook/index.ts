
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

// RC ORDERA V91-42
// Adaptador interno HMAC para STAGING.
// NO implementa firmas oficiales de delivery.
// Desactivado por defecto.
// No crea ventas ni emite tickets fiscales.

const MAX_BYTES = 65536;
const MAX_AGE_SECONDS = 300;
const encoder = new TextEncoder();

function reply(status: number, code: string) {
  return new Response(JSON.stringify({ code }), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verify(
  secret: string,
  message: string,
  supplied: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(message),
    ),
  );

  const expected = hex(signed);
  const actual = supplied.toLowerCase();

  // Comparación sin salida anticipada por carácter.
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^
      actual.charCodeAt(i);
  }
  return difference === 0;
}

function validId(value: unknown, max = 160) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return reply(405, "METHOD_NOT_ALLOWED");
  }

  // Bloqueo absoluto hasta activar pruebas.
  if (
    Deno.env.get("RC_EXTERNAL_TEST_ENABLED") !== "true"
  ) {
    return reply(503, "CONNECTOR_DISABLED");
  }

  const secret = Deno.env.get(
    "RC_EXTERNAL_TEST_SECRET"
  ) || "";

  const restaurantId = Deno.env.get(
    "RC_EXTERNAL_TEST_RESTAURANT_ID"
  ) || "";

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) || "";

  if (
    secret.length < 32 ||
    !/^[0-9a-f-]{36}$/i.test(restaurantId) ||
    !url ||
    !serviceKey
  ) {
    return reply(503, "CONFIGURATION_INCOMPLETE");
  }

  const lengthHeader = Number(
    request.headers.get("content-length") || "0",
  );

  if (
    !Number.isFinite(lengthHeader) ||
    lengthHeader > MAX_BYTES
  ) {
    return reply(413, "BODY_TOO_LARGE");
  }

  const timestamp = request.headers.get(
    "x-rc-timestamp"
  ) || "";

  const signature = request.headers.get(
    "x-rc-signature"
  ) || "";

  if (!/^\d{10}$/.test(timestamp)) {
    return reply(401, "UNAUTHORIZED");
  }

  const timestampNumber = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);

  if (
    Math.abs(now - timestampNumber) >
    MAX_AGE_SECONDS
  ) {
    return reply(401, "UNAUTHORIZED");
  }

  let raw: string;

  try {
    // Limitar tamaño real del cuerpo recibido.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, "EMPTY_BODY");

    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return reply(413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    raw = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(combined);
  } catch {
    return reply(400, "INVALID_BODY");
  }

  // Firma interna de staging:
  // HMAC(secret, timestamp + "." + rawBody)
  const authorized = await verify(
    secret,
    `${timestamp}.${raw}`,
    signature,
  );

  if (!authorized) {
    return reply(401, "UNAUTHORIZED");
  }

  let input: Record<string, unknown>;

  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return reply(400, "INVALID_JSON");
    }
    input = parsed;
  } catch {
    return reply(400, "INVALID_JSON");
  }

  if (
    !validId(input.orderId) ||
    !validId(input.eventId) ||
    !validId(input.status, 80) ||
    !validId(input.eventType, 80)
  ) {
    return reply(400, "INVALID_IDENTIFIERS");
  }

  const currency = input.currency ?? "PLN";
  if (currency !== "PLN") {
    return reply(400, "UNSUPPORTED_CURRENCY");
  }

  const total = input.totalGrosz ?? null;
  if (
    total !== null &&
    (!Number.isSafeInteger(total) ||
      Number(total) < 0)
  ) {
    return reply(400, "INVALID_TOTAL");
  }

  const client = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { error } = await client.rpc(
      "rc_external_receive_atomic",
      {
        p_restaurant_user_id: restaurantId,
        p_platform: "rc_test",
        p_external_order_id: input.orderId,
        p_external_event_id: input.eventId,
        p_event_type: input.eventType,
        p_source_status: input.status,
        p_payload: input,
        p_currency: "PLN",
        p_total_grosz: total,
        p_source_created_at: null,
      },
    );

    if (error) {
      console.error("EXTERNAL_INGEST_FAILED", {
        code: error.code,
      });
      return reply(503, "INGEST_UNAVAILABLE");
    }

    return reply(202, "EVENT_ACCEPTED");
  } catch {
    return reply(503, "INGEST_UNAVAILABLE");
  }
});
