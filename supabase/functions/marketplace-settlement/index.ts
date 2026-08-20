import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "content-type": "application/json; charset=utf-8" };
function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function createTransfer(
  stripeKey: string,
  destination: string,
  amount: number,
  currency: string,
  transferGroup: string,
  idempotencyKey: string,
) {
  const result = await fetch("https://api.stripe.com/v1/transfers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: new URLSearchParams({
      destination,
      amount: String(Math.round(amount * 100)),
      currency: currency.toLowerCase(),
      transfer_group: transferGroup,
    }),
  });
  const body = await result.json();
  if (!result.ok) throw new Error(body?.error?.message || "Transfer failed");
  return body;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const settlementSecret = Deno.env.get("PAYMENT_SETTLEMENT_SECRET") || "";
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = request.headers.get("x-rc-ordera-settlement-secret") || "";
  const authorized = authorization === `Bearer ${serviceKey}` || (settlementSecret.length >= 24 && suppliedSecret === settlementSecret);
  if (!supabaseUrl || !serviceKey || !stripeKey || !authorized) return response(401, { error: "Unauthorized" });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: allocations, error } = await admin.from("marketplace_payment_allocations")
    .select("*,payment_transactions!inner(transfer_group,status)")
    .in("status", ["funds_held", "partially_released", "eligible", "failed"])
    .eq("payment_transactions.status", "paid")
    .order("created_at", { ascending: true }).limit(100);
  if (error) return response(500, { error: "Could not load settlements" });

  let processed = 0;
  for (const allocation of allocations || []) {
    let restaurantTransferId = allocation.restaurant_transfer_id || "";
    let courierTransferId = allocation.courier_transfer_id || "";
    const errors: string[] = [];
    const paymentTransaction = Array.isArray(allocation.payment_transactions)
      ? allocation.payment_transactions[0]
      : allocation.payment_transactions;
    const transferGroup = paymentTransaction?.transfer_group || `rc_ordera_${allocation.customer_order_id}`;

    if (allocation.restaurant_release_eligible_at && !restaurantTransferId && Number(allocation.restaurant_net_amount) > 0) {
      try {
        const { data: account } = await admin.from("marketplace_accounts")
          .select("provider_account_id,payouts_enabled,onboarding_status")
          .eq("owner_user_id", allocation.restaurant_user_id).eq("account_type", "restaurant")
          .eq("provider", "stripe_connect").maybeSingle();
        if (!account?.provider_account_id || !account.payouts_enabled || account.onboarding_status !== "complete") {
          throw new Error("Restaurant payout account is not ready");
        }
        const transfer = await createTransfer(stripeKey, account.provider_account_id, Number(allocation.restaurant_net_amount), allocation.currency, transferGroup, `restaurant:${allocation.id}`);
        restaurantTransferId = transfer.id;
      } catch (restaurantError) {
        errors.push(String(restaurantError instanceof Error ? restaurantError.message : restaurantError));
      }
    }

    if (allocation.courier_release_eligible_at && !courierTransferId && Number(allocation.courier_net_amount) > 0) {
      try {
        const { data: account } = await admin.from("marketplace_accounts")
          .select("provider_account_id,payouts_enabled,onboarding_status")
          .eq("owner_user_id", allocation.courier_user_id).eq("account_type", "courier")
          .eq("provider", "stripe_connect").maybeSingle();
        if (!account?.provider_account_id || !account.payouts_enabled || account.onboarding_status !== "complete") {
          throw new Error("Courier payout account is not ready");
        }
        const transfer = await createTransfer(stripeKey, account.provider_account_id, Number(allocation.courier_net_amount), allocation.currency, transferGroup, `courier:${allocation.id}`);
        courierTransferId = transfer.id;
      } catch (courierError) {
        errors.push(String(courierError instanceof Error ? courierError.message : courierError));
      }
    }

    const restaurantDone = Number(allocation.restaurant_net_amount) === 0 || Boolean(restaurantTransferId);
    const courierDone = Number(allocation.courier_net_amount) === 0 || Boolean(courierTransferId);
    const anyTransfer = Boolean(restaurantTransferId || courierTransferId);
    const nextStatus = restaurantDone && courierDone
      ? "settled"
      : anyTransfer
        ? "partially_released"
        : errors.length
          ? "failed"
          : "funds_held";
    const now = new Date().toISOString();
    await admin.from("marketplace_payment_allocations").update({
      restaurant_transfer_id: restaurantTransferId,
      courier_transfer_id: courierTransferId,
      restaurant_transferred_at: restaurantTransferId ? allocation.restaurant_transferred_at || now : null,
      courier_transferred_at: courierTransferId ? allocation.courier_transferred_at || now : null,
      status: nextStatus,
      last_error: errors.join(" | ").slice(0, 1000),
      updated_at: now,
    }).eq("id", allocation.id);
    processed += 1;
  }
  return response(200, { processed });
});
