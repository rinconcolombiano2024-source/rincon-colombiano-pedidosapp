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
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/+$/, "");
 if (!supabaseUrl || !serviceKey) {
  return response(503, { error: "Backend is not configured" });
}
  let payload: { orderId?: string; publicToken?: string } = {};
  try { payload = await request.json(); } catch { return response(400, { error: "Invalid request" }); }
  if (!payload.orderId) return response(400, { error: "Order is required" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = accessToken ? await admin.auth.getUser(accessToken) : { data: { user: null } };
  const user = userData?.user || null;
const orderResult = await admin.from("customer_orders")
  .select("id,user_id,customer_user_id,status,total,currency,payment_method,payment_status,order_json")
  .eq("id", payload.orderId)
  .maybeSingle();

if (orderResult.error) {
  return response(500, { error: "Could not read order" });
}

const order = orderResult.data;

if (!order) {
  return response(404, { error: "Order was not found" });
}

const authenticatedCustomer =
  Boolean(
    user &&
    user.id === order.customer_user_id
  );

let tokenMatches = false;

const suppliedToken =
  String(payload.publicToken || "").trim();

if (
  !authenticatedCustomer &&
  suppliedToken.length >= 8
) {
  const tokenResult = await admin.rpc(
    "rc_ordera_customer_token_matches",
    {
      p_order_id: order.id,
      p_public_token: suppliedToken,
    }
  );

  if (tokenResult.error) {
    console.error(
      "marketplace-checkout token validation failed",
      tokenResult.error
    );

    return response(
      500,
      { error: "Could not validate order access" }
    );
  }

  tokenMatches =
    tokenResult.data === true;
}

if (
  !authenticatedCustomer &&
  !tokenMatches
) {
  return response(
    403,
    { error: "Not authorized" }
  );
}
  
  if (order.payment_status === "paid") return response(409, { error: "Order is already paid" });
  if (order.status !== "pending") return response(409, { error: "Order can no longer be paid online" });
  if (String(order.payment_method || "").toLowerCase() !== "online") {
    return response(409, { error: "Order was not created for online payment" });
  }
  if (!stripeKey || !appBaseUrl) {
  return response(
    503,
    { error: "Online payments are not configured" }
  );
}

  const restaurantResult = await admin.from("restaurant_profiles")
    .select("business_name,country_code")
    .eq("user_id", order.user_id).eq("active", true).is("deleted_at", null).maybeSingle();
  if (restaurantResult.error) return response(500, { error: "Could not read restaurant" });
  const restaurant = restaurantResult.data;
  if (!restaurant) {
    return response(409, { error: "Online payments are not enabled for this restaurant" });
  }

  const countryCode = String(restaurant.country_code || "").toUpperCase();
  const providerResult = await admin.from("marketplace_provider_availability")
    .select("provider,online_payments_enabled,marketplace_split_enabled")
    .eq("country_code", countryCode).maybeSingle();
  if (providerResult.error) return response(500, { error: "Could not read payment availability" });
  if (providerResult.data?.provider !== "stripe_connect"
      || !providerResult.data?.online_payments_enabled
      || !providerResult.data?.marketplace_split_enabled) {
    return response(409, { error: "Online marketplace payments are not available in this country" });
  }

  const settingsResult = await admin.from("app_settings")
    .select("settings")
    .eq("user_id", order.user_id).maybeSingle();
  if (settingsResult.error) return response(500, { error: "Could not read restaurant payment settings" });
  if (String(settingsResult.data?.settings?.onlinePaymentProvider || "disabled").toLowerCase() !== "stripe") {
    return response(409, { error: "Restaurant has not enabled online payments" });
  }

  const payoutResult = await admin.from("marketplace_accounts")
    .select("provider_account_id,onboarding_status,payouts_enabled,country_code,currency")
    .eq("owner_user_id", order.user_id).eq("account_type", "restaurant")
    .eq("provider", "stripe_connect").maybeSingle();
  if (payoutResult.error) return response(500, { error: "Could not read payout account" });
  const payoutAccount = payoutResult.data;
  if (!payoutAccount || payoutAccount.onboarding_status !== "complete" || !payoutAccount.payouts_enabled) {
    return response(409, { error: "Restaurant payout account is not ready" });
  }
  if (String(payoutAccount.country_code || "").toUpperCase() !== countryCode
      || String(payoutAccount.currency || "").toUpperCase() !== String(order.currency || "").toUpperCase()) {
    return response(409, { error: "Order currency does not match payout account" });
  }

  const { data: attempts, error: attemptsError } = await admin.from("payment_transactions")
    .select("id,checkout_url,expires_at,status,idempotency_key,created_at")
    .eq("customer_order_id", order.id)
    .eq("provider", "stripe_connect")
    .order("created_at", { ascending: false });
  if (attemptsError) return response(500, { error: "Could not read payment attempts" });
  const reusable = (attempts || []).find((attempt) =>
    attempt.status === "pending" && attempt.checkout_url
    && (!attempt.expires_at || new Date(attempt.expires_at) > new Date())
  );
  if (reusable) return response(200, { url: reusable.checkout_url, transactionId: reusable.id });

   const unfinishedAttempt = (attempts || []).find((attempt) =>
    attempt.status === "pending" && !attempt.checkout_url && attempt.idempotency_key
  );

  const attemptNumber = (attempts || []).length + 1;

  const idempotencyKey = unfinishedAttempt?.idempotency_key
    || `stripe-checkout:${order.id}:${attemptNumber}`;

  let transactionId = unfinishedAttempt?.id || crypto.randomUUID();

  const amountMinor = Math.round(Number(order.total) * 100);
  const currency = String(order.currency || "PLN").toLowerCase();
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return response(409, { error: "Invalid order total" });

if (!unfinishedAttempt) {
  const pendingAttempt = {
    id: transactionId,
    customer_order_id: order.id,
    provider: "stripe_connect",
    provider_reference: "",
    provider_session_id: "",
    payment_method: "online",
    status: "pending",
    amount: Number(order.total),
    currency: String(order.currency || "PLN").toUpperCase(),
    idempotency_key: idempotencyKey,
    checkout_url: "",
    transfer_group: `rc_ordera_${order.id}`,
    metadata: { restaurant_user_id: order.user_id, attempt: attemptNumber },
    updated_at: new Date().toISOString(),
  };
  const { data: reserved, error: reserveError } = await admin.from("payment_transactions")
    .insert(pendingAttempt).select("id").maybeSingle();
  if (reserveError) {
    if (reserveError.code !== "23505") return response(500, { error: "Could not reserve checkout" });
    const { data: concurrent } = await admin.from("payment_transactions")
      .select("id,checkout_url,expires_at")
      .eq("customer_order_id", order.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (!concurrent?.id) return response(409, { error: "Checkout is being prepared" });
    if (concurrent.checkout_url) return response(200, { url: concurrent.checkout_url, transactionId: concurrent.id });
    transactionId = concurrent.id;
  } else if (reserved?.id) {
    transactionId = reserved.id;
  }
}
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${appBaseUrl}/cliente.html?store=${encodeURIComponent(order.user_id)}&payment=success&order=${encodeURIComponent(order.id)}`,
    cancel_url: `${appBaseUrl}/cliente.html?store=${encodeURIComponent(order.user_id)}&payment=cancelled&order=${encodeURIComponent(order.id)}`,
    client_reference_id: order.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": currency,
    "line_items[0][price_data][unit_amount]": String(amountMinor),
    "line_items[0][price_data][product_data][name]": `${restaurant.business_name || "RC ORDERA"} - pedido`,
    "metadata[transaction_id]": transactionId,
    "metadata[customer_order_id]": order.id,
    "payment_intent_data[transfer_group]": `rc_ordera_${order.id}`,
    "payment_intent_data[metadata][transaction_id]": transactionId,
    "payment_intent_data[metadata][customer_order_id]": order.id,
  });
let stripeResult: Response;

try {
  stripeResult = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
} catch {
  // No sabemos si Stripe recibió/procesó la solicitud.
  // Conservamos pending y reutilizamos la misma idempotency key.
  await admin.from("payment_transactions").update({
    updated_at: new Date().toISOString(),
  }).eq("id", transactionId);

  return response(503, {
    error: "Payment provider response is pending. Retry safely.",
    retryable: true,
  });
}

let session: any = {};

try {
  session = await stripeResult.json();
} catch {
  session = {};
}

if (!stripeResult.ok) {
const stripeShouldRetry =
  stripeResult.headers.get("Stripe-Should-Retry");

const indeterminate =
  stripeShouldRetry === "true" ||
  (
    stripeShouldRetry !== "false" &&
    (
      stripeResult.status === 409 ||
      stripeResult.status === 429 ||
      stripeResult.status >= 500
    )
  );

  if (indeterminate) {
    // 429 / 5xx NO se marcan como failed.
    // Stripe puede haber procesado la operación.
    await admin.from("payment_transactions").update({
      updated_at: new Date().toISOString(),
    }).eq("id", transactionId);

    return response(503, {
      error:
        session?.error?.message ||
        "Payment provider response is pending. Retry safely.",
      retryable: true,
    });
  }

  // Solo errores definitivos 4xx pasan a failed.
  await admin.from("payment_transactions").update({
    status: "failed",
    failed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", transactionId);

  return response(502, {
    error:
      session?.error?.message ||
      "Payment provider error",
    retryable: false,
  });
}
  const { error } = await admin.from("payment_transactions").update({
    provider_session_id: session.id,
    status: "pending",
    checkout_url: session.url,
    expires_at: new Date(session.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", transactionId);
  if (error) return response(500, { error: "Could not persist checkout" });
  return response(200, { url: session.url, transactionId });
});
