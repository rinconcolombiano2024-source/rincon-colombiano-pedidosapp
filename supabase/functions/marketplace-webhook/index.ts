import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeEqual(first: string, second: string) {
  if (first.length !== second.length) return false;
  let result = 0;
  for (let index = 0; index < first.length; index += 1) {
    result |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
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
  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
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
  return Array.from(new Uint8Array(digest))
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function paymentIntentReference(object: any) {
  if (typeof object?.payment_intent === "string") return object.payment_intent;
  if (typeof object?.payment_intent?.id === "string") return object.payment_intent.id;
  if (String(object?.object || "") === "payment_intent") return String(object?.id || "");
  return "";
}

async function resolveTransactionId(admin: any, object: any) {
  const metadataId = String(object?.metadata?.transaction_id || "");
  if (metadataId) return metadataId;

  if (String(object?.object || "") === "checkout.session" && object?.id) {
    const { data } = await admin.from("payment_transactions")
      .select("id")
      .eq("provider", "stripe_connect")
      .eq("provider_session_id", String(object.id))
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  const reference = paymentIntentReference(object);
  if (reference) {
    const { data } = await admin.from("payment_transactions")
      .select("id")
      .eq("provider", "stripe_connect")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }
  return "";
}

function succeededPaymentDetails(eventType: string, object: any) {
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(eventType)) {
    if (String(object?.payment_status || "").toLowerCase() !== "paid") return null;
    const amountMinor = Number(object?.amount_total);
    const currency = String(object?.currency || "").toUpperCase();
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;
    return {
      amount: amountMinor / 100,
      currency,
      sessionId: String(object?.id || ""),
      providerReference: paymentIntentReference(object),
    };
  }

  if (eventType === "payment_intent.succeeded") {
    if (String(object?.status || "").toLowerCase() !== "succeeded") return null;
    const amountMinor = Number(object?.amount_received);
    const currency = String(object?.currency || "").toUpperCase();
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;
    return {
      amount: amountMinor / 100,
      currency,
      sessionId: "",
      providerReference: String(object?.id || ""),
    };
  }
  return null;
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
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "Invalid payload" });
  }
  if (!event?.id || !event?.type) return json(400, { error: "Invalid event" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const eventRow = {
    provider: "stripe_connect",
    provider_event_id: String(event.id),
    event_type: String(event.type),
    payload_sha256: await sha256(rawBody),
    processing_status: "received",
  };

  let eventRecord: any = null;
  const insertedResult = await admin.from("payment_provider_events")
    .insert(eventRow)
    .select("id,processing_status,received_at")
    .maybeSingle();
  if (!insertedResult.error) {
    eventRecord = insertedResult.data;
  } else if (insertedResult.error.code === "23505") {
    const existingResult = await admin.from("payment_provider_events")
      .select("id,processing_status,received_at,payload_sha256")
      .eq("provider", "stripe_connect")
      .eq("provider_event_id", String(event.id))
      .maybeSingle();
    if (existingResult.error || !existingResult.data) return json(500, { error: "Could not read event" });
    if (existingResult.data.payload_sha256 && existingResult.data.payload_sha256 !== eventRow.payload_sha256) {
      return json(409, { error: "Event payload does not match" });
    }
    const isStale = Date.now() - new Date(existingResult.data.received_at).getTime() > 120_000;
    if (["processed", "ignored"].includes(existingResult.data.processing_status)) {
      return json(200, { received: true, duplicate: true });
    }
    if (existingResult.data.processing_status === "received" && !isStale) {
      return json(200, { received: true, processing: true });
    }
    const resetResult = await admin.from("payment_provider_events").update({
      processing_status: "received",
      error_message: "",
      processed_at: null,
    }).eq("id", existingResult.data.id).select("id,processing_status,received_at").single();
    if (resetResult.error) return json(500, { error: "Could not retry event" });
    eventRecord = resetResult.data;
  } else {
    return json(500, { error: "Could not register event" });
  }
  if (!eventRecord?.id) return json(500, { error: "Could not reserve event" });

  const markEvent = async (status: "processed" | "ignored" | "failed", errorMessage = "") => {
    await admin.from("payment_provider_events").update({
      processing_status: status,
      error_message: errorMessage.slice(0, 1000),
      processed_at: new Date().toISOString(),
    }).eq("id", eventRecord.id);
  };

  try {
    const object = event?.data?.object || {};
    const eventType = String(event.type);
    const transactionId = await resolveTransactionId(admin, object);
    const success = succeededPaymentDetails(eventType, object);

    if (success) {
      if (!transactionId || !success.providerReference) throw new Error("Payment transaction reference is missing");
      const result = await admin.rpc("rc_ordera_mark_payment_succeeded", {
        p_payment_transaction_id: transactionId,
        p_provider_session_id: success.sessionId,
        p_provider_reference: success.providerReference,
        p_amount: success.amount,
        p_currency: success.currency,
      });
      if (result.error) throw result.error;
      await markEvent("processed");
      return json(200, { received: true });
    }

    if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(eventType)) {
      await markEvent("ignored", "Payment is not final or has invalid financial fields");
      return json(200, { received: true, ignored: true });
    }

    if (["checkout.session.async_payment_failed", "payment_intent.payment_failed"].includes(eventType)) {
      if (!transactionId) throw new Error("Payment transaction reference is missing");
      const failure = await admin.rpc("rc_ordera_mark_payment_failed", {
        p_payment_transaction_id: transactionId,
        p_reason: String(object?.last_payment_error?.message || eventType),
      });
      if (failure.error) throw failure.error;
      await markEvent("processed");
      return json(200, { received: true });
    }

    if (eventType === "refund.updated" && String(object?.status || "") === "succeeded") {
      if (!transactionId) throw new Error("Refund payment transaction was not found");
const refund = await admin.rpc("rc_ordera_record_verified_refund", {
        p_payment_transaction_id: transactionId,
        p_provider_refund_id: String(object?.id || event.id),
        p_amount: Number(object?.amount || 0) / 100,
        p_currency: String(object?.currency || "").toUpperCase(),
      });
      if (refund.error) throw refund.error;
      await markEvent("processed");
      return json(200, { received: true });
    }

    if (eventType === "charge.refunded") {
      if (!transactionId) throw new Error("Refund payment transaction was not found");
      const refunds = Array.isArray(object?.refunds?.data) ? object.refunds.data : [];
      for (const entry of refunds) {
        if (String(entry?.status || "") !== "succeeded") continue;
     const refund = await admin.rpc("rc_ordera_record_verified_refund", {
          p_payment_transaction_id: transactionId,
          p_provider_refund_id: String(entry?.id || event.id),
          p_amount: Number(entry?.amount || 0) / 100,
          p_currency: String(entry?.currency || object?.currency || "").toUpperCase(),
        });
        if (refund.error) throw refund.error;
      }
      await markEvent("processed");
      return json(200, { received: true });
    }

    if (["charge.dispute.created", "charge.dispute.updated"].includes(eventType)) {
      if (!transactionId) throw new Error("Disputed payment transaction was not found");
      const hold = await admin.rpc("rc_ordera_hold_payment_for_dispute", {
        p_payment_transaction_id: transactionId,
        p_dispute_status: String(object?.status || "open"),
        p_reason: `Stripe dispute ${String(object?.id || "")}`,
      });
      if (hold.error) throw hold.error;
      await markEvent("processed");
      return json(200, { received: true });
    }

    await markEvent("ignored");
    return json(200, { received: true, ignored: true });
  } catch (error) {
    const errorMessage = String(error instanceof Error ? error.message : error);
    await markEvent("failed", errorMessage);
    return json(500, { error: "Event processing failed" });
  }
});
