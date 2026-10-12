/** Wolt — PROVISIONAL: contrastar con https://developer.wolt.com antes de producción. */
import { DeliveryAdapterError } from "../adapter-registry.mjs";
import { buildEvent, cleanCurrency, parseJson, pick, requestDescriptor, toGrosz, verifyWith } from "../canonical.mjs";

export const WOLT_META = Object.freeze({ provider: "wolt", provisional: true, docs: "https://developer.wolt.com" });

export function createWoltAdapter(options = {}) {
  const { webhookSecret, apiKey, baseUrl = "https://pos-integration-service.wolt.com" } = options;
  const scheme = options.verification ?? { type: "hmac-sha256", header: "x-wolt-signature", encoding: "hex" };
  return {
    meta: WOLT_META,
    verify: (req) => verifyWith(scheme, req, webhookSecret),
    normalize(rawBody) {
      const p = parseJson(rawBody);
      const o = p.order ?? p;
      cleanCurrency(pick(o, "price.currency") ?? o.currency);
      const status = String(pick(o, "status") ?? "CREATED").toUpperCase();
      const eventType = status === "CANCELLED" || status === "REJECTED" ? "order_cancelled"
        : status === "CREATED" ? "order_created" : "order_status";
      return buildEvent("wolt", {
        orderId: o.id ?? p.order_id,
        eventId: p.id ?? `${o.id}:${status}:${o.modified_at ?? ""}`,
        eventType, status,
        totalGrosz: toGrosz(pick(o, "price.amount") ?? o.total, { unit: "minor" }),
        fulfillment: pick(o, "delivery.type") === "pickup" ? "pickup" : "delivery",
        placedAt: o.created_at ?? null,
        customer: o.consumer ? { name: o.consumer.name, phone: o.consumer.phone_number } : null,
        notes: o.consumer_comment ?? null,
        items: (o.items ?? []).map((i) => ({
          externalId: i.id, name: i.name, quantity: i.count ?? i.quantity,
          unitPriceGrosz: toGrosz(i.base_price ?? i.price ?? 0),
          options: (i.options ?? []).map((x) => ({ externalId: x.id, name: x.name, unitPriceGrosz: toGrosz(x.price ?? 0) })),
        })),
      });
    },
    buildOutbound(action, order) {
      if (!apiKey) throw new DeliveryAdapterError("NOT_CONFIGURED", "Missing Wolt API key");
      const map = { accept: "accept", reject: "reject", ready: "ready", delivered: "delivered" };
      if (!map[action]) throw new DeliveryAdapterError("UNSUPPORTED_ACTION", "Unsupported action");
      return requestDescriptor({
        method: "PUT", baseUrl, path: `/orders/${encodeURIComponent(order.orderId)}/${map[action]}`,
        headers: { "wolt-api-key": apiKey },
        body: action === "reject" ? { reason: order.reason ?? "unable_to_fulfill" } : {},
      });
    },
  };
}
