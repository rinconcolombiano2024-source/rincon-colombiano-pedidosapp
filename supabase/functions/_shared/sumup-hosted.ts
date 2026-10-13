/**
 * SumUp Hosted Checkout transport for a FUTURE RC ORDERA payment provider.
 *
 * Intentionally not wired into checkout routes or financial ledgers. A caller
 * must first reserve one immutable payment attempt in the database, validate
 * customer ownership, enforce unique references and handle asynchronous
 * reconciliation. Do not switch existing Stripe Connect settlement to SumUp.
 *
 * No environment variables or secrets are read by this module.
 */
export type SumUpStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export interface SumUpConfig {
  readonly apiKey: string;
  readonly merchantCode: string;
  readonly appOrigin: string;
  readonly webhookUrl?: string;
}

export interface SumUpAttempt {
  readonly orderId: string;
  readonly attemptNumber: number;
  readonly amountMinor: number;
  readonly currency: "PLN";
}

export interface SumUpCheckout {
  readonly id: string;
  readonly checkoutReference: string;
  readonly hostedUrl: string;
  readonly status: SumUpStatus;
}

export interface SumUpVerifiedStatus {
  readonly id: string;
  readonly status: SumUpStatus;
  readonly paid: boolean;
}

export const SUMUP_API_ORIGIN = "https://api.sumup.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AMOUNT_MINOR = 100_000_000;

function fail(): never {
  throw new Error("SUMUP_CHECKOUT_UNVERIFIED");
}

function checkConfig(config: SumUpConfig): string {
  if (
    !config.apiKey ||
    config.apiKey.trim() !== config.apiKey ||
    !/^[A-Za-z0-9]{6,32}$/.test(config.merchantCode)
  ) {
    fail();
  }

  let url: URL;
  try {
    url = new URL(config.appOrigin);
  } catch {
    return fail();
  }
  if (
    url.protocol !== "https:" ||
    url.username || url.password || url.search || url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    fail();
  }
  if (config.webhookUrl !== undefined) {
    let callback: URL;
    try { callback = new URL(config.webhookUrl); }
    catch { return fail(); }
    if (callback.protocol !== "https:" ||
        !/^[a-z0-9]{20}\.supabase\.co$/.test(callback.hostname) ||
        callback.pathname !== "/functions/v1/sumup-webhook" ||
        callback.username || callback.password || callback.search || callback.hash || callback.port) {
      fail();
    }
  }
  return url.origin;
}

export function referenceForAttempt(attempt: SumUpAttempt): string {
  if (
    !UUID.test(attempt.orderId) ||
    !Number.isSafeInteger(attempt.attemptNumber) ||
    attempt.attemptNumber < 1 ||
    attempt.attemptNumber > 999_999 ||
    !Number.isSafeInteger(attempt.amountMinor) ||
    attempt.amountMinor < 1 ||
    attempt.amountMinor > MAX_AMOUNT_MINOR ||
    attempt.currency !== "PLN"
  ) {
    fail();
  }
  // DB-reserved monotonically increasing attempt; never a browser-generated ref.
  return `rc-${attempt.orderId.toLowerCase()}-${attempt.attemptNumber}`;
}

export function isTrustedSumUpHostedUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    const match = /^\/pay\/([^/]+)\/?$/.exec(url.pathname);
    return url.protocol === "https:" &&
      url.hostname === "checkout.sumup.com" &&
      !url.username && !url.password &&
      !url.port && !url.search && !url.hash &&
      Boolean(match) && UUID.test(match?.[1] ?? "");
  } catch {
    return false;
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail();
  }
  return value as Record<string, unknown>;
}

function verifyCore(
  raw: unknown,
  config: SumUpConfig,
  attempt: SumUpAttempt,
): { id: string; status: SumUpStatus; body: Record<string, unknown> } {
  const body = object(raw);
  const reference = referenceForAttempt(attempt);
  const id = body["id"];
  const status = body["status"];
  if (
    typeof id !== "string" || !UUID.test(id) ||
    body["merchant_code"] !== config.merchantCode ||
    body["checkout_reference"] !== reference ||
    body["currency"] !== "PLN" ||
    typeof body["amount"] !== "number" ||
    !Number.isFinite(body["amount"]) ||
    exactProviderMinorAmount(body["amount"]) !== attempt.amountMinor ||
    !["PENDING", "PAID", "FAILED", "EXPIRED"].includes(String(status))
  ) {
    fail();
  }
  return { id, status: status as SumUpStatus, body };
}

// Compare exact decimal cents, not a floating-point epsilon. Provider JSON uses
// numbers, so accept only a canonical decimal representation with <=2 decimals.
function exactProviderMinorAmount(amount: number): number {
  const match = /^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) return fail();
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  if (minor < 1n || minor > BigInt(MAX_AMOUNT_MINOR)) return fail();
  return Number(minor);
}

export function verifyHostedCheckout(
  raw: unknown,
  config: SumUpConfig,
  attempt: SumUpAttempt,
): SumUpCheckout {
  const { id, status, body } = verifyCore(raw, config, attempt);
  const hostedUrl = body["hosted_checkout_url"];
  if (
    status !== "PENDING" ||
    !isTrustedSumUpHostedUrl(hostedUrl) ||
    object(body["hosted_checkout"])["enabled"] !== true
  ) {
    fail();
  }
  return {
    id,
    status,
    checkoutReference: referenceForAttempt(attempt),
    hostedUrl,
  };
}

export function verifyRetrievedCheckout(
  raw: unknown,
  checkoutId: string,
  config: SumUpConfig,
  attempt: SumUpAttempt,
): SumUpVerifiedStatus {
  if (!UUID.test(checkoutId)) {
    fail();
  }
  const verified = verifyCore(raw, config, attempt);
  if (verified.id !== checkoutId) {
    fail();
  }
  // PAID here is necessary, but only the transactional database reconciliation
  // worker may transition the matching order to paid after checking its ledger.
  return { id: verified.id, status: verified.status, paid: verified.status === "PAID" };
}

async function responseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error("SUMUP_API_UNAVAILABLE");
  }
  try {
    return await response.json() as unknown;
  } catch {
    return fail();
  }
}

/**
 * This transport has no public API route, no order writes and no automatic
 * retries: SumUp creation must not be retried without checking the saved
 * payment attempt and provider checkout first.
 */
export async function createSumUpHostedCheckout(
  config: SumUpConfig,
  attempt: SumUpAttempt,
  fetchImpl: typeof fetch = fetch,
): Promise<SumUpCheckout> {
  const appOrigin = checkConfig(config);
  const checkoutReference = referenceForAttempt(attempt);
  const response = await fetchImpl(`${SUMUP_API_ORIGIN}/v0.1/checkouts`, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merchant_code: config.merchantCode,
      checkout_reference: checkoutReference,
      amount: attempt.amountMinor / 100,
      currency: "PLN",
      description: `RC ORDERA ${attempt.orderId.slice(0, 8)}`,
      redirect_url: `${appOrigin}/cliente.html`,
      ...(config.webhookUrl ? { return_url: config.webhookUrl } : {}),
      hosted_checkout: { enabled: true },
    }),
  });
  return verifyHostedCheckout(await responseJson(response), config, attempt);
}

export async function retrieveSumUpCheckout(
  checkoutId: string,
  config: SumUpConfig,
  attempt: SumUpAttempt,
  fetchImpl: typeof fetch = fetch,
): Promise<SumUpVerifiedStatus> {
  checkConfig(config);
  referenceForAttempt(attempt);
  if (!UUID.test(checkoutId)) {
    fail();
  }
  const response = await fetchImpl(
    `${SUMUP_API_ORIGIN}/v0.1/checkouts/${encodeURIComponent(checkoutId)}`,
    {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${config.apiKey}` },
    },
  );
  return verifyRetrievedCheckout(await responseJson(response), checkoutId, config, attempt);
}

/** Read-only recovery by the DATABASE reference, never a second creation POST.
 * Zero or multiple results cannot authorize retry. A caller must bind and apply
 * the verified result transactionally in the same persisted ledger.
 */
export async function findSumUpCheckoutForAttempt(
  config: SumUpConfig, attempt: SumUpAttempt, fetchImpl: typeof fetch = fetch,
): Promise<{ checkoutId: string; providerStatus: SumUpStatus; hostedUrl: string | null } | null> {
  checkConfig(config);
  const reference = referenceForAttempt(attempt);
  const url = new URL(`${SUMUP_API_ORIGIN}/v0.1/checkouts`);
  url.searchParams.set("checkout_reference", reference);
  const options = () => ({ method: "GET", redirect: "error" as const, cache: "no-store" as const,
    signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${config.apiKey}` } });
  const candidates = await responseJson(await fetchImpl(url.toString(), options()));
  if (!Array.isArray(candidates) || candidates.length > 1) throw new Error("SUMUP_AMBIGUOUS_CHECKOUT");
  if (candidates.length === 0) return null;
  const candidate = verifyCore(candidates[0], config, attempt);
  const detail = await responseJson(await fetchImpl(
    `${SUMUP_API_ORIGIN}/v0.1/checkouts/${encodeURIComponent(candidate.id)}`, options()));
  const verified = verifyRetrievedCheckout(detail, candidate.id, config, attempt);
  return { checkoutId: verified.id, providerStatus: verified.status,
    hostedUrl: verified.status === "PENDING" ? verifyHostedCheckout(detail, config, attempt).hostedUrl : null };
}
