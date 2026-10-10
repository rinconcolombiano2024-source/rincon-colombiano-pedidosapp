import { toGrosz, fromGrosz, AccountingError } from "./money.mjs";

/** Adapta filas reales de Supabase (customer_orders, payment_transactions, ...) a la entrada canónica del cierre. */
export function fromCustomerOrderRow(row) {
  const j = row.order_json ?? {};
  function quantity(i) {
    const n = Number(i.quantity ?? i.qty ?? 1);
    if (!Number.isSafeInteger(n) || n < 1 || n > 999) throw new AccountingError("INVALID_QUANTITY", "Invalid item quantity");
    return n;
  }
  const items = Array.isArray(j.items) ? j.items.map((i) => ({
    lineTotal: i.total_snapshot ?? fromGrosz(toGrosz(i.unit_price_snapshot ?? i.price ?? 0) * quantity(i)),
    productId: i.product_id ?? i.productId ?? null,
    quantity: quantity(i),
    vatRate: i.vat_rate_snapshot ?? null,
    vatSnapshotPresent: Object.hasOwn(i, "vat_rate_snapshot"), // explicit null is unresolved, not a legacy default
  })) : null;
  return {
    id: row.id, status: row.status, total: row.total, currency: row.currency,
    payment_method: row.payment_method, payment_status: row.payment_status, created_at: row.created_at,
    channel: j.channel ?? "own_app",
    delivery_vat_rate: j.delivery_vat_rate_snapshot ?? null,
    deliveryVatSnapshotPresent: Object.hasOwn(j, "delivery_vat_rate_snapshot"),
    delivery_fee: row.final_delivery_fee ?? 0,
    ...(items ? { items } : {}),
  };
}
export const fromPaymentRow = (r) => ({ id: r.id, customer_order_id: r.customer_order_id, status: r.status, amount: r.amount, currency: r.currency, provider_reference: r.provider_reference, paid_at: r.paid_at });
