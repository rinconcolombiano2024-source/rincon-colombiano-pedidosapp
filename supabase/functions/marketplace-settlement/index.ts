import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const STRIPE_REQUEST_TIMEOUT_MS = 15_000;
const MAX_AUTHORIZATION_HEADER_LENGTH = 8_192;
const MAX_SETTLEMENT_SECRET_HEADER_LENGTH = 1_024;
const MAX_ERROR_MESSAGE_LENGTH = 1_000;

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function response(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers,
    },
  );
}

async function sha256Bytes(
  value: string,
) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        value,
      ),
    );

  return new Uint8Array(
    digest,
  );
}

async function constantTimeEqual(
  first: string,
  second: string,
) {
  if (
    !first ||
    !second
  ) {
    return false;
  }

  const [
    firstDigest,
    secondDigest,
  ] = await Promise.all([
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

function safeErrorMessage(
  error: unknown,
  fallback: string,
) {
  const message =
    error instanceof Error
      ? error.message
      : String(
          error || fallback,
        );

  return (
    message.trim() ||
    fallback
  ).slice(
    0,
    MAX_ERROR_MESSAGE_LENGTH,
  );
}

function toStripeMinorAmount(
  amount: number,
) {
  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Transfer amount is invalid",
    );
  }

  const minor =
    Math.round(amount * 100);

  if (
    !Number.isSafeInteger(
      minor,
    ) ||
    minor <= 0
  ) {
    throw new Error(
      "Transfer amount is invalid",
    );
  }

  return minor;
}

function validateStripeTransferInput(
  destination: string,
  currency: string,
  transferGroup: string,
  idempotencyKey: string,
) {
  if (
    !/^acct_[A-Za-z0-9]+$/.test(
      destination,
    )
  ) {
    throw new Error(
      "Stripe destination account is invalid",
    );
  }

  if (
    !/^[A-Za-z]{3}$/.test(
      currency,
    )
  ) {
    throw new Error(
      "Transfer currency is invalid",
    );
  }

  if (
    !transferGroup ||
    transferGroup.length >
      255
  ) {
    throw new Error(
      "Transfer group is invalid",
    );
  }

  if (
    !idempotencyKey ||
    idempotencyKey.length >
      255
  ) {
    throw new Error(
      "Transfer idempotency key is invalid",
    );
  }
}

async function createTransfer(
  stripeKey: string,
  destination: string,
  amount: number,
  currency: string,
  transferGroup: string,
  idempotencyKey: string,
) {
  validateStripeTransferInput(
    destination,
    currency,
    transferGroup,
    idempotencyKey,
  );

  const minorAmount =
    toStripeMinorAmount(
      amount,
    );

  const normalizedCurrency =
    currency.toLowerCase();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      STRIPE_REQUEST_TIMEOUT_MS,
    );

  let result: Response;

  try {
    result =
      await fetch(
        "https://api.stripe.com/v1/transfers",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${stripeKey}`,
            "Content-Type":
              "application/x-www-form-urlencoded",
            "Idempotency-Key":
              idempotencyKey,
          },
          body:
            new URLSearchParams(
              {
                destination,
                amount:
                  String(
                    minorAmount,
                  ),
                currency:
                  normalizedCurrency,
                transfer_group:
                  transferGroup,
              },
            ),
          signal:
            controller.signal,
        },
      );
  } catch (error) {
    if (
      error instanceof
        DOMException &&
      error.name ===
        "AbortError"
    ) {
      throw new Error(
        "Stripe transfer timed out",
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout,
    );
  }

  const rawBody =
    await result.text();

  let body: any = {};

  if (rawBody) {
    try {
      body =
        JSON.parse(
          rawBody,
        );
    } catch {
      if (!result.ok) {
        throw new Error(
          "Stripe transfer failed",
        );
      }

      throw new Error(
        "Stripe returned an invalid transfer response",
      );
    }
  }

  if (!result.ok) {
    throw new Error(
      safeErrorMessage(
        body?.error?.message,
        "Stripe transfer failed",
      ),
    );
  }

  const transferId =
    String(
      body?.id || "",
    ).trim();

  const returnedAmount =
    Number(
      body?.amount,
    );

  const returnedCurrency =
    String(
      body?.currency || "",
    ).toLowerCase();

  const returnedDestination =
    String(
      body?.destination || "",
    ).trim();

  if (
    !/^tr_[A-Za-z0-9]+$/.test(
      transferId,
    ) ||
    !Number.isSafeInteger(
      returnedAmount,
    ) ||
    returnedAmount !==
      minorAmount ||
    returnedCurrency !==
      normalizedCurrency ||
    returnedDestination !==
      destination
  ) {
    throw new Error(
      "Stripe transfer response does not match the requested transfer",
    );
  }

  return body;
}

Deno.serve(
  async (request) => {
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
      Deno.env.get(
        "SUPABASE_URL",
      ) || "";

    const serviceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) || "";

    const stripeKey =
      Deno.env.get(
        "STRIPE_SECRET_KEY",
      ) || "";

    const settlementSecret =
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
            "Settlement is not configured",
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
        MAX_SETTLEMENT_SECRET_HEADER_LENGTH
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

    const scheduledAuthorized =
      settlementSecret.length >=
        24 &&
      await constantTimeEqual(
        suppliedSecret,
        settlementSecret,
      );

    if (
      !serviceAuthorized &&
      !scheduledAuthorized
    ) {
      return response(
        401,
        {
          error:
            "Unauthorized",
        },
      );
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

    const claimedResult =
      await admin.rpc(
        "claim_marketplace_settlement_jobs",
        {
          p_limit: 25,
        },
      );

    if (
      claimedResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not claim settlement jobs",
        },
      );
    }

    const jobs =
      Array.isArray(
        claimedResult.data,
      )
        ? claimedResult.data
        : [];

    if (!jobs.length) {
      return response(
        200,
        {
          processed: 0,
        },
      );
    }

    const jobByAllocation =
      new Map(
        jobs.map(
          (job: any) => [
            String(
              job.allocation_id,
            ),
            job,
          ],
        ),
      );

    const {
      data: allocations,
      error,
    } =
      await admin
        .from(
          "marketplace_payment_allocations",
        )
        .select(
          "*,payment_transactions!inner(transfer_group,status)",
        )
        .in(
          "id",
          jobs.map(
            (job: any) =>
              job.allocation_id,
          ),
        )
        .in(
          "status",
          [
            "funds_held",
            "partially_released",
            "eligible",
            "failed",
          ],
        )
        .eq(
          "financial_hold",
          false,
        )
        .eq(
          "payment_transactions.status",
          "paid",
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        );

    if (error) {
      for (
        const job of jobs
      ) {
        await admin.rpc(
          "complete_marketplace_settlement_job",
          {
            p_job_id:
              job.job_id,
            p_completed:
              false,
            p_error:
              "Could not load settlement allocation",
          },
        );
      }

      return response(
        500,
        {
          error:
            "Could not load settlements",
        },
      );
    }

    let processed = 0;

    for (
      const allocation of
        allocations || []
    ) {
      const job =
        jobByAllocation.get(
          String(
            allocation.id,
          ),
        );

      if (!job?.job_id) {
        continue;
      }

      let restaurantTransferId =
        allocation.restaurant_transfer_id ||
        "";

      let courierTransferId =
        allocation.courier_transfer_id ||
        "";

      const errors:
        string[] = [];

      const paymentTransaction =
        Array.isArray(
          allocation.payment_transactions,
        )
          ? allocation
              .payment_transactions[0]
          : allocation.payment_transactions;

      const transferGroup =
        paymentTransaction
          ?.transfer_group ||
        `rc_ordera_${allocation.customer_order_id}`;

      if (
        allocation.restaurant_release_eligible_at &&
        !restaurantTransferId &&
        Number(
          allocation.restaurant_net_amount,
        ) > 0
      ) {
        try {
          const {
            data: account,
          } =
            await admin
              .from(
                "marketplace_accounts",
              )
              .select(
                "provider_account_id,payouts_enabled,onboarding_status",
              )
              .eq(
                "owner_user_id",
                allocation.restaurant_user_id,
              )
              .eq(
                "account_type",
                "restaurant",
              )
              .eq(
                "provider",
                "stripe_connect",
              )
              .maybeSingle();

          if (
            !account?.provider_account_id ||
            !account.payouts_enabled ||
            account.onboarding_status !==
              "complete"
          ) {
            throw new Error(
              "Restaurant payout account is not ready",
            );
          }

          const transfer =
            await createTransfer(
              stripeKey,
              account.provider_account_id,
              Number(
                allocation.restaurant_net_amount,
              ),
              allocation.currency,
              transferGroup,
              `restaurant:${allocation.id}`,
            );

          restaurantTransferId =
            String(
              transfer.id,
            );
        } catch (
          restaurantError
        ) {
          errors.push(
            safeErrorMessage(
              restaurantError,
              "Restaurant transfer failed",
            ),
          );
        }
      }

      if (
        allocation.courier_release_eligible_at &&
        !courierTransferId &&
        Number(
          allocation.courier_net_amount,
        ) > 0
      ) {
        try {
          const {
            data: account,
          } =
            await admin
              .from(
                "marketplace_accounts",
              )
              .select(
                "provider_account_id,payouts_enabled,onboarding_status",
              )
              .eq(
                "owner_user_id",
                allocation.courier_user_id,
              )
              .eq(
                "account_type",
                "courier",
              )
              .eq(
                "provider",
                "stripe_connect",
              )
              .maybeSingle();

          if (
            !account?.provider_account_id ||
            !account.payouts_enabled ||
            account.onboarding_status !==
              "complete"
          ) {
            throw new Error(
              "Courier payout account is not ready",
            );
          }

          const transfer =
            await createTransfer(
              stripeKey,
              account.provider_account_id,
              Number(
                allocation.courier_net_amount,
              ),
              allocation.currency,
              transferGroup,
              `courier:${allocation.id}`,
            );

          courierTransferId =
            String(
              transfer.id,
            );
        } catch (
          courierError
        ) {
          errors.push(
            safeErrorMessage(
              courierError,
              "Courier transfer failed",
            ),
          );
        }
      }

      const restaurantDone =
        Number(
          allocation.restaurant_net_amount,
        ) === 0 ||
        Boolean(
          restaurantTransferId,
        );

      const courierDone =
        Number(
          allocation.courier_net_amount,
        ) === 0 ||
        Boolean(
          courierTransferId,
        );

      const anyTransfer =
        Boolean(
          restaurantTransferId ||
          courierTransferId,
        );

      const nextStatus =
        restaurantDone &&
        courierDone
          ? "settled"
          : anyTransfer
            ? "partially_released"
            : errors.length
              ? "failed"
              : "funds_held";

      const now =
        new Date()
          .toISOString();

      const updateResult =
        await admin
          .from(
            "marketplace_payment_allocations",
          )
          .update({
            restaurant_transfer_id:
              restaurantTransferId,
            courier_transfer_id:
              courierTransferId,
            restaurant_transferred_at:
              restaurantTransferId
                ? allocation.restaurant_transferred_at ||
                  now
                : null,
            courier_transferred_at:
              courierTransferId
                ? allocation.courier_transferred_at ||
                  now
                : null,
            status:
              nextStatus,
            last_error:
              errors
                .join(
                  " | ",
                )
                .slice(
                  0,
                  MAX_ERROR_MESSAGE_LENGTH,
                ),
            updated_at:
              now,
          })
          .eq(
            "id",
            allocation.id,
          );

      if (
        updateResult.error
      ) {
        errors.push(
          "Could not persist transfer result",
        );
      }

      const eligibleRestaurantDone =
        !allocation.restaurant_release_eligible_at ||
        Number(
          allocation.restaurant_net_amount,
        ) === 0 ||
        Boolean(
          restaurantTransferId,
        );

      const eligibleCourierDone =
        !allocation.courier_release_eligible_at ||
        Number(
          allocation.courier_net_amount,
        ) === 0 ||
        Boolean(
          courierTransferId,
        );

      await admin.rpc(
        "complete_marketplace_settlement_job",
        {
          p_job_id:
            job.job_id,
          p_completed:
            errors.length ===
              0 &&
            eligibleRestaurantDone &&
            eligibleCourierDone,
          p_error:
            errors
              .join(
                " | ",
              )
              .slice(
                0,
                MAX_ERROR_MESSAGE_LENGTH,
              ),
        },
      );

      processed += 1;
    }

    const loadedAllocationIds =
      new Set(
        (
          allocations || []
        ).map(
          (
            allocation: any,
          ) =>
            String(
              allocation.id,
            ),
        ),
      );

    for (
      const job of jobs
    ) {
      if (
        loadedAllocationIds.has(
          String(
            job.allocation_id,
          ),
        )
      ) {
        continue;
      }

      await admin.rpc(
        "complete_marketplace_settlement_job",
        {
          p_job_id:
            job.job_id,
          p_completed:
            false,
          p_error:
            "Allocation is not eligible or is under financial hold",
        },
      );
    }

    return response(
      200,
      {
        processed,
      },
    );
  },
);
