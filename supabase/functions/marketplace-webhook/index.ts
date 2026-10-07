import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const MAX_WEBHOOK_BODY_BYTES = 1_048_576; // 1 MiB
const MAX_STRIPE_SIGNATURE_HEADER_LENGTH = 8_192;
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;
const EVENT_LEASE_MS = 120_000;
const REFUND_REVERSAL_TRIGGER_TIMEOUT_MS = 120_000;

type EventProcessingStatus = "processed" | "ignored" | "failed";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
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

async function hmacHex(
  secret: string,
  message: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );

  return Array.from(
    new Uint8Array(signature),
  )
    .map(
      (value) =>
        value
          .toString(16)
          .padStart(2, "0"),
    )
    .join("");
}

async function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
) {
  if (
    !header ||
    header.length >
      MAX_STRIPE_SIGNATURE_HEADER_LENGTH ||
    !secret
  ) {
    return false;
  }

  const timestampValues: string[] = [];
  const signatures: string[] = [];

  for (const rawPart of header.split(",")) {
    const part = rawPart.trim();
    const separatorIndex = part.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = part
      .slice(0, separatorIndex)
      .trim();

    const value = part
      .slice(separatorIndex + 1)
      .trim();

    if (key === "t") {
      timestampValues.push(value);
    }

    if (
      key === "v1" &&
      /^[a-fA-F0-9]{64}$/.test(value)
    ) {
      signatures.push(
        value.toLowerCase(),
      );
    }
  }

  if (
    timestampValues.length !== 1 ||
    signatures.length === 0
  ) {
    return false;
  }

  const timestamp =
    timestampValues[0];

  if (!/^\d+$/.test(timestamp)) {
    return false;
  }

  const timestampNumber =
    Number(timestamp);

  if (
    !Number.isSafeInteger(
      timestampNumber,
    ) ||
    timestampNumber <= 0
  ) {
    return false;
  }

  const nowSeconds =
    Math.floor(
      Date.now() / 1000,
    );

  if (
    Math.abs(
      nowSeconds -
        timestampNumber,
    ) >
    STRIPE_SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const expected =
    await hmacHex(
      secret,
      `${timestamp}.${rawBody}`,
    );

  return signatures.some(
    (signature) =>
      safeEqual(
        signature,
        expected,
      ),
  );
}

async function sha256(
  value: string,
) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        value,
      ),
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map(
      (entry) =>
        entry
          .toString(16)
          .padStart(2, "0"),
    )
    .join("");
}

async function readBodyLimited(
  request: Request,
  maxBytes: number,
) {
  const declaredLength =
    request.headers.get(
      "content-length",
    );

  if (
    declaredLength &&
    /^\d+$/.test(
      declaredLength,
    )
  ) {
    const declaredBytes =
      Number(declaredLength);

    if (
      Number.isSafeInteger(
        declaredBytes,
      ) &&
      declaredBytes > maxBytes
    ) {
      throw new RangeError(
        "WEBHOOK_BODY_TOO_LARGE",
      );
    }
  }

  if (!request.body) {
    return "";
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] =
    [];

  let totalBytes = 0;

  try {
    while (true) {
      const {
        done,
        value,
      } =
        await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        maxBytes
      ) {
        await reader
          .cancel(
            "Payload too large",
          )
          .catch(
            () => undefined,
          );

        throw new RangeError(
          "WEBHOOK_BODY_TOO_LARGE",
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged =
    new Uint8Array(
      totalBytes,
    );

  let offset = 0;

  for (const chunk of chunks) {
    merged.set(
      chunk,
      offset,
    );

    offset +=
      chunk.byteLength;
  }

  try {
    return new TextDecoder(
      "utf-8",
      {
        fatal: true,
      },
    ).decode(merged);
  } catch {
    throw new TypeError(
      "WEBHOOK_BODY_INVALID_UTF8",
    );
  }
}

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function paymentIntentReference(
  object: any,
) {
  if (
    typeof object
      ?.payment_intent ===
    "string"
  ) {
    return object.payment_intent;
  }

  if (
    typeof object
      ?.payment_intent
      ?.id === "string"
  ) {
    return object
      .payment_intent.id;
  }

  if (
    String(
      object?.object || "",
    ) === "payment_intent"
  ) {
    return String(
      object?.id || "",
    );
  }

  return "";
}

async function resolveTransactionId(
  admin: any,
  object: any,
) {
  const metadataId =
    String(
      object
        ?.metadata
        ?.transaction_id ||
        "",
    ).trim();

  if (
    metadataId &&
    isUuid(metadataId)
  ) {
    return metadataId;
  }

  if (
    String(
      object?.object || "",
    ) ===
      "checkout.session" &&
    object?.id
  ) {
    const sessionResult =
      await admin
        .from(
          "payment_transactions",
        )
        .select("id")
        .eq(
          "provider",
          "stripe_connect",
        )
        .eq(
          "provider_session_id",
          String(object.id),
        )
        .maybeSingle();

    if (
      sessionResult.error
    ) {
      throw new Error(
        "Could not resolve payment transaction by session",
      );
    }

    if (
      sessionResult.data?.id
    ) {
      return String(
        sessionResult
          .data.id,
      );
    }
  }

  const reference =
    paymentIntentReference(
      object,
    );

  if (reference) {
    const referenceResult =
      await admin
        .from(
          "payment_transactions",
        )
        .select("id")
        .eq(
          "provider",
          "stripe_connect",
        )
        .eq(
          "provider_reference",
          reference,
        )
        .maybeSingle();

    if (
      referenceResult.error
    ) {
      throw new Error(
        "Could not resolve payment transaction by reference",
      );
    }

    if (
      referenceResult
        .data?.id
    ) {
      return String(
        referenceResult
          .data.id,
      );
    }
  }

  return "";
}

function succeededPaymentDetails(
  eventType: string,
  object: any,
) {
  if (
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(eventType)
  ) {
    if (
      String(
        object
          ?.payment_status ||
          "",
      ).toLowerCase() !==
      "paid"
    ) {
      return null;
    }

    const amountMinor =
      Number(
        object?.amount_total,
      );

    const currency =
      String(
        object?.currency ||
          "",
      ).toUpperCase();

    const sessionId =
      String(
        object?.id || "",
      ).trim();

    const providerReference =
      paymentIntentReference(
        object,
      ).trim();

    if (
      !Number.isSafeInteger(
        amountMinor,
      ) ||
      amountMinor <= 0 ||
      !/^[A-Z]{3}$/.test(
        currency,
      ) ||
      !sessionId ||
      !providerReference
    ) {
      return null;
    }

    return {
      amount:
        amountMinor / 100,
      currency,
      sessionId,
      providerReference,
    };
  }

  if (
    eventType ===
    "payment_intent.succeeded"
  ) {
    if (
      String(
        object?.status ||
          "",
      ).toLowerCase() !==
      "succeeded"
    ) {
      return null;
    }

    const amountMinor =
      Number(
        object
          ?.amount_received,
      );

    const currency =
      String(
        object?.currency ||
          "",
      ).toUpperCase();

    const providerReference =
      String(
        object?.id || "",
      ).trim();

    if (
      !Number.isSafeInteger(
        amountMinor,
      ) ||
      amountMinor <= 0 ||
      !/^[A-Z]{3}$/.test(
        currency,
      ) ||
      !providerReference
    ) {
      return null;
    }

    return {
      amount:
        amountMinor / 100,
      currency,
      sessionId: "",
      providerReference,
    };
  }

  return null;
}

function isKnownSuccessfulPaymentEvent(
  eventType: string,
) {
  return [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "payment_intent.succeeded",
  ].includes(eventType);
}

function isExpectedNonFinalCheckoutEvent(
  eventType: string,
  object: any,
) {
  return (
    eventType ===
      "checkout.session.completed" &&
    String(
      object?.payment_status ||
        "",
    ).toLowerCase() !==
      "paid"
  );
}

function verifiedRefundDetails(
  object: any,
  fallbackCurrency = "",
) {
  const refundId =
    String(
      object?.id || "",
    ).trim();

  const amountMinor =
    Number(object?.amount);

  const currency =
    String(
      object?.currency ||
        fallbackCurrency ||
        "",
    ).toUpperCase();

  if (
    !/^re_[A-Za-z0-9]+$/.test(
      refundId,
    ) ||
    !Number.isSafeInteger(
      amountMinor,
    ) ||
    amountMinor <= 0 ||
    !/^[A-Z]{3}$/.test(
      currency,
    )
  ) {
    return null;
  }

  return {
    refundId,
    amount:
      amountMinor / 100,
    currency,
  };
}


function scheduleRefundReversalWorker(
  supabaseUrl: string,
  serviceKey: string,
  settlementSecret: string,
  paymentTransactionId: string,
) {
  if (
    !supabaseUrl ||
    !serviceKey ||
    !isUuid(paymentTransactionId)
  ) {
    return;
  }

  const task = (async () => {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        REFUND_REVERSAL_TRIGGER_TIMEOUT_MS,
      );

    try {
      const headers:
        Record<string, string> = {
          Authorization:
            `Bearer ${serviceKey}`,
          "Content-Type":
            "application/json",
        };

      if (
        settlementSecret.length >=
          24
      ) {
        headers[
          "x-rc-ordera-settlement-secret"
        ] =
          settlementSecret;
      }

      const result =
        await fetch(
          `${supabaseUrl.replace(
            /\/+$/,
            "",
          )}/functions/v1/marketplace-refund-reversals`,
          {
            method:
              "POST",
            headers,
            body:
              JSON.stringify({
                paymentTransactionId,
              }),
            signal:
              controller.signal,
          },
        );

      if (!result.ok) {
        console.error(
          "marketplace-webhook refund reversal worker returned non-2xx",
          {
            paymentTransactionId,
            status:
              result.status,
          },
        );
      }
    } catch (error) {
      console.error(
        "marketplace-webhook refund reversal worker trigger failed",
        {
          paymentTransactionId,
          error:
            String(
              error instanceof
                  Error
                ? error.message
                : error,
            ).slice(
              0,
              500,
            ),
        },
      );
    } finally {
      clearTimeout(
        timeout,
      );
    }
  })();

  EdgeRuntime.waitUntil(
    task,
  );
}

Deno.serve(
  async (request) => {
    if (
      request.method !==
      "POST"
    ) {
      return json(405, {
        error:
          "Method not allowed",
      });
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      ) || "";

    const serviceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) || "";

    const webhookSecret =
      Deno.env.get(
        "STRIPE_WEBHOOK_SECRET",
      ) || "";

    const settlementSecret =
      Deno.env.get(
        "PAYMENT_SETTLEMENT_SECRET",
      ) || "";

    if (
      !supabaseUrl ||
      !serviceKey ||
      !webhookSecret
    ) {
      return json(503, {
        error:
          "Webhook is not configured",
      });
    }

    let rawBody = "";

    try {
      rawBody =
        await readBodyLimited(
          request,
          MAX_WEBHOOK_BODY_BYTES,
        );
    } catch (error) {
      if (
        error instanceof
          RangeError &&
        error.message ===
          "WEBHOOK_BODY_TOO_LARGE"
      ) {
        return json(413, {
          error:
            "Payload too large",
        });
      }

      return json(400, {
        error:
          "Invalid payload",
      });
    }

    const signature =
      request.headers.get(
        "stripe-signature",
      ) || "";

    if (
      !(await verifyStripeSignature(
        rawBody,
        signature,
        webhookSecret,
      ))
    ) {
      return json(400, {
        error:
          "Invalid signature",
      });
    }

    let event: any;

    try {
      event =
        JSON.parse(rawBody);
    } catch {
      return json(400, {
        error:
          "Invalid payload",
      });
    }

    const eventId =
      String(
        event?.id || "",
      ).trim();

    const eventType =
      String(
        event?.type || "",
      ).trim();

    if (
      !eventId ||
      !eventType ||
      eventId.length > 255 ||
      eventType.length > 255
    ) {
      return json(400, {
        error:
          "Invalid event",
      });
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceKey,
        {
          auth: {
            persistSession:
              false,
            autoRefreshToken:
              false,
            detectSessionInUrl:
              false,
          },
        },
      );

    const eventRow = {
      provider:
        "stripe_connect",
      provider_event_id:
        eventId,
      event_type:
        eventType,
      payload_sha256:
        await sha256(
          rawBody,
        ),
      processing_status:
        "received",
    };

    let eventRecord: any =
      null;

    const insertedResult =
      await admin
        .from(
          "payment_provider_events",
        )
        .insert(eventRow)
        .select(
          "id,processing_status,received_at",
        )
        .maybeSingle();

    if (
      !insertedResult.error
    ) {
      eventRecord =
        insertedResult.data;
    } else if (
      insertedResult
        .error.code ===
      "23505"
    ) {
      const existingResult =
        await admin
          .from(
            "payment_provider_events",
          )
          .select(
            "id,processing_status,received_at,payload_sha256",
          )
          .eq(
            "provider",
            "stripe_connect",
          )
          .eq(
            "provider_event_id",
            eventId,
          )
          .maybeSingle();

      if (
        existingResult.error ||
        !existingResult.data
      ) {
        return json(500, {
          error:
            "Could not read event",
        });
      }

      if (
        existingResult
          .data
          .payload_sha256 &&
        existingResult
          .data
          .payload_sha256 !==
          eventRow.payload_sha256
      ) {
        return json(409, {
          error:
            "Event payload does not match",
        });
      }

      const receivedAtMs =
        new Date(
          existingResult
            .data
            .received_at,
        ).getTime();

      if (
        !Number.isFinite(
          receivedAtMs,
        )
      ) {
        return json(500, {
          error:
            "Event lease timestamp is invalid",
        });
      }

      const isStale =
        Date.now() -
          receivedAtMs >
        EVENT_LEASE_MS;

      if (
        [
          "processed",
          "ignored",
        ].includes(
          existingResult
            .data
            .processing_status,
        )
      ) {
        return json(200, {
          received: true,
          duplicate: true,
        });
      }

      if (
        existingResult
          .data
          .processing_status ===
          "received" &&
        !isStale
      ) {
        return json(503, {
          error:
            "Payment event is still being processed",
          retryable: true,
        });
      }

      const reclaimStartedAt =
        new Date()
          .toISOString();

      let resetQuery =
        admin
          .from(
            "payment_provider_events",
          )
          .update({
            processing_status:
              "received",
            error_message: "",
            processed_at: null,
            received_at:
              reclaimStartedAt,
          })
          .eq(
            "id",
            existingResult
              .data.id,
          );

      if (
        existingResult
          .data
          .processing_status ===
        "received"
      ) {
        resetQuery =
          resetQuery
            .eq(
              "processing_status",
              "received",
            )
            .lte(
              "received_at",
              new Date(
                Date.now() -
                  EVENT_LEASE_MS,
              ).toISOString(),
            );
      } else {
        resetQuery =
          resetQuery.eq(
            "processing_status",
            existingResult
              .data
              .processing_status,
          );
      }

      const resetResult =
        await resetQuery
          .select(
            "id,processing_status,received_at",
          )
          .maybeSingle();

      if (
        resetResult.error
      ) {
        return json(500, {
          error:
            "Could not retry event",
        });
      }

      if (
        !resetResult.data
      ) {
        return json(503, {
          error:
            "Payment event was reclaimed by another worker",
          retryable: true,
        });
      }

      eventRecord =
        resetResult.data;
    } else {
      return json(500, {
        error:
          "Could not register event",
      });
    }

    if (
      !eventRecord?.id ||
      !eventRecord
        ?.received_at
    ) {
      return json(500, {
        error:
          "Could not reserve event",
      });
    }

    const eventLeaseReceivedAt =
      String(
        eventRecord
          .received_at,
      );

    const markEvent =
      async (
        status:
          EventProcessingStatus,
        errorMessage = "",
      ) => {
        const markResult =
          await admin
            .from(
              "payment_provider_events",
            )
            .update({
              processing_status:
                status,
              error_message:
                errorMessage.slice(
                  0,
                  1000,
                ),
              processed_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              eventRecord.id,
            )
            .eq(
              "processing_status",
              "received",
            )
            .eq(
              "received_at",
              eventLeaseReceivedAt,
            )
            .select("id")
            .maybeSingle();

        if (
          markResult.error
        ) {
          throw new Error(
            "Could not persist payment event status",
          );
        }

        return Boolean(
          markResult
            .data?.id,
        );
      };

    try {
      const object =
        event
          ?.data
          ?.object || {};

      const transactionId =
        await resolveTransactionId(
          admin,
          object,
        );

      const success =
        succeededPaymentDetails(
          eventType,
          object,
        );

      if (success) {
        if (
          !transactionId
        ) {
          throw new Error(
            "Payment transaction reference is missing",
          );
        }

        const result =
          await admin.rpc(
            "rc_ordera_mark_payment_succeeded",
            {
              p_payment_transaction_id:
                transactionId,
              p_provider_session_id:
                success.sessionId,
              p_provider_reference:
                success.providerReference,
              p_amount:
                success.amount,
              p_currency:
                success.currency,
            },
          );

        if (result.error) {
          throw result.error;
        }

        if (
          !(await markEvent(
            "processed",
          ))
        ) {
          throw new Error(
            "Payment event lease was lost before finalization",
          );
        }

        return json(200, {
          received: true,
        });
      }

      if (
        isKnownSuccessfulPaymentEvent(
          eventType,
        )
      ) {
        if (
          isExpectedNonFinalCheckoutEvent(
            eventType,
            object,
          )
        ) {
          if (
            !(await markEvent(
              "ignored",
              "Checkout completed before payment became final",
            ))
          ) {
            throw new Error(
              "Payment event lease was lost before finalization",
            );
          }

          return json(200, {
            received: true,
            ignored: true,
          });
        }

        throw new Error(
          "Final payment event has invalid financial fields",
        );
      }

      if (
        eventType ===
        "payment_intent.payment_failed"
      ) {
        if (
          !(await markEvent(
            "processed",
          ))
        ) {
          throw new Error(
            "Payment event lease was lost before finalization",
          );
        }

        return json(200, {
          received: true,
          paymentAttemptFailed:
            true,
        });
      }

      if (
        [
          "checkout.session.async_payment_failed",
          "checkout.session.expired",
        ].includes(eventType)
      ) {
        if (
          !transactionId
        ) {
          throw new Error(
            "Payment transaction reference is missing",
          );
        }

        const failure =
          await admin.rpc(
            "rc_ordera_mark_payment_failed",
            {
              p_payment_transaction_id:
                transactionId,
              p_reason:
                String(
                  object
                    ?.last_payment_error
                    ?.message ||
                    eventType,
                ),
            },
          );

        if (
          failure.error
        ) {
          throw failure.error;
        }

        if (
          !(await markEvent(
            "processed",
          ))
        ) {
          throw new Error(
            "Payment event lease was lost before finalization",
          );
        }

        return json(200, {
          received: true,
        });
      }

      if (
        eventType ===
          "refund.updated" &&
        String(
          object?.status ||
            "",
        ) === "succeeded"
      ) {
        if (
          !transactionId
        ) {
          throw new Error(
            "Refund payment transaction was not found",
          );
        }

        const refundDetails =
          verifiedRefundDetails(
            object,
          );

        if (
          !refundDetails
        ) {
          throw new Error(
            "Refund contains invalid financial fields",
          );
        }

        const refund =
          await admin.rpc(
            "rc_ordera_record_verified_refund",
            {
              p_payment_transaction_id:
                transactionId,
              p_provider_refund_id:
                refundDetails
                  .refundId,
              p_amount:
                refundDetails
                  .amount,
              p_currency:
                refundDetails
                  .currency,
            },
          );

        if (refund.error) {
          throw refund.error;
        }

        if (
          String(
            refund.data || "",
          ).toLowerCase() ===
          "refunded"
        ) {
          scheduleRefundReversalWorker(
            supabaseUrl,
            serviceKey,
            settlementSecret,
            transactionId,
          );
        }

        if (
          !(await markEvent(
            "processed",
          ))
        ) {
          throw new Error(
            "Payment event lease was lost before finalization",
          );
        }

        return json(200, {
          received: true,
        });
      }

      if (
        eventType ===
        "charge.refunded"
      ) {
        if (
          !transactionId
        ) {
          throw new Error(
            "Refund payment transaction was not found",
          );
        }

        let refundBecameTotal =
          false;

        const refunds =
          Array.isArray(
            object
              ?.refunds
              ?.data,
          )
            ? object
                .refunds
                .data
            : [];

        for (
          const entry of refunds
        ) {
          if (
            String(
              entry?.status ||
                "",
            ) !==
            "succeeded"
          ) {
            continue;
          }

          const refundDetails =
            verifiedRefundDetails(
              entry,
              String(
                object
                  ?.currency ||
                  "",
              ),
            );

          if (
            !refundDetails
          ) {
            throw new Error(
              "Charge refund contains invalid financial fields",
            );
          }

          const refund =
            await admin.rpc(
              "rc_ordera_record_verified_refund",
              {
                p_payment_transaction_id:
                  transactionId,
                p_provider_refund_id:
                  refundDetails
                    .refundId,
                p_amount:
                  refundDetails
                    .amount,
                p_currency:
                  refundDetails
                    .currency,
              },
            );

          if (
            refund.error
          ) {
            throw refund.error;
          }

          if (
            String(
              refund.data || "",
            ).toLowerCase() ===
            "refunded"
          ) {
            refundBecameTotal =
              true;
          }
        }

        if (
          refundBecameTotal
        ) {
          scheduleRefundReversalWorker(
            supabaseUrl,
            serviceKey,
            settlementSecret,
            transactionId,
          );
        }

        if (
          !(await markEvent(
            "processed",
          ))
        ) {
          throw new Error(
            "Payment event lease was lost before finalization",
          );
        }

        return json(200, {
          received: true,
        });
      }

      if (
        [
          "charge.dispute.created",
          "charge.dispute.updated",
          "charge.dispute.closed",
        ].includes(eventType)
      ) {
        if (
          !transactionId
        ) {
          throw new Error(
            "Disputed payment transaction was not found",
          );
        }

        const disputeId =
          String(
            object?.id ||
              "",
          );

        const disputeStatus =
          String(
            object?.status ||
              "",
          );

        const eventCreated =
          Number(
            event?.created,
          );

        if (
          !/^du_[A-Za-z0-9]+$/.test(
            disputeId,
          )
        ) {
          throw new Error(
            "Invalid Stripe dispute id",
          );
        }

        if (
          !Number.isSafeInteger(
            eventCreated,
          ) ||
          eventCreated < 0
        ) {
          throw new Error(
            "Invalid Stripe dispute event timestamp",
          );
        }

        const dispute =
          await admin.rpc(
            "rc_ordera_reconcile_payment_dispute",
            {
              p_payment_transaction_id:
                transactionId,
              p_provider_dispute_id:
                disputeId,
              p_status:
                disputeStatus,
              p_event_created:
                eventCreated,
            },
          );

        if (
          dispute.error
        ) {
          throw dispute.error;
        }

        if (
          !(await markEvent(
            "processed",
          ))
        ) {
          throw new Error(
            "Payment event lease was lost before finalization",
          );
        }

        return json(200, {
          received: true,
          dispute:
            dispute.data,
        });
      }

      if (
        !(await markEvent(
          "ignored",
        ))
      ) {
        throw new Error(
          "Payment event lease was lost before finalization",
        );
      }

      return json(200, {
        received: true,
        ignored: true,
      });
    } catch (error) {
      const errorMessage =
        String(
          error instanceof
              Error
            ? error.message
            : error,
        ).slice(0, 1000);

      console.error(
        "marketplace-webhook processing failed",
        {
          eventId,
          eventType,
          error:
            errorMessage,
        },
      );

      try {
        await markEvent(
          "failed",
          errorMessage,
        );
      } catch (
        markError
      ) {
        console.error(
          "marketplace-webhook could not persist failure state",
          {
            eventId,
            eventType,
            error:
              String(
                markError instanceof
                    Error
                  ? markError
                      .message
                  : markError,
              ).slice(
                0,
                500,
              ),
          },
        );
      }

      return json(500, {
        error:
          "Event processing failed",
      });
    }
  },
);
