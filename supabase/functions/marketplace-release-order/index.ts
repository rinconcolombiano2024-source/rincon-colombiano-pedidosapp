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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return response(503, { error: "Service is not configured" });

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return response(401, { error: "Session expired" });

  let payload: { orderId?: string } = {};
  try { payload = await request.json(); } catch { return response(400, { error: "Invalid request" }); }
  if (!payload.orderId) return response(400, { error: "Order is required" });

  const { data: order } = await admin.from("customer_orders")
    .select("id,user_id,status")
    .eq("id", payload.orderId)
    .maybeSingle();
  if (!order) return response(404, { error: "Order was not found" });
  if (order.user_id !== user.id) return response(403, { error: "Not authorized" });
  if (order.status !== "delivered") return response(409, { error: "Order is not completed" });

  const now = new Date().toISOString();
  const { error: allocationError } = await admin.from("marketplace_payment_allocations")
    .update({ restaurant_release_eligible_at: now, updated_at: now })
    .eq("customer_order_id", order.id)
    .is("restaurant_release_eligible_at", null);
  if (allocationError) return response(500, { error: "Could not prepare settlement" });

  await fetch(`${supabaseUrl}/functions/v1/marketplace-settlement`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => null);

  return response(200, { settlementRequested: true });
});
