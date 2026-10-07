import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const MAX_REQUEST_BODY_BYTES = 16_384;
const MAX_AUTHORIZATION_HEADER_LENGTH = 8_192;
const MAX_PUBLIC_TOKEN_LENGTH = 512;
const SETTLEMENT_REQUEST_TIMEOUT_MS = 10_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseHeaders = {
  ...corsHeaders,
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

type ConfirmPayload = {
  orderId?: unknown;
  publicToken?: unknown;
  actor?: unknown;
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isBearerAuthorization(value: string) {
  return /^Bearer\s+\S+$/i.test(value);
}

async function readJsonBodyLimited(request: Request): Promise<ConfirmPayload> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    throw new Error("REQUEST_BODY_TOO_LARGE");
  }
  if (!request.body) throw new SyntaxError("REQUEST_BODY_MISSING");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        try { await reader.cancel("REQUEST_BODY_TOO_LARGE"); } catch {}
        throw new Error("REQUEST_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(merged);
  } catch {
    throw new SyntaxError("REQUEST_BODY_INVALID_UTF8");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SyntaxError("REQUEST_BODY_INVALID_JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SyntaxError("REQUEST_BODY_INVALID_JSON");
  }
  return parsed as ConfirmPayload;
}

function normalizeRpcRow(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.courier_confirmed !== "boolean" ||
    typeof candidate.customer_confirmed !== "boolean" ||
    typeof candidate.settlement_eligible !== "boolean"
  ) return null;
  return {
    courierConfirmed: candidate.courier_confirmed,
    customerConfirmed: candidate.customer_confirmed,
    settlementEligible: candidate.settlement_eligible,
  };
}

async function requestSettlement(
  supabaseUrl: string,
  serviceKey: string,
  settlementSecret: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SETTLEMENT_REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (settlementSecret.length >= 24) {
    headers["x-rc-ordera-settlement-secret"] = settlementSecret;
  } else {
    headers.Authorization = `Bearer ${serviceKey}`;
  }

  try {
    const result = await fetch(`${supabaseUrl}/functions/v1/marketplace-settlement`, {
      method: "POST",
      headers,
      body: "{}",
      signal: controller.signal,
    });
    return result.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const settlementSecret = Deno.env.get("PAYMENT_SETTLEMENT_SECRET") || "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return response(503, { error: "Service is not configured" });
  }

  let payload: ConfirmPayload;
  try {
    payload = await readJsonBodyLimited(request);
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_BODY_TOO_LARGE") {
      return response(413, { error: "Request body is too large" });
    }
    return response(400, { error: "Invalid request" });
  }

  const orderId = String(payload.orderId || "").trim();
  const actor = String(payload.actor || "").trim().toLowerCase();
  const suppliedToken = String(payload.publicToken || "").trim();

  if (
    !isUuid(orderId) ||
    !["customer", "courier"].includes(actor) ||
    suppliedToken.length > MAX_PUBLIC_TOKEN_LENGTH
  ) {
    return response(400, { error: "Invalid delivery confirmation" });
  }

  const rawAuthorization = request.headers.get("authorization") || "";
  if (rawAuthorization.length > MAX_AUTHORIZATION_HEADER_LENGTH) {
    return response(401, { error: "Unauthorized" });
  }
  if (rawAuthorization && !isBearerAuthorization(rawAuthorization)) {
    return response(401, { error: "Unauthorized" });
  }

  if (actor === "courier" && !rawAuthorization) {
    return response(401, { error: "Unauthorized" });
  }
  if (actor === "customer" && !rawAuthorization && suppliedToken.length < 8) {
    return response(401, { error: "Unauthorized" });
  }

  const authorization = rawAuthorization || `Bearer ${anonKey}`;
  const scopedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await scopedClient.rpc("record_delivery_completion_confirmation", {
    p_customer_order_id: orderId,
    p_public_token: actor === "customer" ? suppliedToken : "",
    p_actor: actor,
  });

  if (error) {
    console.error("marketplace-confirm-delivery rejected", {
      code: error.code || "",
      orderId,
      actor,
    });
    return response(403, { error: "Delivery confirmation was rejected" });
  }

  const normalized = normalizeRpcRow(data);
  if (!normalized) {
    console.error("marketplace-confirm-delivery invalid RPC response", { orderId, actor });
    return response(502, { error: "Delivery confirmation could not be verified" });
  }

  let settlementRequested = false;
  if (normalized.settlementEligible) {
    settlementRequested = await requestSettlement(
      supabaseUrl,
      serviceKey,
      settlementSecret,
    );
    if (!settlementRequested) {
      console.error("marketplace-confirm-delivery settlement trigger failed", { orderId });
    }
  }

  return response(200, {
    courierConfirmed: normalized.courierConfirmed,
    customerConfirmed: normalized.customerConfirmed,
    settlementEligible: normalized.settlementEligible,
    settlementRequested,
  });
});
