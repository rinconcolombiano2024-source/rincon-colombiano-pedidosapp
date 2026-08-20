import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeEqual(first: string, second: string) {
  if (first.length !== second.length) return false;
  let result = 0;
  for (let index = 0; index < first.length; index += 1) result |= first.charCodeAt(index) ^ second.charCodeAt(index);
  return result === 0;
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1] || "";
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((signature) => safeEqual(signature, expected));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!supabaseUrl || !serviceKey || !webhookSecret) return json(503, { error: "Webhook is not configured" });

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) return json(400, { error: "Invalid signature" });
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json(400, { error: "Invalid payload" }); }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const eventRow = {
    provider: "stripe_connect",
    provider_event_id: String(event.id || ""),
    event_type: String(event.type || ""),
    payload_sha256: await sha256(rawBody),
    processing_status: "received",
  };
  const { data: inserted, error: eventError } = await admin.from("payment_provider_events")
    .upsert(eventRow, { onConflict: "provider,provider_event_id", ignoreDuplicates: true })
    .select("id,processing_status").maybeSingle();
  if (eventError) return json(500, { error: "Could not register event" });
  if (!inserted) return json(200, { received: true, duplicate: true });

  try {
    const object = event?.data?.object || {};
    const transactionId = String(object?.metadata?.transaction_id || "");
    if (!transactionId) {
      await admin.from("payment_provider_events").update({ processing_status: "ignored", processed_at: new Date().toISOString() }).eq("id", inserted.id);
      return json(200, { received: true, ignored: true });
    }

    if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(event.type)) {
      const providerReference = String(object.payment_intent || object.id || "");
      const now = new Date().toISOString();
      const { data: payment, error } = await admin.from("payment_transactions").update({
        status: "paid",
        provider_reference: providerReference,
        paid_at: now,
        updated_at: now,
      }).eq("id", transactionId).select("id,customer_order_id").single();
      if (error) throw error;
      await admin.from("customer_orders").update({
        payment_status: "paid",
        payment_provider: "stripe_connect",
        provider_reference: providerReference,
        paid_at: now,
        updated_at: now,
      }).eq("id", payment.customer_order_id);
      const allocation = await admin.rpc("rc_ordera_calculate_marketplace_allocation", { p_payment_transaction_id: transactionId });
      if (allocation.error) throw allocation.error;
      await fetch(`${supabaseUrl}/functions/v1/marketplace-settlement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => null);
    } else if (["checkout.session.async_payment_failed", "payment_intent.payment_failed"].includes(event.type)) {
      await admin.from("payment_transactions").update({
        status: "failed", failed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", transactionId);
    }
    await admin.from("payment_provider_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("id", inserted.id);
    return json(200, { received: true });
  } catch (error) {
    await admin.from("payment_provider_events").update({
      processing_status: "failed",
      error_message: String(error instanceof Error ? error.message : error).slice(0, 1000),
      processed_at: new Date().toISOString(),
    }).eq("id", inserted.id);
    return json(500, { error: "Event processing failed" });
  }
});
