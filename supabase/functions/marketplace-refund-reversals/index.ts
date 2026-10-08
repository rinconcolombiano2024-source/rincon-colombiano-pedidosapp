import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const MAX_REQUEST_BODY_BYTES = 8_192;
const MAX_AUTHORIZATION_HEADER_LENGTH = 8_192;
const MAX_INTERNAL_SECRET_HEADER_LENGTH = 1_024;
const STRIPE_REQUEST_TIMEOUT_MS = 15_000;
const MAX_JOBS_PER_RUN = 25;
const MAX_AUTOMATIC_ATTEMPTS = 6;
const MAX_ERROR_MESSAGE_LENGTH = 1_000;

type ReversalJob = {
  id?: unknown;
  payment_transaction_id?: unknown;
  transfer_id?: unknown;
  expected_amount_minor?: unknown;
  currency?: unknown;
  amount_minor?: unknown;
  status?: unknown;
  attempts?: unknown;
  lease_token?: unknown;
};

type RequestPayload = {
  paymentTransactionId?: unknown;
};

type StripeResult = {
  ok: boolean;
  status: number;
  data: any;
  retryable: boolean;
  uncertain: boolean;
  error: string;
};

const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isTransferId(value: string) {
  return /^tr_[A-Za-z0-9]+$/.test(value);
}

function isTransferReversalId(value: string) {
  return /^trr_[A-Za-z0-9]+$/.test(value);
}

function normalizeCurrency(value: unknown) {
  const currency = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "";
}

function positiveSafeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function nonNegativeSafeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function safeErrorMessage(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : String(error || fallback);

  return (message.trim() || fallback).slice(
    0,
    MAX_ERROR_MESSAGE_LENGTH,
  );
}

async function sha256Bytes(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return new Uint8Array(digest);
}

async function constantTimeEqual(
  first: string,
  second: string,
) {
  if (!first || !second) return false;

  const [firstDigest, secondDigest] =
    await Promise.all([
      sha256Bytes(first),
      sha256Bytes(second),
    ]);

  let difference = 0;

  for (
    let index = 0;
    index < firstDigest.length;
    index += 1
  ) {
    difference |=
      firstDigest[index] ^
      secondDigest[index];
  }

  return difference === 0;
}

async function readJsonBodyLimited(
  request: Request,
): Promise<RequestPayload> {
  if (!request.body) return {};

  const declaredLength = Number(
    request.headers.get("content-length") || 0,
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength >
      MAX_REQUEST_BODY_BYTES
  ) {
    throw new RangeError(
      "REQUEST_BODY_TOO_LARGE",
    );
  }

  const reader =
    request.body.getReader();

  const chunks:
    Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) break;
      if (!value) continue;

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        MAX_REQUEST_BODY_BYTES
      ) {
        try {
          await reader.cancel(
            "REQUEST_BODY_TOO_LARGE",
          );
        } catch {
          // Best effort.
        }

        throw new RangeError(
          "REQUEST_BODY_TOO_LARGE",
        );
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

  if (totalBytes === 0) {
    return {};
  }

  const merged =
    new Uint8Array(totalBytes);

  let offset = 0;

  for (const chunk of chunks) {
    merged.set(
      chunk,
      offset,
    );

    offset +=
      chunk.byteLength;
  }

  let raw = "";

  try {
    raw =
      new TextDecoder(
        "utf-8",
        {
          fatal: true,
        },
      ).decode(merged);
  } catch {
    throw new SyntaxError(
      "REQUEST_BODY_INVALID_UTF8",
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    throw new SyntaxError(
      "REQUEST_BODY_INVALID_JSON",
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new SyntaxError(
      "REQUEST_BODY_INVALID_JSON",
    );
  }

  return parsed as RequestPayload;
}

async function stripeRequest(
  url: string,
  options: RequestInit,
): Promise<StripeResult> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      STRIPE_REQUEST_TIMEOUT_MS,
    );

  let result: Response;
  let raw: string;

  try {
    result = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    // La fecha limite cubre tambien el cuerpo, no solo las cabeceras.
    raw = await result.text();
  } catch (error) {
    const timedOut =
      error instanceof DOMException &&
      error.name === "AbortError";

    return {
      ok: false,
      status: 0,
      data: {},
      retryable: true,
      uncertain: true,
      error: timedOut
        ? "Stripe request timed out"
        : "Stripe request failed",
    };
  } finally {
    clearTimeout(timeout);
  }

  let data: any = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        status: result.status,
        data: {},
        retryable:
          result.status === 409 ||
          result.status === 429 ||
          result.status >= 500,
        uncertain:
          result.ok ||
          result.status >= 500,
        error:
          "Stripe returned an invalid response",
      };
    }
  }

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      data,
      retryable:
        result.status === 409 ||
        result.status === 429 ||
        result.status >= 500,
      uncertain:
        result.status >= 500,
      error: safeErrorMessage(
        data?.error?.message,
        "Stripe request failed",
      ),
    };
  }

  return {
    ok: true,
    status: result.status,
    data,
    retryable: false,
    uncertain: false,
    error: "",
  };
}

async function getStripeTransfer(
  stripeKey: string,
  transferId: string,
) {
  return await stripeRequest(
    `https://api.stripe.com/v1/transfers/${encodeURIComponent(
      transferId,
    )}`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${stripeKey}`,
      },
    },
  );
}

async function listStripeTransferReversals(
  stripeKey: string,
  transferId: string,
) {
  return await stripeRequest(
    `https://api.stripe.com/v1/transfers/${encodeURIComponent(
      transferId,
    )}/reversals?limit=100`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${stripeKey}`,
      },
    },
  );
}

async function createStripeTransferReversal(
  stripeKey: string,
  transferId: string,
  queueId: string,
  paymentTransactionId: string,
  amountMinor: number,
) {
  return await stripeRequest(
    `https://api.stripe.com/v1/transfers/${encodeURIComponent(
      transferId,
    )}/reversals`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${stripeKey}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
        "Idempotency-Key":
          `rc-refund-reversal:${queueId}`,
      },
      body:
        new URLSearchParams({
          amount:
            String(amountMinor),
          "metadata[rc_ordera_reversal_id]":
            queueId,
          "metadata[payment_transaction_id]":
            paymentTransactionId,
        }),
    },
  );
}

function minimalReversalReceipt(
  reversal: any,
) {
  return {
    id:
      String(reversal?.id || ""),
    object:
      String(
        reversal?.object || "",
      ),
    amount:
      positiveSafeInteger(
        reversal?.amount,
      ),
    currency:
      normalizeCurrency(
        reversal?.currency,
      ),
    transfer:
      String(
        reversal?.transfer || "",
      ),
    balanceTransaction:
      String(
        reversal
          ?.balance_transaction ||
          "",
      ),
    created:
      nonNegativeSafeInteger(
        reversal?.created,
      ),
  };
}

function validateTransfer(
  transfer: any,
  transferId: string,
  expectedAmountMinor: number,
  expectedCurrency: string,
) {
  return (
    String(
      transfer?.object || "",
    ) === "transfer" &&
    String(
      transfer?.id || "",
    ) === transferId &&
    positiveSafeInteger(
      transfer?.amount,
    ) ===
      expectedAmountMinor &&
    normalizeCurrency(
      transfer?.currency,
    ) === expectedCurrency
  );
}

function validateReversal(
  reversal: any,
  transferId: string,
  amountMinor: number,
  currency: string,
) {
  return (
    String(
      reversal?.object || "",
    ) ===
      "transfer_reversal" &&
    isTransferReversalId(
      String(
        reversal?.id || "",
      ),
    ) &&
    String(
      reversal?.transfer || "",
    ) === transferId &&
    positiveSafeInteger(
      reversal?.amount,
    ) === amountMinor &&
    normalizeCurrency(
      reversal?.currency,
    ) === currency
  );
}

function findExistingReversal(
  listObject: any,
  queueId: string,
  paymentTransactionId: string,
) {
  const entries =
    Array.isArray(
      listObject?.data,
    )
      ? listObject.data
      : [];

  return (
    entries.find(
      (entry: any) =>
        String(
          entry
            ?.metadata
            ?.rc_ordera_reversal_id ||
            "",
        ) === queueId &&
        String(
          entry
            ?.metadata
            ?.payment_transaction_id ||
            "",
        ) ===
          paymentTransactionId,
    ) || null
  );
}

Deno.serve(async (request) => {
  if (
    request.method !==
    "POST"
  ) {
    return response(
      405,
      {
        error:
          "Method not allowed",
      },
    );
  }

  const supabaseUrl =
    (
      Deno.env.get(
        "SUPABASE_URL",
      ) || ""
    ).replace(/\/+$/, "");

  const serviceKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    ) || "";

  const stripeKey =
    Deno.env.get(
      "STRIPE_SECRET_KEY",
    ) || "";

  const financialWorkerSecret =
    Deno.env.get(
      "PAYMENT_SETTLEMENT_SECRET",
    ) || "";

  if (
    !supabaseUrl ||
    !serviceKey ||
    !stripeKey
  ) {
    return response(
      503,
      {
        error:
          "Refund reversal worker is not configured",
      },
    );
  }

  const authorization =
    request.headers.get(
      "authorization",
    ) || "";

  const suppliedSecret =
    request.headers.get(
      "x-rc-ordera-settlement-secret",
    ) || "";

  if (
    authorization.length >
      MAX_AUTHORIZATION_HEADER_LENGTH ||
    suppliedSecret.length >
      MAX_INTERNAL_SECRET_HEADER_LENGTH
  ) {
    return response(
      401,
      {
        error:
          "Unauthorized",
      },
    );
  }

  const serviceAuthorized =
    await constantTimeEqual(
      authorization,
      `Bearer ${serviceKey}`,
    );

  const secretAuthorized =
    financialWorkerSecret.length >=
      24 &&
    await constantTimeEqual(
      suppliedSecret,
      financialWorkerSecret,
    );

  if (
    !serviceAuthorized &&
    !secretAuthorized
  ) {
    return response(
      401,
      {
        error:
          "Unauthorized",
      },
    );
  }

  let payload:
    RequestPayload = {};

  try {
    payload =
      await readJsonBodyLimited(
        request,
      );
  } catch (error) {
    if (
      error instanceof
        RangeError &&
      error.message ===
        "REQUEST_BODY_TOO_LARGE"
    ) {
      return response(
        413,
        {
          error:
            "Request body is too large",
        },
      );
    }

    return response(
      400,
      {
        error:
          "Invalid request",
      },
    );
  }

  const rawPaymentTransactionId =
    String(
      payload
        .paymentTransactionId ||
        "",
    ).trim();

  if (
    rawPaymentTransactionId &&
    !isUuid(
      rawPaymentTransactionId,
    )
  ) {
    return response(
      400,
      {
        error:
          "Invalid payment transaction",
      },
    );
  }

  const paymentTransactionId =
    rawPaymentTransactionId ||
    null;

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

  const claimResult =
    await admin.rpc(
      "rc_ordera_claim_refund_reversals",
      {
        p_payment_transaction_id:
          paymentTransactionId,
      },
    );

  if (claimResult.error) {
    return response(
      500,
      {
        error:
          "Could not claim refund reversals",
      },
    );
  }

  const jobs =
    Array.isArray(
      claimResult.data,
    )
      ? claimResult.data.slice(
          0,
          MAX_JOBS_PER_RUN,
        )
      : [];

  if (!jobs.length) {
    return response(
      200,
      {
        processed: 0,
        confirmed: 0,
        failed: 0,
        manualReview: 0,
      },
    );
  }

  let processed = 0;
  let confirmed = 0;
  let failed = 0;
  let manualReview = 0;

  const finish =
    async (
      jobId: string,
      leaseToken: string,
      status:
        | "confirmed"
        | "failed"
        | "manual_review",
      reversalId: string,
      receipt:
        Record<
          string,
          unknown
        >,
      errorMessage: string,
    ) => {
      const result =
        await admin.rpc(
          "rc_ordera_finish_refund_reversal",
          {
            p_id:
              jobId,
            p_lease_token:
              leaseToken,
            p_status:
              status,
            p_reversal_id:
              reversalId,
            p_receipt:
              receipt,
            p_error:
              errorMessage.slice(
                0,
                MAX_ERROR_MESSAGE_LENGTH,
              ),
          },
        );

      return (
        !result.error &&
        result.data === true
      );
    };

  for (
    const rawJob
    of jobs as
      ReversalJob[]
  ) {
    processed += 1;

    const jobId =
      String(
        rawJob.id || "",
      ).trim();

    const leaseToken =
      String(
        rawJob.lease_token ||
          "",
      ).trim();

    const jobPaymentTransactionId =
      String(
        rawJob
          .payment_transaction_id ||
          "",
      ).trim();

    const transferId =
      String(
        rawJob.transfer_id ||
          "",
      ).trim();

    const expectedAmountMinor =
      positiveSafeInteger(
        rawJob
          .expected_amount_minor,
      );

    const currency =
      normalizeCurrency(
        rawJob.currency,
      );

    const attempts =
      nonNegativeSafeInteger(
        rawJob.attempts,
      );

    const structurallyValid =
      isUuid(jobId) &&
      isUuid(leaseToken) &&
      isUuid(
        jobPaymentTransactionId,
      ) &&
      isTransferId(
        transferId,
      ) &&
      expectedAmountMinor > 0 &&
      Boolean(currency) &&
      String(
        rawJob.status || "",
      ) === "processing";

    if (!structurallyValid) {
      if (
        isUuid(jobId) &&
        isUuid(leaseToken)
      ) {
        const saved =
          await finish(
            jobId,
            leaseToken,
            "manual_review",
            "",
            {},
            "Refund reversal job is structurally invalid",
          );

        if (saved) {
          manualReview += 1;
        }
      }

      continue;
    }

    try {
      const reservedResult =
        await admin.rpc(
          "rc_ordera_reserve_refund_reversal_amount",
          {
            p_id:
              jobId,
            p_lease_token:
              leaseToken,
            p_amount_minor:
              expectedAmountMinor,
          },
        );

      if (
        reservedResult.error
      ) {
        const saved =
          await finish(
            jobId,
            leaseToken,
            "manual_review",
            "",
            {},
            "Could not reserve refund reversal amount",
          );

        if (saved) {
          manualReview += 1;
        }

        continue;
      }

      const amountMinor =
        positiveSafeInteger(
          reservedResult.data,
        );

      if (
        amountMinor <= 0 ||
        amountMinor >
          expectedAmountMinor
      ) {
        const saved =
          await finish(
            jobId,
            leaseToken,
            "manual_review",
            "",
            {},
            "Reserved reversal amount is invalid",
          );

        if (saved) {
          manualReview += 1;
        }

        continue;
      }

      const transferResult =
        await getStripeTransfer(
          stripeKey,
          transferId,
        );

      if (
        !transferResult.ok
      ) {
        const finalStatus =
          transferResult
            .retryable &&
          attempts <
            MAX_AUTOMATIC_ATTEMPTS
            ? "failed"
            : "manual_review";

        const saved =
          await finish(
            jobId,
            leaseToken,
            finalStatus,
            "",
            {},
            transferResult.error,
          );

        if (saved) {
          if (
            finalStatus ===
            "failed"
          ) {
            failed += 1;
          } else {
            manualReview += 1;
          }
        }

        continue;
      }

      const transfer =
        transferResult.data;

      if (
        !validateTransfer(
          transfer,
          transferId,
          expectedAmountMinor,
          currency,
        )
      ) {
        const saved =
          await finish(
            jobId,
            leaseToken,
            "manual_review",
            "",
            {},
            "Stripe transfer does not match RC ORDERA allocation",
          );

        if (saved) {
          manualReview += 1;
        }

        continue;
      }

      const reversalsResult =
        await listStripeTransferReversals(
          stripeKey,
          transferId,
        );

      if (
        !reversalsResult.ok
      ) {
        const finalStatus =
          reversalsResult
            .retryable &&
          attempts <
            MAX_AUTOMATIC_ATTEMPTS
            ? "failed"
            : "manual_review";

        const saved =
          await finish(
            jobId,
            leaseToken,
            finalStatus,
            "",
            {},
            reversalsResult.error,
          );

        if (saved) {
          if (
            finalStatus ===
            "failed"
          ) {
            failed += 1;
          } else {
            manualReview += 1;
          }
        }

        continue;
      }

      const existingReversal =
        findExistingReversal(
          reversalsResult.data,
          jobId,
          jobPaymentTransactionId,
        );

      if (
        existingReversal
      ) {
        if (
          !validateReversal(
            existingReversal,
            transferId,
            amountMinor,
            currency,
          )
        ) {
          const saved =
            await finish(
              jobId,
              leaseToken,
              "manual_review",
              "",
              {},
              "Existing Stripe reversal does not match RC ORDERA job",
            );

          if (saved) {
            manualReview += 1;
          }

          continue;
        }

        const reversalId =
          String(
            existingReversal.id,
          );

        const saved =
          await finish(
            jobId,
            leaseToken,
            "confirmed",
            reversalId,
            minimalReversalReceipt(
              existingReversal,
            ),
            "",
          );

        if (saved) {
          confirmed += 1;
        }

        continue;
      }

      const amountReversed =
        nonNegativeSafeInteger(
          transfer
            ?.amount_reversed,
        );

      const remainingAmount =
        expectedAmountMinor -
        amountReversed;

      if (
        remainingAmount <
        amountMinor
      ) {
        const saved =
          await finish(
            jobId,
            leaseToken,
            "manual_review",
            "",
            {
              transferId,
              expectedAmountMinor,
              amountReversed,
            },
            "Transfer was already reversed outside this RC ORDERA job",
          );

        if (saved) {
          manualReview += 1;
        }

        continue;
      }

      const reversalResult =
        await createStripeTransferReversal(
          stripeKey,
          transferId,
          jobId,
          jobPaymentTransactionId,
          amountMinor,
        );

      if (
        !reversalResult.ok
      ) {
        const finalStatus =
          (
            reversalResult
              .retryable ||
            reversalResult
              .uncertain
          ) &&
          attempts <
            MAX_AUTOMATIC_ATTEMPTS
            ? "failed"
            : "manual_review";

        const saved =
          await finish(
            jobId,
            leaseToken,
            finalStatus,
            "",
            {},
            reversalResult.error,
          );

        if (saved) {
          if (
            finalStatus ===
            "failed"
          ) {
            failed += 1;
          } else {
            manualReview += 1;
          }
        }

        continue;
      }

      const reversal =
        reversalResult.data;

      if (
        !validateReversal(
          reversal,
          transferId,
          amountMinor,
          currency,
        )
      ) {
        const saved =
          await finish(
            jobId,
            leaseToken,
            "manual_review",
            "",
            minimalReversalReceipt(
              reversal,
            ),
            "Stripe reversal response does not match RC ORDERA job",
          );

        if (saved) {
          manualReview += 1;
        }

        continue;
      }

      const reversalId =
        String(
          reversal.id,
        );

      const saved =
        await finish(
          jobId,
          leaseToken,
          "confirmed",
          reversalId,
          minimalReversalReceipt(
            reversal,
          ),
          "",
        );

      if (saved) {
        confirmed += 1;
      }
    } catch (error) {
      const finalStatus =
        attempts <
          MAX_AUTOMATIC_ATTEMPTS
          ? "failed"
          : "manual_review";

      const saved =
        await finish(
          jobId,
          leaseToken,
          finalStatus,
          "",
          {},
          safeErrorMessage(
            error,
            "Refund reversal worker failed",
          ),
        );

      if (saved) {
        if (
          finalStatus ===
          "failed"
        ) {
          failed += 1;
        } else {
          manualReview += 1;
        }
      }
    }
  }

  return response(
    200,
    {
      processed,
      confirmed,
      failed,
      manualReview,
    },
  );
});

