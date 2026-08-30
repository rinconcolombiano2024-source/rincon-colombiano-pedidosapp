import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return response(503, { error: "Service is not configured" });

  let payload: { orderId?: string; publicToken?: string; actor?: string } = {};
  try { payload = await request.json(); } catch { return response(400, { error: "Invalid request" }); }
  if (!payload.orderId || !["customer", "courier"].includes(String(payload.actor || ""))) {
    return response(400, { error: "Invalid delivery confirmation" });
  }

  const authorization = request.headers.get("authorization") || `Bearer ${anonKey}`;
  const scopedClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await scopedClient.rpc("record_delivery_completion_confirmation", {
    p_customer_order_id: payload.orderId,
    p_public_token: String(payload.publicToken || ""),
    p_actor: payload.actor,
  });
  if (error) return response(403, { error: error.message || "Delivery confirmation was rejected" });

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.settlement_eligible === true) {
    await fetch(`${supabaseUrl}/functions/v1/marketplace-settlement`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
  }

  return response(200, {
    courierConfirmed: row?.courier_confirmed === true,
    customerConfirmed: row?.customer_confirmed === true,
    settlementEligible: row?.settlement_eligible === true,
  });
});
