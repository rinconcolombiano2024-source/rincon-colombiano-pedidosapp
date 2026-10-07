import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const MAX_REQUEST_BODY_BYTES = 16_384;
const MAX_AUTHORIZATION_HEADER_LENGTH = 8_192;
const STRIPE_REQUEST_TIMEOUT_MS = 15_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const responseHeaders = {
  ...corsHeaders,
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

type AccountType = "restaurant" | "courier";
type OnboardingAction = "status" | "onboarding";

type OnboardingPayload = {
  accountType?: unknown;
  action?: unknown;
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function isStripeAccountId(value: string) {
  return /^acct_[A-Za-z0-9]+$/.test(value);
}

function isSafeStripeOnboardingUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "connect.stripe.com";
  } catch {
    return false;
  }
}

function normalizeAppBaseUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const localhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

    if (
      url.protocol !== "https:" &&
      !(localhost && url.protocol === "http:")
    ) {
      return "";
    }

    if (url.username || url.password || url.search || url.hash) {
      return "";
    }

    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (
    !authorization ||
    authorization.length > MAX_AUTHORIZATION_HEADER_LENGTH
  ) {
    return "";
  }

  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || "";
}

async function readJsonBodyLimited(
  request: Request,
): Promise<OnboardingPayload> {
  const declaredLength = Number(
    request.headers.get("content-length") || 0,
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BODY_BYTES
  ) {
    throw new RangeError("REQUEST_BODY_TOO_LARGE");
  }

  if (!request.body) {
    throw new SyntaxError("REQUEST_BODY_MISSING");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        try {
          await reader.cancel("REQUEST_BODY_TOO_LARGE");
        } catch {
          // Best effort.
        }
        throw new RangeError("REQUEST_BODY_TOO_LARGE");
      }

      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Best effort.
    }
  }

  const merged = new Uint8Array(totalBytes);
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

  return parsed as OnboardingPayload;
}

function normalizeCountryCode(value: unknown) {
  const country = String(value || "").trim().toUpperCase();

  if (country === "PL" || country.includes("POL")) return "PL";
  if (country === "CO" || country.includes("COL")) return "CO";

  return country;
}

async function stripeRequest(url: string, options: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    STRIPE_REQUEST_TIMEOUT_MS,
  );

  let result: Response;

  try {
    result = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("STRIPE_TIMEOUT");
    }
    throw new Error("STRIPE_UNREACHABLE");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await result.text();
  let data: any = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("STRIPE_INVALID_RESPONSE");
    }
  }

  if (!result.ok) {
    throw new Error("STRIPE_REQUEST_FAILED");
  }

  return data;
}

async function stripePost(
  path: string,
  values: Record<string, string>,
  key: string,
  idempotencyKey = "",
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  return await stripeRequest(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(values),
  });
}

async function stripeGetAccount(accountId: string, key: string) {
  return await stripeRequest(
    `https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  );
}

function validateStripeAccountOwnership(
  account: any,
  expectedAccountId: string,
  expectedUserId: string,
  expectedAccountType: AccountType,
) {
  const accountId = String(account?.id || "");
  const accountType = String(account?.type || "");
  const country = String(account?.country || "").toUpperCase();
  const metadataUserId = String(
    account?.metadata?.rc_ordera_user_id || "",
  );
  const metadataAccountType = String(
    account?.metadata?.account_type || "",
  );

  return (
    !account?.deleted &&
    accountId === expectedAccountId &&
    isStripeAccountId(accountId) &&
    accountType === "express" &&
    country === "PL" &&
    metadataUserId === expectedUserId &&
    metadataAccountType === expectedAccountType
  );
}

function accountStateFromStripe(account: any) {
  const detailsSubmitted = account?.details_submitted === true;
  const payoutsEnabled = account?.payouts_enabled === true;
  const chargesEnabled = account?.charges_enabled === true;
  const transfersEnabled =
    String(account?.capabilities?.transfers || "") === "active";
  const disabledReason = String(
    account?.requirements?.disabled_reason || "",
  ).trim();

  let onboardingStatus: "pending" | "restricted" | "complete" = "pending";

  if (disabledReason) {
    onboardingStatus = "restricted";
  } else if (
    detailsSubmitted &&
    payoutsEnabled &&
    transfersEnabled
  ) {
    onboardingStatus = "complete";
  }

  return {
    onboardingStatus,
    chargesEnabled,
    payoutsEnabled,
    transfersEnabled,
    detailsSubmitted,
    restricted: Boolean(disabledReason),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  const supabaseUrl = (
    Deno.env.get("SUPABASE_URL") || ""
  ).replace(/\/+$/, "");

  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const stripeKey =
    Deno.env.get("STRIPE_SECRET_KEY") || "";

  const appBaseUrl = normalizeAppBaseUrl(
    Deno.env.get("APP_BASE_URL") || "",
  );

  if (!supabaseUrl || !serviceKey || !stripeKey || !appBaseUrl) {
    return response(503, {
      error: "Marketplace payments are not configured",
    });
  }

  const token = readBearerToken(request);

  if (!token) {
    return response(401, { error: "Session expired" });
  }

  let payload: OnboardingPayload;

  try {
    payload = await readJsonBodyLimited(request);
  } catch (error) {
    if (
      error instanceof RangeError &&
      error.message === "REQUEST_BODY_TOO_LARGE"
    ) {
      return response(413, { error: "Request body is too large" });
    }

    return response(400, { error: "Invalid request" });
  }

  const requestedAccountType = String(
    payload.accountType || "",
  ).trim().toLowerCase();

  const requestedAction = String(
    payload.action || "",
  ).trim().toLowerCase();

  if (
    !["restaurant", "courier"].includes(requestedAccountType) ||
    !["status", "onboarding"].includes(requestedAction)
  ) {
    return response(400, { error: "Invalid onboarding request" });
  }

  const accountType = requestedAccountType as AccountType;
  const action = requestedAction as OnboardingAction;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: userData,
    error: userError,
  } = await admin.auth.getUser(token);

  const user = userData?.user || null;

  if (userError || !user) {
    return response(401, { error: "Session expired" });
  }

  let countryCode = "";
  let currency = "";

  if (accountType === "restaurant") {
    const profileResult = await admin
      .from("restaurant_profiles")
      .select("country_code")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (profileResult.error) {
      return response(500, {
        error: "Could not read restaurant profile",
      });
    }

    if (!profileResult.data) {
      return response(404, {
        error: "Restaurant profile was not found",
      });
    }

    countryCode = normalizeCountryCode(
      profileResult.data.country_code,
    );
  } else {
    const profileResult = await admin
      .from("courier_profiles")
      .select("country,status")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();

    if (profileResult.error) {
      return response(500, {
        error: "Could not read courier profile",
      });
    }

    if (!profileResult.data) {
      return response(403, {
        error: "Courier is not approved for payouts",
      });
    }

    countryCode = normalizeCountryCode(
      profileResult.data.country,
    );
  }

  if (countryCode !== "PL") {
    return response(409, {
      error: "Online marketplace payouts are not enabled for this country",
    });
  }

  currency = "PLN";

  const providerResult = await admin
    .from("marketplace_provider_availability")
    .select(
      "provider,online_payments_enabled,marketplace_split_enabled",
    )
    .eq("country_code", countryCode)
    .maybeSingle();

  if (providerResult.error) {
    return response(500, {
      error: "Could not read payment availability",
    });
  }

  if (
    providerResult.data?.provider !== "stripe_connect" ||
    !providerResult.data?.online_payments_enabled ||
    !providerResult.data?.marketplace_split_enabled
  ) {
    return response(409, {
      error: "Online marketplace payments are not available in this country",
    });
  }

  const existingResult = await admin
    .from("marketplace_accounts")
    .select("id,provider_account_id")
    .eq("owner_user_id", user.id)
    .eq("account_type", accountType)
    .eq("provider", "stripe_connect")
    .maybeSingle();

  if (existingResult.error) {
    return response(500, {
      error: "Could not read payout account",
    });
  }

  let accountId = String(
    existingResult.data?.provider_account_id || "",
  ).trim();

  /*
   * Consultar estado NO debe crear una cuenta Stripe.
   * La creación ocurre únicamente tras una acción explícita
   * de onboarding del usuario.
   */
  if (!accountId && action === "status") {
    return response(200, {
      accountType,
      onboardingStatus: "not_started",
      chargesEnabled: false,
      payoutsEnabled: false,
      transfersEnabled: false,
      detailsSubmitted: false,
      restricted: false,
    });
  }

  if (accountId && !isStripeAccountId(accountId)) {
    return response(409, {
      error: "Stored payout account is invalid",
      code: "PAYOUT_ACCOUNT_INVALID",
    });
  }

  if (!accountId) {
    let account: any;

    try {
      account = await stripePost(
        "accounts",
        {
          type: "express",
          country: "PL",
          email: user.email || "",
          "capabilities[transfers][requested]": "true",
          "metadata[rc_ordera_user_id]": user.id,
          "metadata[account_type]": accountType,
        },
        stripeKey,
        `rc-ordera-account:${user.id}:${accountType}`,
      );
    } catch {
      return response(503, {
        error: "Could not create payout account",
      });
    }

    accountId = String(account?.id || "").trim();

    if (
      !validateStripeAccountOwnership(
        account,
        accountId,
        user.id,
        accountType,
      )
    ) {
      return response(502, {
        error: "Invalid payout account response",
      });
    }

    const upsertResult = await admin
      .from("marketplace_accounts")
      .upsert(
        {
          owner_user_id: user.id,
          account_type: accountType,
          provider: "stripe_connect",
          country_code: countryCode,
          currency,
          provider_account_id: accountId,
          onboarding_status: "pending",
          charges_enabled: Boolean(account?.charges_enabled),
          payouts_enabled: Boolean(account?.payouts_enabled),
          details_submitted: Boolean(account?.details_submitted),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "owner_user_id,account_type,provider",
        },
      )
      .select("id,provider_account_id")
      .maybeSingle();

    if (
      upsertResult.error ||
      !upsertResult.data ||
      String(upsertResult.data.provider_account_id || "") !== accountId
    ) {
      return response(500, {
        error: "Could not save payout account",
      });
    }
  }

  let accountState: any;

  try {
    accountState = await stripeGetAccount(
      accountId,
      stripeKey,
    );
  } catch {
    return response(503, {
      error: "Could not reach payout provider",
    });
  }

  if (
    !validateStripeAccountOwnership(
      accountState,
      accountId,
      user.id,
      accountType,
    )
  ) {
    return response(409, {
      error: "Payout account ownership could not be verified",
      code: "PAYOUT_ACCOUNT_OWNERSHIP_MISMATCH",
    });
  }

  const state = accountStateFromStripe(accountState);

  const accountUpdateResult = await admin
    .from("marketplace_accounts")
    .update({
      onboarding_status: state.onboardingStatus,
      charges_enabled: state.chargesEnabled,
      payouts_enabled: state.payoutsEnabled,
      details_submitted: state.detailsSubmitted,
      country_code: countryCode,
      currency,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", user.id)
    .eq("account_type", accountType)
    .eq("provider", "stripe_connect")
    .eq("provider_account_id", accountId)
    .select("id")
    .maybeSingle();

  if (
    accountUpdateResult.error ||
    !accountUpdateResult.data
  ) {
    return response(409, {
      error: "Payout account changed while being verified",
      code: "PAYOUT_ACCOUNT_CHANGED",
      retryable: true,
    });
  }

  if (
    action === "status" ||
    state.onboardingStatus === "complete"
  ) {
    return response(200, {
      accountType,
      ...state,
    });
  }

  const returnPath =
    accountType === "restaurant"
      ? "restaurante.html?payments=return"
      : "colaborador.html?payments=return";

  const returnUrl = new URL(
    returnPath,
    `${appBaseUrl}/`,
  ).toString();

  let link: any;

  try {
    link = await stripePost(
      "account_links",
      {
        account: accountId,
        refresh_url: returnUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      },
      stripeKey,
    );
  } catch {
    return response(503, {
      error: "Could not create payout onboarding link",
    });
  }

  const linkUrl = String(link?.url || "").trim();
  const expiresAt = Number(link?.expires_at);

  if (
    !isSafeStripeOnboardingUrl(linkUrl) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return response(502, {
      error: "Invalid payout onboarding link",
    });
  }

  return response(200, {
    url: linkUrl,
    accountType,
    onboardingStatus: state.onboardingStatus,
    payoutsEnabled: state.payoutsEnabled,
    transfersEnabled: state.transfersEnabled,
    expiresAt,
  });
});
