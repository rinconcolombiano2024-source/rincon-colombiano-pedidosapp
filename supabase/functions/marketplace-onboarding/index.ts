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

async function stripeRequest(
  path: string,
  values: Record<string, string>,
  key: string,
  idempotencyKey = "",
) {
  const body = new URLSearchParams(values);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const result = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  const data = await result.json();

  if (!result.ok) {
    throw new Error(data?.error?.message || "Stripe request failed");
  }

  return data;
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/+$/, "");
  if (!supabaseUrl || !serviceKey || !stripeKey || !appBaseUrl) {
    return response(503, { error: "Marketplace payments are not configured" });
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return response(401, { error: "Session expired" });

  let payload: { accountType?: string; action?: string } = {};
  try { payload = await request.json(); } catch { return response(400, { error: "Invalid request" }); }
  const accountType = payload.accountType === "courier" ? "courier" : "restaurant";

  let countryCode = "";
  let currency = "";
  if (accountType === "restaurant") {
    const { data } = await admin.from("restaurant_profiles")
      .select("country_code")
      .eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    countryCode = String(data?.country_code || "").toUpperCase();
    currency = countryCode === "PL" ? "PLN" : countryCode === "CO" ? "COP" : "";
  } else {
    const { data } = await admin.from("courier_profiles")
      .select("country")
      .eq("user_id", user.id).eq("status", "approved").maybeSingle();
    countryCode = String(data?.country || "").toUpperCase().includes("POL") ? "PL" : String(data?.country || "").toUpperCase();
    currency = countryCode === "PL" ? "PLN" : "";
  }
  if (countryCode !== "PL") {
    return response(409, { error: "Online marketplace payouts are not enabled for this country" });
  }

  const { data: existing } = await admin.from("marketplace_accounts")
    .select("provider_account_id")
    .eq("owner_user_id", user.id).eq("account_type", accountType)
    .eq("provider", "stripe_connect").maybeSingle();

  let accountId = String(existing?.provider_account_id || "");
  if (!accountId) {
    const account = await stripeRequest("accounts", {
      type: "express",
      country: "PL",
      email: user.email || "",
      "capabilities[transfers][requested]": "true",
      "metadata[rc_ordera_user_id]": user.id,
      "metadata[account_type]": accountType,
    }, stripeKey, `rc-ordera-account:${user.id}:${accountType}`);
    accountId = account.id;
    const { error } = await admin.from("marketplace_accounts").upsert({
      owner_user_id: user.id,
      account_type: accountType,
      provider: "stripe_connect",
      country_code: countryCode,
      currency,
      provider_account_id: accountId,
      onboarding_status: "pending",
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_user_id,account_type,provider" });
    if (error) return response(500, { error: "Could not save payout account" });
  }

  const accountResult = await fetch(`https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  
  const accountState = await accountResult.json();
  if (!accountResult.ok) return response(502, { error: accountState?.error?.message || "Could not read payout account" });
  const onboardingStatus = accountState.details_submitted && accountState.payouts_enabled ? "complete" : "pending";
  await admin.from("marketplace_accounts").update({
    onboarding_status: onboardingStatus,
    charges_enabled: Boolean(accountState.charges_enabled),
    payouts_enabled: Boolean(accountState.payouts_enabled),
    details_submitted: Boolean(accountState.details_submitted),
    updated_at: new Date().toISOString(),
  }).eq("owner_user_id", user.id).eq("account_type", accountType).eq("provider", "stripe_connect");
  if (payload.action === "status" || onboardingStatus === "complete") {
    return response(200, {
      accountType,
      onboardingStatus,
      chargesEnabled: Boolean(accountState.charges_enabled),
      payoutsEnabled: Boolean(accountState.payouts_enabled),
    });
  }

  const returnPath = accountType === "restaurant" ? "restaurante.html?payments=return" : "colaborador.html?payments=return";
  const link = await stripeRequest("account_links", {
    account: accountId,
    refresh_url: `${appBaseUrl}/${returnPath}`,
    return_url: `${appBaseUrl}/${returnPath}`,
    type: "account_onboarding",
  }, stripeKey);
  return response(200, { url: link.url, accountType });
});
