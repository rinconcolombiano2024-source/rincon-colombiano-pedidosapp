import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const MAX_REQUEST_BODY_BYTES = 16_384;
const MAX_AUTHORIZATION_HEADER_LENGTH = 8_192;
const SETTLEMENT_REQUEST_TIMEOUT_MS = 10_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const responseHeaders = {
  ...corsHeaders,
  "content-type":
    "application/json; charset=utf-8",
  "cache-control":
    "no-store",
  "x-content-type-options":
    "nosniff",
};

type ReleasePayload = {
  orderId?: unknown;
};

function response(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers:
        responseHeaders,
    },
  );
}

function normalize(
  value: unknown,
) {
  return String(
    value || "",
  )
    .trim()
    .toLowerCase();
}

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function readBearerToken(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "authorization",
    ) || "";

  if (
    !authorization ||
    authorization.length >
      MAX_AUTHORIZATION_HEADER_LENGTH
  ) {
    return "";
  }

  const match =
    authorization.match(
      /^Bearer\s+(\S+)$/i,
    );

  return match?.[1] || "";
}

async function readJsonBodyLimited(
  request: Request,
): Promise<ReleasePayload> {
  const declared =
    Number(
      request.headers.get(
        "content-length",
      ) || 0,
    );

  if (
    Number.isFinite(
      declared,
    ) &&
    declared >
      MAX_REQUEST_BODY_BYTES
  ) {
    throw new RangeError(
      "REQUEST_BODY_TOO_LARGE",
    );
  }

  if (!request.body) {
    throw new SyntaxError(
      "REQUEST_BODY_MISSING",
    );
  }

  const reader =
    request.body.getReader();

  const chunks:
    Uint8Array[] = [];

  let total = 0;

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

      total +=
        value.byteLength;

      if (
        total >
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

      chunks.push(
        value,
      );
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Best effort.
    }
  }

  const merged =
    new Uint8Array(
      total,
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

  let raw = "";

  try {
    raw =
      new TextDecoder(
        "utf-8",
        {
          fatal: true,
        },
      ).decode(
        merged,
      );
  } catch {
    throw new SyntaxError(
      "REQUEST_BODY_INVALID_UTF8",
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        raw,
      );
  } catch {
    throw new SyntaxError(
      "REQUEST_BODY_INVALID_JSON",
    );
  }

  if (
    !parsed ||
    typeof parsed !==
      "object" ||
    Array.isArray(
      parsed,
    )
  ) {
    throw new SyntaxError(
      "REQUEST_BODY_INVALID_JSON",
    );
  }

  return parsed as
    ReleasePayload;
}

async function triggerSettlement(
  supabaseUrl: string,
  serviceKey: string,
  settlementSecret: string,
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      SETTLEMENT_REQUEST_TIMEOUT_MS,
    );

  const headers:
    Record<
      string,
      string
    > = {
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
  } else {
    /*
     * Compatibilidad temporal.
     * La ruta preferida es PAYMENT_SETTLEMENT_SECRET,
     * de menor alcance que service_role.
     */
    headers.Authorization =
      `Bearer ${serviceKey}`;
  }

  try {
    const result =
      await fetch(
        `${supabaseUrl}/functions/v1/marketplace-settlement`,
        {
          method:
            "POST",
          headers,
          body:
            "{}",
          signal:
            controller.signal,
        },
      );

    return result.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

Deno.serve(
  async (
    request,
  ) => {
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
      (
        Deno.env.get(
          "SUPABASE_URL",
        ) || ""
      ).replace(
        /\/+$/,
        "",
      );

    const serviceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) || "";

    const settlementSecret =
      Deno.env.get(
        "PAYMENT_SETTLEMENT_SECRET",
      ) || "";

    if (
      !supabaseUrl ||
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

    const token =
      readBearerToken(
        request,
      );

    if (!token) {
      return response(
        401,
        {
          error:
            "Session expired",
        },
      );
    }

    let payload:
      ReleasePayload;

    try {
      payload =
        await readJsonBodyLimited(
          request,
        );
    } catch (
      error
    ) {
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

    const orderId =
      String(
        payload.orderId ||
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
            "Order is required",
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

    const {
      data:
        userData,
      error:
        userError,
    } =
      await admin.auth
        .getUser(
          token,
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

    const orderResult =
      await admin
        .from(
          "customer_orders",
        )
        .select(
          "id,user_id,status,order_type,payment_method,payment_status",
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

    /*
     * Esta Edge Function solo participa en pagos online.
     * Efectivo/terminal no deben crear ni liberar allocations Stripe.
     */
    if (
      normalize(
        order.payment_method,
      ) !==
      "online"
    ) {
      return response(
        200,
        {
          settlementRequested:
            false,
          notApplicable:
            true,
        },
      );
    }

    if (
      normalize(
        order.status,
      ) !==
      "delivered"
    ) {
      return response(
        409,
        {
          error:
            "Order is not completed",
          code:
            "ORDER_NOT_DELIVERED",
        },
      );
    }

    if (
      normalize(
        order.payment_status,
      ) !==
      "paid"
    ) {
      return response(
        409,
        {
          error:
            "Online payment is not settled",
          code:
            "PAYMENT_NOT_PAID",
        },
      );
    }

    const allocationResult =
      await admin
        .from(
          "marketplace_payment_allocations",
        )
        .select(
          "id,payment_transaction_id,status,financial_hold,restaurant_release_eligible_at,restaurant_transfer_id,restaurant_transferred_at",
        )
        .eq(
          "customer_order_id",
          order.id,
        )
        .maybeSingle();

    if (
      allocationResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not read payment allocation",
        },
      );
    }

    let allocation =
      allocationResult.data;

    if (!allocation) {
      return response(
        409,
        {
          error:
            "Payment allocation is not available",
          code:
            "PAYMENT_ALLOCATION_MISSING",
        },
      );
    }

    if (
      allocation
        .financial_hold ===
      true
    ) {
      return response(
        409,
        {
          error:
            "Payment is under financial hold",
          code:
            "PAYMENT_FINANCIAL_HOLD",
        },
      );
    }

    const allocationStatus =
      normalize(
        allocation.status,
      );

    if (
      allocationStatus ===
      "refunded"
    ) {
      return response(
        409,
        {
          error:
            "Payment was refunded",
          code:
            "PAYMENT_REFUNDED",
        },
      );
    }

    if (
      allocationStatus ===
        "settled" ||
      Boolean(
        allocation
          .restaurant_transfer_id,
      ) ||
      Boolean(
        allocation
          .restaurant_transferred_at,
      )
    ) {
      return response(
        200,
        {
          settlementRequested:
            false,
          alreadyReleased:
            true,
        },
      );
    }

    const paymentResult =
      await admin
        .from(
          "payment_transactions",
        )
        .select(
          "id,customer_order_id,provider,status",
        )
        .eq(
          "id",
          allocation
            .payment_transaction_id,
        )
        .eq(
          "customer_order_id",
          order.id,
        )
        .maybeSingle();

    if (
      paymentResult.error
    ) {
      return response(
        500,
        {
          error:
            "Could not verify payment transaction",
        },
      );
    }

    const payment =
      paymentResult.data;

    if (
      !payment ||
      normalize(
        payment.provider,
      ) !==
        "stripe_connect" ||
      normalize(
        payment.status,
      ) !==
        "paid"
    ) {
      return response(
        409,
        {
          error:
            "Payment transaction is not eligible for release",
          code:
            "PAYMENT_TRANSACTION_NOT_PAID",
        },
      );
    }

    if (
      !allocation
        .restaurant_release_eligible_at
    ) {
      const now =
        new Date()
          .toISOString();

      const updateResult =
        await admin
          .from(
            "marketplace_payment_allocations",
          )
          .update({
            restaurant_release_eligible_at:
              now,
            updated_at:
              now,
          })
          .eq(
            "id",
            allocation.id,
          )
          .eq(
            "financial_hold",
            false,
          )
          .eq(
            "status",
            allocation.status,
          )
          .is(
            "restaurant_release_eligible_at",
            null,
          )
          .select(
            "id,status,financial_hold,restaurant_release_eligible_at,restaurant_transfer_id,restaurant_transferred_at",
          )
          .maybeSingle();

      if (
        updateResult.error
      ) {
        return response(
          500,
          {
            error:
              "Could not prepare settlement",
          },
        );
      }

      if (
        updateResult.data
      ) {
        allocation = {
          ...allocation,
          ...updateResult.data,
        };
      } else {
        /*
         * Otra transacción modificó la allocation.
         * Releer y decidir según el estado real.
         */
        const refreshedResult =
          await admin
            .from(
              "marketplace_payment_allocations",
            )
            .select(
              "id,status,financial_hold,restaurant_release_eligible_at,restaurant_transfer_id,restaurant_transferred_at",
            )
            .eq(
              "id",
              allocation.id,
            )
            .maybeSingle();

        if (
          refreshedResult.error ||
          !refreshedResult.data
        ) {
          return response(
            409,
            {
              error:
                "Payment allocation changed while preparing settlement",
              code:
                "PAYMENT_ALLOCATION_CHANGED",
              retryable:
                true,
            },
          );
        }

        allocation = {
          ...allocation,
          ...refreshedResult.data,
        };
      }
    }

    /*
     * P0-01 actúa aquí como barrera atómica:
     * para Domicilio, el trigger DB elimina esta fecha
     * si no existe prueba completa courier + customer.
     */
    if (
      !allocation
        .restaurant_release_eligible_at
    ) {
      return response(
        409,
        {
          error:
            "Delivery confirmation proof is incomplete",
          code:
            "DELIVERY_RELEASE_NOT_PROVEN",
        },
      );
    }

    if (
      allocation
        .financial_hold ===
      true ||
      normalize(
        allocation.status,
      ) ===
        "refunded"
    ) {
      return response(
        409,
        {
          error:
            "Payment can no longer be released",
          code:
            "PAYMENT_RELEASE_BLOCKED",
        },
      );
    }

    if (
      Boolean(
        allocation
          .restaurant_transfer_id,
      ) ||
      Boolean(
        allocation
          .restaurant_transferred_at,
      )
    ) {
      return response(
        200,
        {
          settlementRequested:
            false,
          alreadyReleased:
            true,
        },
      );
    }

    const settlementRequested =
      await triggerSettlement(
        supabaseUrl,
        serviceKey,
        settlementSecret,
      );

    /*
     * La cola DB es idempotente y ya fue creada por el trigger
     * de allocation. Un fallo HTTP del disparo inmediato no debe
     * deshacer la elegibilidad ni provocar un segundo movimiento.
     */
    return response(
      200,
      {
        settlementRequested,
        settlementQueued:
          true,
      },
    );
  },
);
