import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const STRIPE_REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_BODY_BYTES = 16_384;
const MAX_AUTHORIZATION_HEADER_LENGTH = 8_192;
const MAX_PUBLIC_TOKEN_LENGTH = 512;
const MAX_STRIPE_ERROR_MESSAGE_LENGTH = 400;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responseHeaders = {
  ...corsHeaders,
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

type CheckoutPayload = {
  orderId?: string;
  publicToken?: string;
};

type ValidatedCheckoutSession = {
  id: string;
  url: string;
  expiresAt: string;
};

function response(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: responseHeaders,
    },
  );
}

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeAppBaseUrl(
  rawValue: string,
) {
  const value =
    rawValue.trim();

  if (!value) {
    return "";
  }

  try {
    const url =
      new URL(value);

    const localDevelopment =
      url.protocol === "http:" &&
      [
        "localhost",
        "127.0.0.1",
        "::1",
      ].includes(
        url.hostname,
      );

    if (
      url.protocol !== "https:" &&
      !localDevelopment
    ) {
      return "";
    }

    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return "";
    }

    const pathname =
      url.pathname.replace(
        /\/+$/,
        "",
      );

    return `${url.origin}${pathname}`;
  } catch {
    return "";
  }
}

function isSafeStripeCheckoutUrl(
  value: unknown,
) {
  if (
    typeof value !== "string" ||
    !value
  ) {
    return false;
  }

  try {
    const url =
      new URL(value);

    return (
      url.protocol === "https:" &&
      url.hostname ===
        "checkout.stripe.com" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isValidStripeAccountId(
  value: unknown,
) {
  return (
    typeof value === "string" &&
    /^acct_[A-Za-z0-9]+$/.test(
      value,
    )
  );
}

function isValidStripeCheckoutSessionId(
  value: unknown,
) {
  return (
    typeof value === "string" &&
    value.length <= 255 &&
    /^cs_[A-Za-z0-9_]+$/.test(
      value,
    )
  );
}

function safeStripeErrorMessage(
  value: unknown,
  fallback: string,
) {
  const message =
    typeof value === "string"
      ? value.trim()
      : "";

  return (
    message || fallback
  ).slice(
    0,
    MAX_STRIPE_ERROR_MESSAGE_LENGTH,
  );
}

async function readJsonBodyLimited(
  request: Request,
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
      Number(
        declaredLength,
      );

    if (
      Number.isSafeInteger(
        declaredBytes,
      ) &&
      declaredBytes >
        MAX_REQUEST_BODY_BYTES
    ) {
      throw new RangeError(
        "REQUEST_BODY_TOO_LARGE",
      );
    }
  }

  if (!request.body) {
    return {};
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
        MAX_REQUEST_BODY_BYTES
      ) {
        await reader
          .cancel(
            "Payload too large",
          )
          .catch(
            () => undefined,
          );

        throw new RangeError(
          "REQUEST_BODY_TOO_LARGE",
        );
      }

      chunks.push(
        value,
      );
    }
  } finally {
    reader.releaseLock();
  }

  const merged =
    new Uint8Array(
      totalBytes,
    );

  let offset = 0;

  for (
    const chunk of chunks
  ) {
    merged.set(
      chunk,
      offset,
    );

    offset +=
      chunk.byteLength;
  }

  let text = "";

  try {
    text =
      new TextDecoder(
        "utf-8",
        {
          fatal: true,
        },
      ).decode(
        merged,
      );
  } catch {
    throw new TypeError(
      "REQUEST_BODY_INVALID_UTF8",
    );
  }

  try {
    return JSON.parse(
      text || "{}",
    );
  } catch {
    throw new SyntaxError(
      "REQUEST_BODY_INVALID_JSON",
    );
  }
}

function validateCheckoutSession(
  session: any,
  expected: {
    orderId: string;
    transactionId: string;
    amountMinor: number;
    currency: string;
  },
): ValidatedCheckoutSession | null {
  const id =
    String(
      session?.id || "",
    ).trim();

  const url =
    String(
      session?.url || "",
    ).trim();

  const expiresAt =
    Number(
      session?.expires_at,
    );

  const amountTotal =
    Number(
      session?.amount_total,
    );

  const currency =
    String(
      session?.currency || "",
    ).toLowerCase();

  const clientReferenceId =
    String(
      session?.client_reference_id ||
        "",
    ).trim();

  const metadataTransactionId =
    String(
      session
        ?.metadata
        ?.transaction_id ||
        "",
    ).trim();

  const metadataOrderId =
    String(
      session
        ?.metadata
        ?.customer_order_id ||
        "",
    ).trim();

  const nowSeconds =
    Math.floor(
      Date.now() / 1000,
    );

  if (
    session?.object !==
      "checkout.session" ||
    session?.mode !==
      "payment" ||
    session?.status !==
      "open" ||
    !isValidStripeCheckoutSessionId(
      id,
    ) ||
    !isSafeStripeCheckoutUrl(
      url,
    ) ||
    !Number.isSafeInteger(
      expiresAt,
    ) ||
    expiresAt <=
      nowSeconds ||
    !Number.isSafeInteger(
      amountTotal,
    ) ||
    amountTotal !==
      expected.amountMinor ||
    currency !==
      expected.currency ||
    clientReferenceId !==
      expected.orderId ||
    metadataTransactionId !==
      expected.transactionId ||
    metadataOrderId !==
      expected.orderId
  ) {
    return null;
  }

  return {
    id,
    url,
    expiresAt:
      new Date(
        expiresAt * 1000,
      ).toISOString(),
  };
}

Deno.serve(
  async (request) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

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

    const appBaseUrl =
      normalizeAppBaseUrl(
        Deno.env.get(
          "APP_BASE_URL",
        ) || "",
      );

    if (
      !supabaseUrl ||
      !serviceKey
    ) {
      return response(
        503,
        {
          error:
            "Backend is not configured",
        },
      );
    }

    let payload:
      CheckoutPayload = {};

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
              "Payload too large",
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

    const orderId =
      String(
        payload?.orderId ||
          "",
      ).trim();

    const suppliedToken =
      String(
        payload?.publicToken ||
          "",
      ).trim();

    if (
      !isUuid(
        orderId,
      )
    ) {
      return response(
        400,
        {
          error:
            "Order is invalid",
        },
      );
    }

    if (
      suppliedToken.length >
      MAX_PUBLIC_TOKEN_LENGTH
    ) {
      return response(
        400,
        {
          error:
            "Order access token is invalid",
        },
      );
    }

    const authorization =
      request.headers.get(
        "authorization",
      ) || "";

    if (
      authorization.length >
      MAX_AUTHORIZATION_HEADER_LENGTH
    ) {
      return response(
        400,
        {
          error:
            "Authorization header is invalid",
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

    const accessToken =
      authorization.replace(
        /^Bearer\s+/i,
        "",
      );

    let user: any =
      null;

    if (accessToken) {
      const {
        data: userData,
      } =
        await admin.auth
          .getUser(
            accessToken,
          );

      user =
        userData?.user ||
        null;
    }

    const orderResult =
      await admin
        .from(
          "customer_orders",
        )
        .select(
          "id,user_id,customer_user_id,status,total,currency,payment_method,payment_status,order_json",
        )
        .eq(
          "id",
          orderId,
        )
        .maybeSingle();

    if (
      orderResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not read order",
        },
      );
    }

    const order =
      orderResult.data;

    if (!order) {
      return response(
        404,
        {
          error:
            "Order was not found",
        },
      );
    }

    const authenticatedCustomer =
      Boolean(
        user &&
        user.id ===
          order.customer_user_id,
      );

    let tokenMatches =
      false;

    if (
      !authenticatedCustomer &&
      suppliedToken.length >=
        8
    ) {
      const tokenResult =
        await admin.rpc(
          "rc_ordera_customer_token_matches",
          {
            p_order_id:
              order.id,
            p_public_token:
              suppliedToken,
          },
        );

      if (
        tokenResult.error
      ) {
        console.error(
          "marketplace-checkout token validation failed",
          tokenResult.error,
        );

        return response(
          500,
          {
            error:
              "Could not validate order access",
          },
        );
      }

      tokenMatches =
        tokenResult.data ===
        true;
    }

    if (
      !authenticatedCustomer &&
      !tokenMatches
    ) {
      return response(
        403,
        {
          error:
            "Not authorized",
        },
      );
    }

    const paymentStatus =
      String(
        order.payment_status ||
          "",
      )
        .trim()
        .toLowerCase();

    if (
      paymentStatus ===
      "paid"
    ) {
      return response(
        409,
        {
          error:
            "Order is already paid",
        },
      );
    }

    if (
      ![
        "",
        "pending",
        "failed",
      ].includes(
        paymentStatus,
      )
    ) {
      return response(
        409,
        {
          error:
            "Order payment state does not allow a new checkout",
        },
      );
    }

    if (
      order.status !==
      "pending"
    ) {
      return response(
        409,
        {
          error:
            "Order can no longer be paid online",
        },
      );
    }

    if (
      String(
        order.payment_method ||
          "",
      ).toLowerCase() !==
      "online"
    ) {
      return response(
        409,
        {
          error:
            "Order was not created for online payment",
        },
      );
    }

    if (
      !stripeKey ||
      !appBaseUrl
    ) {
      return response(
        503,
        {
          error:
            "Online payments are not configured",
        },
      );
    }

    const amount =
      Number(
        order.total,
      );

    const amountMinor =
      Math.round(
        amount * 100,
      );

    const currency =
      String(
        order.currency ||
          "",
      )
        .trim()
        .toLowerCase();

    if (
      !Number.isFinite(
        amount,
      ) ||
      amount <= 0 ||
      !Number.isSafeInteger(
        amountMinor,
      ) ||
      amountMinor <= 0 ||
      !/^[a-z]{3}$/.test(
        currency,
      )
    ) {
      return response(
        409,
        {
          error:
            "Invalid order total or currency",
        },
      );
    }

    const restaurantResult =
      await admin
        .from(
          "restaurant_profiles",
        )
        .select(
          "business_name,country_code",
        )
        .eq(
          "user_id",
          order.user_id,
        )
        .eq(
          "active",
          true,
        )
        .is(
          "deleted_at",
          null,
        )
        .maybeSingle();

    if (
      restaurantResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not read restaurant",
        },
      );
    }

    const restaurant =
      restaurantResult.data;

    if (!restaurant) {
      return response(
        409,
        {
          error:
            "Online payments are not enabled for this restaurant",
        },
      );
    }

    const countryCode =
      String(
        restaurant.country_code ||
          "",
      )
        .trim()
        .toUpperCase();

    if (
      !/^[A-Z]{2}$/.test(
        countryCode,
      )
    ) {
      return response(
        409,
        {
          error:
            "Restaurant country is invalid",
        },
      );
    }

    const providerResult =
      await admin
        .from(
          "marketplace_provider_availability",
        )
        .select(
          "provider,online_payments_enabled,marketplace_split_enabled",
        )
        .eq(
          "country_code",
          countryCode,
        )
        .maybeSingle();

    if (
      providerResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not read payment availability",
        },
      );
    }

    if (
      providerResult.data
        ?.provider !==
        "stripe_connect" ||
      !providerResult.data
        ?.online_payments_enabled ||
      !providerResult.data
        ?.marketplace_split_enabled
    ) {
      return response(
        409,
        {
          error:
            "Online marketplace payments are not available in this country",
        },
      );
    }

    const settingsResult =
      await admin
        .from(
          "app_settings",
        )
        .select(
          "settings",
        )
        .eq(
          "user_id",
          order.user_id,
        )
        .maybeSingle();

    if (
      settingsResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not read restaurant payment settings",
        },
      );
    }

    if (
      String(
        settingsResult
          .data
          ?.settings
          ?.onlinePaymentProvider ||
          "disabled",
      ).toLowerCase() !==
      "stripe"
    ) {
      return response(
        409,
        {
          error:
            "Restaurant has not enabled online payments",
        },
      );
    }

    const payoutResult =
      await admin
        .from(
          "marketplace_accounts",
        )
        .select(
          "provider_account_id,onboarding_status,payouts_enabled,country_code,currency",
        )
        .eq(
          "owner_user_id",
          order.user_id,
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
      payoutResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not read payout account",
        },
      );
    }

    const payoutAccount =
      payoutResult.data;

    if (
      !payoutAccount ||
      payoutAccount.onboarding_status !==
        "complete" ||
      !payoutAccount.payouts_enabled ||
      !isValidStripeAccountId(
        payoutAccount.provider_account_id,
      )
    ) {
      return response(
        409,
        {
          error:
            "Restaurant payout account is not ready",
        },
      );
    }

    if (
      String(
        payoutAccount.country_code ||
          "",
      ).toUpperCase() !==
        countryCode ||
      String(
        payoutAccount.currency ||
          "",
      ).toLowerCase() !==
        currency
    ) {
      return response(
        409,
        {
          error:
            "Order currency does not match payout account",
        },
      );
    }

    const {
      data: attempts,
      error: attemptsError,
    } =
      await admin
        .from(
          "payment_transactions",
        )
        .select(
          "id,provider_session_id,checkout_url,expires_at,status,idempotency_key,created_at",
        )
        .eq(
          "customer_order_id",
          order.id,
        )
        .eq(
          "provider",
          "stripe_connect",
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

    if (
      attemptsError
    ) {
      return response(
        500,
        {
          error:
            "Could not read payment attempts",
        },
      );
    }

    const now =
      Date.now();

    const reusable =
      (
        attempts || []
      ).find(
        (attempt) => {
          if (
            attempt.status !==
              "pending" ||
            !attempt.checkout_url
          ) {
            return false;
          }

          const expiresAt =
            attempt.expires_at
              ? new Date(
                  attempt.expires_at,
                ).getTime()
              : NaN;

          if (
            !Number.isFinite(
              expiresAt,
            ) ||
            expiresAt <= now
          ) {
            return false;
          }

          return isSafeStripeCheckoutUrl(
            attempt.checkout_url,
          );
        },
      );

    if (reusable) {
      return response(
        200,
        {
          url:
            reusable.checkout_url,
          transactionId:
            reusable.id,
        },
      );
    }

    const malformedActiveAttempt =
      (
        attempts || []
      ).find(
        (attempt) => {
          if (
            attempt.status !==
              "pending" ||
            !attempt.checkout_url
          ) {
            return false;
          }

          const expiresAt =
            attempt.expires_at
              ? new Date(
                  attempt.expires_at,
                ).getTime()
              : NaN;

          return (
            !Number.isFinite(
              expiresAt,
            ) ||
            (
              expiresAt > now &&
              !isSafeStripeCheckoutUrl(
                attempt.checkout_url,
              )
            )
          );
        },
      );

    if (
      malformedActiveAttempt
    ) {
      return response(
        503,
        {
          error:
            "Stored checkout requires reconciliation before another payment attempt",
          retryable:
            false,
        },
      );
    }

    const unfinishedAttempt =
      (
        attempts || []
      ).find(
        (attempt) =>
          attempt.status ===
            "pending" &&
          !attempt.checkout_url &&
          attempt.idempotency_key,
      );

    const attemptNumber =
      (
        attempts || []
      ).length + 1;

    const idempotencyKey =
      unfinishedAttempt
        ?.idempotency_key ||
      `stripe-checkout:${order.id}:${attemptNumber}`;

    let transactionId =
      unfinishedAttempt?.id ||
      crypto.randomUUID();

    if (
      !isUuid(
        transactionId,
      ) ||
      idempotencyKey.length >
        255
    ) {
      return response(
        500,
        {
          error:
            "Payment reservation is invalid",
        },
      );
    }

    if (
      !unfinishedAttempt
    ) {
      const pendingAttempt = {
        id:
          transactionId,
        customer_order_id:
          order.id,
        provider:
          "stripe_connect",
        provider_reference:
          "",
        provider_session_id:
          "",
        payment_method:
          "online",
        status:
          "pending",
        amount,
        currency:
          currency.toUpperCase(),
        idempotency_key:
          idempotencyKey,
        checkout_url:
          "",
        transfer_group:
          `rc_ordera_${order.id}`,
        metadata: {
          restaurant_user_id:
            order.user_id,
          attempt:
            attemptNumber,
        },
        updated_at:
          new Date()
            .toISOString(),
      };

      const {
        data: reserved,
        error:
          reserveError,
      } =
        await admin
          .from(
            "payment_transactions",
          )
          .insert(
            pendingAttempt,
          )
          .select(
            "id",
          )
          .maybeSingle();

      if (
        reserveError
      ) {
        if (
          reserveError.code !==
          "23505"
        ) {
          return response(
            500,
            {
              error:
                "Could not reserve checkout",
            },
          );
        }

        const {
          data: concurrent,
        } =
          await admin
            .from(
              "payment_transactions",
            )
            .select(
              "id,checkout_url,expires_at",
            )
            .eq(
              "customer_order_id",
              order.id,
            )
            .eq(
              "idempotency_key",
              idempotencyKey,
            )
            .maybeSingle();

        if (
          !concurrent?.id
        ) {
          return response(
            409,
            {
              error:
                "Checkout is being prepared",
            },
          );
        }

        if (
          concurrent.checkout_url
        ) {
          const concurrentExpiry =
            concurrent.expires_at
              ? new Date(
                  concurrent.expires_at,
                ).getTime()
              : NaN;

          if (
            Number.isFinite(
              concurrentExpiry,
            ) &&
            concurrentExpiry >
              Date.now() &&
            isSafeStripeCheckoutUrl(
              concurrent.checkout_url,
            )
          ) {
            return response(
              200,
              {
                url:
                  concurrent.checkout_url,
                transactionId:
                  concurrent.id,
              },
            );
          }

          return response(
            503,
            {
              error:
                "Concurrent checkout requires reconciliation",
              retryable:
                false,
            },
          );
        }

        transactionId =
          concurrent.id;
      } else if (
        reserved?.id
      ) {
        transactionId =
          reserved.id;
      }
    }

    const successUrl =
      `${appBaseUrl}/cliente.html?store=${encodeURIComponent(
        order.user_id,
      )}&payment=success&order=${encodeURIComponent(
        order.id,
      )}`;

    const cancelUrl =
      `${appBaseUrl}/cliente.html?store=${encodeURIComponent(
        order.user_id,
      )}&payment=cancelled&order=${encodeURIComponent(
        order.id,
      )}`;

    const productName =
      `${String(
        restaurant.business_name ||
          "RC ORDERA",
      ).trim() || "RC ORDERA"} - pedido`
        .slice(
          0,
          127,
        );

    const form =
      new URLSearchParams(
        {
          mode:
            "payment",
          success_url:
            successUrl,
          cancel_url:
            cancelUrl,
          client_reference_id:
            order.id,
          "line_items[0][quantity]":
            "1",
          "line_items[0][price_data][currency]":
            currency,
          "line_items[0][price_data][unit_amount]":
            String(
              amountMinor,
            ),
          "line_items[0][price_data][product_data][name]":
            productName,
          "metadata[transaction_id]":
            transactionId,
          "metadata[customer_order_id]":
            order.id,
          "payment_intent_data[transfer_group]":
            `rc_ordera_${order.id}`,
          "payment_intent_data[metadata][transaction_id]":
            transactionId,
          "payment_intent_data[metadata][customer_order_id]":
            order.id,
        },
      );

    let stripeResult:
      Response;

    try {
      stripeResult =
        await fetch(
          "https://api.stripe.com/v1/checkout/sessions",
          {
            method:
              "POST",
            headers: {
              Authorization:
                `Bearer ${stripeKey}`,
              "Content-Type":
                "application/x-www-form-urlencoded",
              "Idempotency-Key":
                idempotencyKey,
            },
            body:
              form,
            signal:
              AbortSignal.timeout(
                STRIPE_REQUEST_TIMEOUT_MS,
              ),
          },
        );
    } catch {
      await admin
        .from(
          "payment_transactions",
        )
        .update({
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          transactionId,
        );

      return response(
        503,
        {
          error:
            "Payment provider response is pending. Retry safely.",
          retryable:
            true,
        },
      );
    }

    let session: any = {};

    try {
      session =
        await stripeResult
          .json();
    } catch {
      session = {};
    }

    if (
      !stripeResult.ok
    ) {
      const stripeShouldRetry =
        stripeResult
          .headers
          .get(
            "Stripe-Should-Retry",
          );

      const indeterminate =
        stripeShouldRetry ===
          "true" ||
        (
          stripeShouldRetry !==
            "false" &&
          (
            stripeResult.status ===
              409 ||
            stripeResult.status ===
              429 ||
            stripeResult.status >=
              500
          )
        );

      if (
        indeterminate
      ) {
        await admin
          .from(
            "payment_transactions",
          )
          .update({
            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            transactionId,
          );

        return response(
          503,
          {
            error:
              safeStripeErrorMessage(
                session
                  ?.error
                  ?.message,
                "Payment provider response is pending. Retry safely.",
              ),
            retryable:
              true,
          },
        );
      }

      const failedAt =
        new Date()
          .toISOString();

      await admin
        .from(
          "payment_transactions",
        )
        .update({
          status:
            "failed",
          failed_at:
            failedAt,
          updated_at:
            failedAt,
        })
        .eq(
          "id",
          transactionId,
        );

      return response(
        502,
        {
          error:
            safeStripeErrorMessage(
              session
                ?.error
                ?.message,
              "Payment provider error",
            ),
          retryable:
            false,
        },
      );
    }

    const validatedSession =
      validateCheckoutSession(
        session,
        {
          orderId:
            order.id,
          transactionId,
          amountMinor,
          currency,
        },
      );

    if (
      !validatedSession
    ) {
      const failedAt =
        new Date()
          .toISOString();

      const markFailed =
        await admin
          .from(
            "payment_transactions",
          )
          .update({
            status:
              "failed",
            failed_at:
              failedAt,
            updated_at:
              failedAt,
          })
          .eq(
            "id",
            transactionId,
          );

      if (
        markFailed.error
      ) {
        return response(
          500,
          {
            error:
              "Stripe checkout response was invalid and could not be reconciled",
          },
        );
      }

      return response(
        502,
        {
          error:
            "Stripe checkout response did not match the reserved order",
          retryable:
            false,
        },
      );
    }

    const {
      error:
        persistError,
    } =
      await admin
        .from(
          "payment_transactions",
        )
        .update({
          provider_session_id:
            validatedSession.id,
          status:
            "pending",
          checkout_url:
            validatedSession.url,
          expires_at:
            validatedSession.expiresAt,
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          transactionId,
        );

    if (
      persistError
    ) {
      return response(
        500,
        {
          error:
            "Could not persist checkout",
        },
      );
    }

    return response(
      200,
      {
        url:
          validatedSession.url,
        transactionId,
      },
    );
  },
);
