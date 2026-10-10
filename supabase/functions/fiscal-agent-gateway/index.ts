// Pasarela del agente fiscal local. El PC del restaurante NUNCA recibe la service_role key:
// se autentica con un token propio por dispositivo (solo se guarda su SHA-256 en fiscal_devices).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { safeEqual } from "../_shared/safe-equal.ts";

const MAX_BYTES = 32 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIM_TOKEN = /^[0-9a-f]{64}$/;

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (Deno.env.get("RC_FISCAL_AGENT_ENABLED") !== "test") return reply(503, { error: "FISCAL_GATEWAY_DISABLED" });
  if (request.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return reply(503, { error: "CONFIGURATION_INCOMPLETE" });

  const deviceId = request.headers.get("x-device-id") || "";
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!UUID.test(deviceId) || (token.length < 32 || token.length > 512)) return reply(401, { error: "UNAUTHORIZED" });

  const len = request.headers.get("content-length");
  if (len !== null && (!/^\d+$/.test(len) || Number(len) > MAX_BYTES)) return reply(413, { error: "BODY_TOO_LARGE" });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) return reply(413, { error: "BODY_TOO_LARGE" });
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed;
  } catch {
    return reply(400, { error: "INVALID_JSON" });
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: device, error: deviceError } = await admin
    .from("fiscal_devices")
    .select("id, restaurant_user_id, enabled, environment, driver_id, agent_token_hash")
    .eq("id", deviceId)
    .maybeSingle();

  // Misma respuesta para dispositivo inexistente, sin token o token incorrecto.
  const tokenHash = await sha256Hex(token);
  if (
    deviceError || !device || !device.enabled || device.environment !== "test" || device.driver_id !== "mock" || !device.agent_token_hash ||
    !safeEqual(String(device.agent_token_hash), tokenHash)
  ) {
    return reply(401, { error: "UNAUTHORIZED" });
  }

  const action = String(body.action ?? "");
  const claimToken = String(body.claimToken ?? "");
  if (!CLAIM_TOKEN.test(claimToken)) return reply(400, { error: "INVALID_CLAIM_TOKEN" });
  const claimHash = await sha256Hex(claimToken);

  try {
    if (action === "claim") {
      const { data, error } = await admin.rpc("rc_fiscal_claim_next", {
        p_restaurant_user_id: device.restaurant_user_id,
        p_device_id: device.id,
        p_claim_token_hash: claimHash,
      });
      if (error) return reply(409, { error: "CLAIM_FAILED" });
      const row = Array.isArray(data) ? data[0] : data;
      if (row && row.fiscal_payload?.restaurantId !== device.restaurant_user_id) return reply(409, { error: "PAYLOAD_TENANT_MISMATCH" });
      return reply(200, row ? { operation: row } : { operation: null });
    }

    const operationId = String(body.operationId ?? "");
    if (!UUID.test(operationId)) return reply(400, { error: "INVALID_OPERATION_ID" });

    if (action === "sending") {
      const { error } = await admin.rpc("rc_fiscal_mark_sending", {
        p_operation_id: operationId, p_device_id: device.id, p_claim_token_hash: claimHash,
      });
      return error ? reply(409, { error: "SENDING_REJECTED" }) : reply(200, { ok: true });
    }

    if (action === "result") {
      const outcome = String(body.outcome ?? "");
      const result = body.result ?? {};
      if (!["confirmed", "failed", "unknown"].includes(outcome)) return reply(400, { error: "INVALID_OUTCOME" });
      if (result === null || typeof result !== "object" || Array.isArray(result)) return reply(400, { error: "INVALID_RESULT" });
      const { error } = await admin.rpc("rc_fiscal_record_result", {
        p_operation_id: operationId, p_device_id: device.id, p_claim_token_hash: claimHash,
        p_outcome: outcome, p_result: result,
      });
      return error ? reply(409, { error: "RESULT_REJECTED" }) : reply(200, { ok: true });
    }

    return reply(400, { error: "UNKNOWN_ACTION" });
  } catch {
    return reply(500, { error: "INTERNAL_ERROR" });
  }
});
