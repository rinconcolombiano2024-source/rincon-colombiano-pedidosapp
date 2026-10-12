/**
 * Strict, READ-ONLY SumUp webhook verification component.
 * This module never updates an order, reports a fiscal sale or allocates funds.
 * A future server-side webhook route must do its own body-size limit, persisted
 * attempt lookup, transaction lock and idempotent ledger reconciliation.
 */
import { referenceForAttempt, retrieveSumUpCheckout } from "./sumup-hosted.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSumUpWebhookEvent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("SUMUP_WEBHOOK_INVALID");
  }
  // SumUp explicitly recommends ignoring future event types.
  if (raw.event_type !== "CHECKOUT_STATUS_CHANGED") return null;
  if (typeof raw.id !== "string" || !UUID.test(raw.id)) {
    throw new Error("SUMUP_WEBHOOK_INVALID_ID");
  }
  return { eventType: "CHECKOUT_STATUS_CHANGED", checkoutId: raw.id };
}

/**
 * lookupAttempt is a TRUSTED server-side read of a previously reserved attempt.
 * Expected record: {checkoutId, attempt:{orderId, attemptNumber, amountMinor,
 * currency:"PLN"}}. Never supply this record from the webhook or browser.
 * A VERIFIED result is NOT authorization to mark an order paid: the caller must
 * commit a single idempotent ledger transition under a DB transaction lock.
 */
export async function inspectSumUpWebhook(raw, lookupAttempt, config, fetchImpl = fetch) {
  const event = parseSumUpWebhookEvent(raw);
  if (!event) return { kind: "ignored" };
  if (typeof lookupAttempt !== "function") throw new Error("SUMUP_LEDGER_REQUIRED");
  const reserved = await lookupAttempt(event.checkoutId);
  if (!reserved) return { kind: "unknown_checkout" };
  if (reserved.checkoutId !== event.checkoutId || !reserved.attempt) {
    throw new Error("SUMUP_LEDGER_MISMATCH");
  }
  // Validate the database-reserved reference before making any network request.
  const reference = referenceForAttempt(reserved.attempt);
  const result = await retrieveSumUpCheckout(
    event.checkoutId,
    config,
    reserved.attempt,
    fetchImpl,
  );
  return {
    kind: "verified_only",
    checkoutId: result.id,
    orderId: reserved.attempt.orderId,
    checkoutReference: reference,
    providerStatus: result.status,
  };
}
