
import { createClient } from "npm:@supabase/supabase-js@2.117.1";

/**
 * RC ORDERA V91-45
 * EXTERNAL DELIVERY WEBHOOK - TEST ADAPTER
 *
 * - Solo plataforma rc_test.
 * - Desactivado por defecto.
 * - Firma HMAC-SHA256 obligatoria.
 * - Timestamp con tolerancia de 5 minutos.
 * - Cuerpo limitado a 64 KiB.
 * - Identidad del restaurante desde secretos.
 * - Registro atomico mediante V91-41.
 * - Clasificacion de duplicados y conciliacion.
 * - Sin operaciones fiscales.
 *
 * NO ES UN CONECTOR OFICIAL DE UBER, WOLT,
 * GLOVO NI BOLT.
 */

const MAX_BYTES = 65536;
const MAX_AGE_SECONDS = 300;
const encoder = new TextEncoder();

type RpcResult = {
  inbox_id: string;
  event_id: string;
  order_result: string;
  event_result: string;
};

function reply(
  status: number,
  code: string,
): Response {
  return new Response(JSON.stringify({ code }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
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

async function verifySignature(
  secret: string,
  message: string,
  signature: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

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

  const signed = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(message),
    ),
  );

  const expected = hex(signed);
  const actual = signature.toLowerCase();

  let difference = 0;

  for (let i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^
      actual.charCodeAt(i);
  }

  return difference === 0;
}

function validId(
  value: unknown,
  max = 160,
): value is string {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= max &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

async function readBody(
  request: Request,
): Promise<string | null> {
  const reader = request.body?.getReader();

  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    if (!value) continue;

    total += value.byteLength;

    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }

    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", {
    fatal: true,
  }).decode(buffer);
}

function classify(
  row: RpcResult,
): string | null {
  const orderResults = new Set([
    "created",
    "duplicate",
    "updated_needs_review",
    "reconciliation_required",
  ]);

  const eventResults = new Set([
    "created",
    "duplicate",
  ]);

  if (
    !validUuid(row.inbox_id) ||
    !validUuid(row.event_id) ||
    !orderResults.has(row.order_result) ||
    !eventResults.has(row.event_result)
  ) {
    return null;
  }

  if (
    row.order_result === "reconciliation_required" ||
    row.order_result === "updated_needs_review"
  ) {
    return "REVIEW_REQUIRED";
  }

  if (
    row.order_result === "duplicate" &&
    row.event_result === "duplicate"
  ) {
    return "EVENT_DUPLICATE";
  }

  if (
    row.order_result === "created" &&
    row.event_result === "created"
  ) {
    return "ORDER_RECEIVED";
  }

  return "EVENT_RECORDED";
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return reply(405, "METHOD_NOT_ALLOWED");
  }

  // Nunca activar accidentalmente.
  if (
    Deno.env.get("RC_EXTERNAL_TEST_ENABLED") !== "true"
  ) {
    return reply(503, "CONNECTOR_DISABLED");
  }

  const secret =
    Deno.env.get("RC_EXTERNAL_TEST_SECRET") || "";

  const restaurantId =
    Deno.env.get("RC_EXTERNAL_TEST_RESTAURANT_ID") ||
    "";

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") || "";

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";

  if (
    secret.length < 32 ||
    !validUuid(restaurantId) ||
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return reply(503, "CONFIGURATION_INCOMPLETE");
  }

  const timestamp =
    request.headers.get("x-rc-timestamp") || "";

  const signature =
    request.headers.get("x-rc-signature") || "";

  if (!/^\d{10}$/.test(timestamp)) {
    return reply(401, "UNAUTHORIZED");
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    Math.abs(now - Number(timestamp)) >
    MAX_AGE_SECONDS
  ) {
    return reply(401, "UNAUTHORIZED");
  }

  const contentLength =
    request.headers.get("content-length");

  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return reply(400, "INVALID_CONTENT_LENGTH");
    }

    if (Number(contentLength) > MAX_BYTES) {
      return reply(413, "BODY_TOO_LARGE");
    }
  }

  let raw: string;

  try {
    const body = await readBody(request);

    if (!body) {
      return reply(400, "EMPTY_BODY");
    }

    raw = body;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "BODY_TOO_LARGE"
    ) {
      return reply(413, "BODY_TOO_LARGE");
    }

    return reply(400, "INVALID_BODY");
  }

  let authorized = false;

  try {
    authorized = await verifySignature(
      secret,
      `${timestamp}.${raw}`,
      signature,
    );
  } catch {
    return reply(503, "SIGNATURE_SERVICE_UNAVAILABLE");
  }

  if (!authorized) {
    return reply(401, "UNAUTHORIZED");
  }

  let input: Record<string, unknown>;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isObject(parsed)) {
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

  if (
    input.currency !== undefined &&
    input.currency !== "PLN"
  ) {
    return reply(400, "UNSUPPORTED_CURRENCY");
  }

  const total = input.totalGrosz ?? null;

  if (
    total !== null &&
    (
      typeof total !== "number" ||
      !Number.isSafeInteger(total) ||
      total < 0
    )
  ) {
    return reply(400, "INVALID_TOTAL");
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

  try {
    const { data, error } = await client.rpc(
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
      console.error("RC_EXTERNAL_INGEST_FAILED", {
        code: error.code || "UNKNOWN",
      });

      // No confirmar un evento que no se pudo registrar.
      return reply(503, "INGEST_UNAVAILABLE");
    }

    if (!Array.isArray(data) || data.length !== 1) {
      return reply(503, "INVALID_RPC_RESPONSE");
    }

    const result = classify(data[0] as RpcResult);

    if (!result) {
      return reply(503, "INVALID_RPC_RESPONSE");
    }

    // 202 reconoce persistencia en la bandeja.
    // REVIEW_REQUIRED NO autoriza fiscalizacion
    // ni importacion automatica.
    return reply(202, result);
  } catch {
    return reply(503, "INGEST_UNAVAILABLE");
  }
});
