import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const STRIPE_TIMEOUT_MS = 15_000;
const MAX_REASON_LENGTH = 500;
const MAX_REQUEST_BYTES = 16_384;
const MAX_AUTH_HEADER_LENGTH = 4_096;

type StripeCheckoutSession = {
  id?: string;
  status?:
    | "open"
    | "complete"
    | "expired"
    | string
    | null;
  payment_status?:
    | "paid"
    | "unpaid"
    | "no_payment_required"
    | string
    | null;
  client_reference_id?:
    | string
    | null;
  metadata?:
    | Record<string, string>
    | null;
};

function response(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "content-type":
          "application/json; charset=utf-8",
        "cache-control":
          "no-store",
        "x-content-type-options":
          "nosniff",
      },
    },
  );
}

function normalize(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase();
}

function isOnlinePaymentMethod(
  value: unknown,
) {
  return [
    "online",
    "pago en linea",
    "pago en línea",
    "online payment",
  ].includes(
    normalize(value),
  );
}

function isValidUuid(
  value: unknown,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
      .trim(),
  );
}

function isValidCheckoutSessionId(
  value: unknown,
) {
  const id =
    String(value ?? "")
      .trim();

  return (
    id.length >= 8 &&
    id.length <= 255 &&
    /^cs_[A-Za-z0-9_]+$/.test(
      id,
    )
  );
}

async function readJsonSafe(
  result: Response,
) {
  try {
    return await result.json();
  } catch {
    return {};
  }
}

async function stripeRequest(
  stripeKey: string,
  url: string,
  init: RequestInit,
) {
  try {
    const headers =
      new Headers(
        init.headers || {},
      );

    headers.set(
      "Authorization",
      `Bearer ${stripeKey}`,
    );

    return await fetch(
      url,
      {
        ...init,
        headers,
        signal:
          AbortSignal.timeout(
            STRIPE_TIMEOUT_MS,
          ),
      },
    );
  } catch {
    return null;
  }
}

async function retrieveCheckoutSession(
  stripeKey: string,
  sessionId: string,
): Promise<
  | {
      ok: true;
      session:
        StripeCheckoutSession;
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const result =
    await stripeRequest(
      stripeKey,
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
      },
    );

  if (!result) {
    return {
      ok: false,
      status: 503,
      error:
        "Payment provider is temporarily unavailable",
    };
  }

  const body =
    await readJsonSafe(
      result,
    );

  if (!result.ok) {
    console.error(
      "Stripe Checkout retrieve failed",
      {
        status:
          result.status,
        error:
          String(
            body?.error?.message ||
              "",
          ).slice(
            0,
            300,
          ),
      },
    );

    return {
      ok: false,
      status:
        result.status >= 500 ||
        result.status === 429
          ? 503
          : 502,
      error:
        "Could not verify payment state",
    };
  }

  return {
    ok: true,
    session:
      body as StripeCheckoutSession,
  };
}

async function expireCheckoutSession(
  stripeKey: string,
  sessionId: string,
): Promise<
  | {
      ok: true;
      session:
        StripeCheckoutSession;
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const result =
    await stripeRequest(
      stripeKey,
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: "",
      },
    );

  if (!result) {
    return {
      ok: false,
      status: 503,
      error:
        "Payment provider is temporarily unavailable",
    };
  }

  const body =
    await readJsonSafe(
      result,
    );

  if (!result.ok) {
    console.error(
      "Stripe Checkout expire failed",
      {
        status:
          result.status,
        error:
          String(
            body?.error?.message ||
              "",
          ).slice(
            0,
            300,
          ),
      },
    );

    return {
      ok: false,
      status:
        result.status >= 500 ||
        result.status === 429
          ? 503
          : 409,
      error:
        "Could not expire payment session",
    };
  }

  return {
    ok: true,
    session:
      body as StripeCheckoutSession,
  };
}

function checkoutBelongsToTransaction(
  session:
    StripeCheckoutSession,
  orderId: string,
  transactionId: string,
) {
  const sessionOrderId =
    String(
      session
        ?.metadata
        ?.customer_order_id ||
        session
          ?.client_reference_id ||
        "",
    ).trim();

  const sessionTransactionId =
    String(
      session
        ?.metadata
        ?.transaction_id ||
        "",
    ).trim();

  return (
    sessionOrderId ===
      orderId &&
    sessionTransactionId ===
      transactionId
  );
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

    const anonKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      ) || "";

    const serviceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) || "";

    const stripeKey =
      Deno.env.get(
        "STRIPE_SECRET_KEY",
      ) || "";

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceKey
    ) {
      return response(
        503,
        {
          error:
            "Service is not configured",
        },
      );
    }

    const declaredLength =
      Number(
        request.headers.get(
          "content-length",
        ) || "0",
      );

    if (
      Number.isFinite(
        declaredLength,
      ) &&
      declaredLength >
        MAX_REQUEST_BYTES
    ) {
      return response(
        413,
        {
          error:
            "Payload too large",
        },
      );
    }

    const authorization =
      request.headers.get(
        "authorization",
      ) || "";

    if (
      !authorization ||
      authorization.length >
        MAX_AUTH_HEADER_LENGTH
    ) {
      return response(
        401,
        {
          error:
            "Session expired",
        },
      );
    }

    const accessToken =
      authorization
        .replace(
          /^Bearer\s+/i,
          "",
        )
        .trim();

    if (!accessToken) {
      return response(
        401,
        {
          error:
            "Session expired",
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

    const userClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
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

    const {
      data: userData,
      error: userError,
    } =
      await admin.auth.getUser(
        accessToken,
      );

    const user =
      userData?.user ||
      null;

    if (
      userError ||
      !user
    ) {
      return response(
        401,
        {
          error:
            "Session expired",
        },
      );
    }

    let payload: {
      orderId?: string;
      reason?: string;
    } = {};

    try {
      payload =
        await request.json();
    } catch {
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
        payload.orderId ||
          "",
      ).trim();

    const reason =
      String(
        payload.reason ||
          "Cancelado por el restaurante",
      )
        .trim()
        .slice(
          0,
          MAX_REASON_LENGTH,
        );

    if (
      !isValidUuid(
        orderId,
      )
    ) {
      return response(
        400,
        {
          error:
            "Invalid order",
        },
      );
    }

    const orderResult =
      await admin
        .from(
          "customer_orders",
        )
        .select(
          "id,user_id,status,payment_method,payment_status,order_json",
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

    if (
      order.user_id !==
      user.id
    ) {
      return response(
        403,
        {
          error:
            "Not authorized",
        },
      );
    }

    const orderStatus =
      normalize(
        order.status,
      );

    if (
      orderStatus ===
      "cancelled"
    ) {
      return response(
        200,
        {
          cancelled: true,
          alreadyCancelled:
            true,
        },
      );
    }

    if (
      ![
        "pending",
        "accepted",
        "sent",
      ].includes(
        orderStatus,
      )
    ) {
      return response(
        409,
        {
          error:
            "Order can no longer be cancelled",
          code:
            "ORDER_NOT_CANCELLABLE",
        },
      );
    }

    const paymentMethod =
      order.payment_method ||
      order
        .order_json
        ?.paymentMethod ||
      "";

    const onlinePayment =
      isOnlinePaymentMethod(
        paymentMethod,
      );

    const cancelThroughCore =
      async () => {
        const transition =
          await userClient.rpc(
            "transition_customer_order_status",
            {
              p_customer_order_id:
                orderId,
              p_next_status:
                "cancelled",
              p_reason:
                reason,
            },
          );

        if (
          transition.error
        ) {
          const message =
            String(
              transition
                .error
                .message ||
                "",
            );

          if (
            /ONLINE_PAYMENT_CANCELLATION_REQUIRES_GATEWAY/i.test(
              message,
            )
          ) {
            return response(
              409,
              {
                error:
                  "Online payment must be resolved before cancellation",
                code:
                  "ONLINE_PAYMENT_CANCELLATION_REQUIRES_GATEWAY",
                retryable:
                  true,
              },
            );
          }

          if (
            /ONLINE_PAYMENT_CANCELLATION_REQUIRES_REFUND/i.test(
              message,
            )
          ) {
            return response(
              409,
              {
                error:
                  "The order has captured funds and requires a refund flow",
                code:
                  "ONLINE_PAYMENT_CANCELLATION_REQUIRES_REFUND",
              },
            );
          }

          return response(
            409,
            {
              error:
                "Could not cancel order",
              code:
                "ORDER_CANCEL_FAILED",
            },
          );
        }

        return response(
          200,
          {
            cancelled:
              true,
          },
        );
      };

    if (!onlinePayment) {
      return await cancelThroughCore();
    }

    const paymentStatus =
      normalize(
        order.payment_status ||
          "pending",
      );

    if (
      [
        "paid",
        "partially_refunded",
      ].includes(
        paymentStatus,
      )
    ) {
      return response(
        409,
        {
          error:
            "The order has captured funds and requires a refund flow",
          code:
            "ONLINE_PAYMENT_CANCELLATION_REQUIRES_REFUND",
        },
      );
    }

    const paymentsResult =
      await admin
        .from(
          "payment_transactions",
        )
        .select(
          "id,status,provider,provider_session_id,provider_reference,created_at",
        )
        .eq(
          "customer_order_id",
          orderId,
        )
        .eq(
          "provider",
          "stripe_connect",
        )
        .in(
          "status",
          [
            "pending",
            "authorized",
            "paid",
            "partially_refunded",
          ],
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        );

    if (
      paymentsResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not read payment attempts",
        },
      );
    }

    const activePayments =
      paymentsResult.data ||
      [];

    if (
      activePayments.some(
        (payment: any) =>
          [
            "paid",
            "partially_refunded",
            "authorized",
          ].includes(
            normalize(
              payment.status,
            ),
          ),
      )
    ) {
      return response(
        409,
        {
          error:
            "The order has a payment that must be reconciled before cancellation",
          code:
            "PAYMENT_REQUIRES_RECONCILIATION",
        },
      );
    }

    if (
      activePayments.length >
        0 &&
      !stripeKey
    ) {
      return response(
        503,
        {
          error:
            "Online payments are not configured",
          retryable:
            true,
        },
      );
    }

    const safePendingTransactions:
      string[] = [];

    for (
      const payment
      of activePayments
    ) {
      const transactionId =
        String(
          payment.id ||
            "",
        ).trim();

      const sessionId =
        String(
          payment
            .provider_session_id ||
            "",
        ).trim();

      if (
        !transactionId ||
        !isValidUuid(
          transactionId,
        )
      ) {
        return response(
          500,
          {
            error:
              "Payment transaction is invalid",
          },
        );
      }

      /*
       * Estado indeterminado.
       *
       * La solicitud de Checkout pudo haber llegado a Stripe
       * pero nuestra aplicación todavía no tiene session_id.
       *
       * Fallamos cerrado.
       */
      if (!sessionId) {
        return response(
          503,
          {
            error:
              "Payment state is still being resolved. Retry cancellation shortly.",
            code:
              "PAYMENT_STATE_UNRESOLVED",
            retryable:
              true,
          },
        );
      }

      if (
        !isValidCheckoutSessionId(
          sessionId,
        )
      ) {
        return response(
          500,
          {
            error:
              "Stored Checkout Session is invalid",
          },
        );
      }

      let sessionResult =
        await retrieveCheckoutSession(
          stripeKey,
          sessionId,
        );

      if (
        !sessionResult.ok
      ) {
        return response(
          sessionResult.status,
          {
            error:
              sessionResult.error,
            code:
              "PAYMENT_PROVIDER_VERIFICATION_FAILED",
            retryable:
              sessionResult.status ===
              503,
          },
        );
      }

      let session =
        sessionResult.session;

      if (
        !checkoutBelongsToTransaction(
          session,
          orderId,
          transactionId,
        )
      ) {
        return response(
          409,
          {
            error:
              "Checkout Session does not match the order transaction",
            code:
              "PAYMENT_SESSION_MISMATCH",
          },
        );
      }

      const sessionStatus =
        normalize(
          session.status,
        );

      const sessionPaymentStatus =
        normalize(
          session.payment_status,
        );

      /*
       * complete puede significar que el procesamiento
       * todavía está en curso.
       *
       * Nunca cancelar automáticamente aquí.
       */
      if (
        sessionStatus ===
        "complete"
      ) {
        return response(
          409,
          {
            error:
              sessionPaymentStatus ===
              "paid"
                ? "Payment is already complete and must be reconciled before cancellation"
                : "Payment processing has already started and must finish before cancellation",

            code:
              sessionPaymentStatus ===
              "paid"
                ? "PAYMENT_ALREADY_CAPTURED"
                : "PAYMENT_PROCESSING",

            retryable:
              sessionPaymentStatus !==
              "paid",
          },
        );
      }

      /*
       * Solo Stripe puede declarar la sesión expired.
       */
      if (
        sessionStatus ===
        "open"
      ) {
        const expireResult =
          await expireCheckoutSession(
            stripeKey,
            sessionId,
          );

        if (
          expireResult.ok &&
          normalize(
            expireResult
              .session
              .status,
          ) ===
            "expired"
        ) {
          session =
            expireResult.session;
        } else {
          /*
           * Puede existir carrera:
           * la sesión cambió justo al intentar expirar.
           * Reconsultamos Stripe.
           */
          sessionResult =
            await retrieveCheckoutSession(
              stripeKey,
              sessionId,
            );

          if (
            !sessionResult.ok
          ) {
            return response(
              sessionResult.status,
              {
                error:
                  sessionResult.error,
                code:
                  "PAYMENT_PROVIDER_VERIFICATION_FAILED",
                retryable:
                  sessionResult.status ===
                  503,
              },
            );
          }

          session =
            sessionResult.session;
        }
      }

      if (
        !checkoutBelongsToTransaction(
          session,
          orderId,
          transactionId,
        )
      ) {
        return response(
          409,
          {
            error:
              "Checkout Session does not match the order transaction",
            code:
              "PAYMENT_SESSION_MISMATCH",
          },
        );
      }

      const finalStatus =
        normalize(
          session.status,
        );

      const finalPaymentStatus =
        normalize(
          session.payment_status,
        );

      if (
        finalStatus ===
        "complete"
      ) {
        return response(
          409,
          {
            error:
              finalPaymentStatus ===
              "paid"
                ? "Payment is already complete and must be reconciled before cancellation"
                : "Payment processing has already started and must finish before cancellation",

            code:
              finalPaymentStatus ===
              "paid"
                ? "PAYMENT_ALREADY_CAPTURED"
                : "PAYMENT_PROCESSING",

            retryable:
              finalPaymentStatus !==
              "paid",
          },
        );
      }

      if (
        finalStatus !==
        "expired"
      ) {
        return response(
          503,
          {
            error:
              "Checkout Session could not be safely expired",
            code:
              "PAYMENT_STATE_UNRESOLVED",
            retryable:
              true,
          },
        );
      }

      safePendingTransactions.push(
        transactionId,
      );
    }

    /*
     * Solo después de confirmar TODAS las sesiones como expired
     * marcamos los intentos locales como failed.
     */
    for (
      const transactionId
      of safePendingTransactions
    ) {
      const failed =
        await admin.rpc(
          "rc_ordera_mark_payment_failed",
          {
            p_payment_transaction_id:
              transactionId,
            p_reason:
              "Checkout Session expired before restaurant cancellation",
          },
        );

      if (
        failed.error
      ) {
        return response(
          500,
          {
            error:
              "Could not finalize cancelled payment attempt",
          },
        );
      }
    }

    /*
     * Revalidar por si un webhook confirmó el pago
     * mientras expirábamos las sesiones.
     */
    const verificationOrder =
      await admin
        .from(
          "customer_orders",
        )
        .select(
          "status,payment_status",
        )
        .eq(
          "id",
          orderId,
        )
        .maybeSingle();

    if (
      verificationOrder.error ||
      !verificationOrder.data
    ) {
      return response(
        500,
        {
          error:
            "Could not verify order after payment cancellation",
        },
      );
    }

    if (
      normalize(
        verificationOrder
          .data.status,
      ) ===
      "cancelled"
    ) {
      return response(
        200,
        {
          cancelled: true,
          alreadyCancelled:
            true,
        },
      );
    }

    if (
      [
        "paid",
        "partially_refunded",
      ].includes(
        normalize(
          verificationOrder
            .data
            .payment_status,
        ),
      )
    ) {
      return response(
        409,
        {
          error:
            "Payment was confirmed during cancellation and requires reconciliation",
          code:
            "PAYMENT_ALREADY_CAPTURED",
        },
      );
    }

    /*
     * Última barrera:
     * si apareció un nuevo intento concurrente,
     * no cancelamos.
     */
    const remainingPayments =
      await admin
        .from(
          "payment_transactions",
        )
        .select(
          "id,status",
        )
        .eq(
          "customer_order_id",
          orderId,
        )
        .eq(
          "provider",
          "stripe_connect",
        )
        .in(
          "status",
          [
            "pending",
            "authorized",
            "paid",
            "partially_refunded",
          ],
        )
        .limit(1);

    if (
      remainingPayments.error
    ) {
      return response(
        500,
        {
          error:
            "Could not verify payment state",
        },
      );
    }

    if (
      (
        remainingPayments.data ||
        []
      ).length > 0
    ) {
      return response(
        409,
        {
          error:
            "A payment attempt became active during cancellation. Retry safely.",
          code:
            "PAYMENT_STATE_CHANGED",
          retryable:
            true,
        },
      );
    }

    return await cancelThroughCore();
  },
);
