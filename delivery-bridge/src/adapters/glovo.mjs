/** Glovo (Partners API) — PROVISIONAL: la integración debe ser validada por el equipo de Glovo. */
import { DeliveryAdapterError } from "../adapter-registry.mjs";
import { buildEvent, cleanCurrency, parseJson, requestDescriptor, toGrosz, verifyWith } from "../canonical.mjs";

export const GLOVO_META = Object.freeze({ provider: "glovo", provisional: true, docs: "https://qcommerce-integrations.glovoapp.com" });

export function createGlovoAdapter(options = {}) {
  const { webhookSecret, apiToken, baseUrl = "https://api.glovoapp.com" } = options;
  const scheme = options.verification ?? { type: "static-token", header: "authorization" };
  return {
    meta: GLOVO_META,
    verify: (req) => verifyWith(scheme, req, webhookSecret),
    normalize(rawBody, { cancelled = false } = {}) {
      const p = parseJson(rawBody);
      cleanCurrency(p.currency);
      return buildEvent("glovo", {
        orderId: p.order_id ?? p.id,
        eventId: `${p.order_id ?? p.id}:${cancelled ? "cancelled" : "created"}`,
        eventType: cancelled ? "order_cancelled" : "order_created",
        status: cancelled ? "CANCELLED" : "CREATED",
        totalGrosz: toGrosz(p.estimated_total_price ?? p.total_amount, { unit: "minor" }),
        deliveryFeeGrosz: p.delivery_fee != null ? toGrosz(p.delivery_fee) : 0,
        fulfillment: p.is_picked_up_by_customer ? "pickup" : "delivery",
        placedAt: p.order_time ?? null,
        customer: p.customer ? { name: p.customer.name, phone: p.customer.phone_number } : null,
        notes: [p.special_requirements, p.allergy_info].filter(Boolean).join(" | ") || null,
        items: (p.products ?? []).map((i) => ({
          externalId: i.id, name: i.name, quantity: i.quantity, unitPriceGrosz: toGrosz(i.price ?? 0),
          options: (i.attributes ?? []).map((x) => ({ externalId: x.id, name: x.name, unitPriceGrosz: toGrosz(x.price ?? 0), quantity: x.quantity ?? 1 })),
        })),
      });
    },
    buildOutbound(action, order) {
      if (!apiToken) throw new DeliveryAdapterError("NOT_CONFIGURED", "Missing Glovo API token");
      const storeId = order.storeId ?? options.storeId;
      if (!storeId) throw new DeliveryAdapterError("NOT_CONFIGURED", "Missing Glovo store id");
      const paths = { ready: "ready_for_pickup", cancel: "cancel" };
      if (!paths[action]) throw new DeliveryAdapterError("UNSUPPORTED_ACTION", "Unsupported action");
      return requestDescriptor({
        approvedOrigins: ["https://api.glovoapp.com"],
        method: "POST", baseUrl,
        path: `/webhook/stores/${encodeURIComponent(storeId)}/orders/${encodeURIComponent(order.orderId)}/${paths[action]}`,
        headers: { authorization: apiToken },
        body: action === "cancel" ? { reason: order.reason ?? "OTHER" } : {},
      });
    },
  };
}
