/** Uber Eats — PROVISIONAL. El webhook solo notifica; el detalle se obtiene con OAuth desde fetchHref. */
import { DeliveryAdapterError } from "../adapter-registry.mjs";
import { buildEvent, parseJson, pick, requestDescriptor, verifyWith } from "../canonical.mjs";

export const UBEREATS_META = Object.freeze({ provider: "uber_eats", provisional: true, docs: "https://developer.uber.com/docs/eats" });

/**
 * Do not fetch a provider-controlled URL until the verified tenant-specific
 * OAuth workflow is implemented. A valid HTTPS URL alone is not a safe host.
 * Only the reviewed Uber API order endpoint is eligible for future fetches.
 */
export function safeUberOrderHref(value) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (u.origin !== "https://api.uber.com" || u.username || u.password ||
        u.search || u.hash || !/^\/v2\/eats\/order\/[^/]+$/.test(u.pathname)) return null;
    return u.toString();
  } catch { return null; }
}


export function createUberEatsAdapter(options = {}) {
  const { clientSecret, accessToken, baseUrl = "https://api.uber.com" } = options;
  const scheme = options.verification ?? { type: "hmac-sha256", header: "x-uber-signature", encoding: "hex" };
  return {
    meta: UBEREATS_META,
    verify: (req) => verifyWith(scheme, req, clientSecret),
    normalize(rawBody) {
      const p = parseJson(rawBody);
      const type = String(p.event_type ?? "");
      const status = String(pick(p, "meta.status") ?? "").toUpperCase() || "NOTIFIED";
      const eventType = type.includes("cancel") ? "order_cancelled" : type.includes("notification") ? "order_created" : "order_status";
      const href = safeUberOrderHref(p.resource_href);
      return buildEvent("uber_eats", {
        orderId: pick(p, "meta.resource_id") ?? p.order_id,
        eventId: p.event_id, eventType, status,
        items: [], needsFetch: eventType === "order_created", fetchHref: href,
      });
    },
    buildOutbound(action, order) {
      if (!accessToken) throw new DeliveryAdapterError("NOT_CONFIGURED", "Missing Uber access token");
      const map = { accept: "accept_pos_order", reject: "deny_pos_order", cancel: "cancel" };
      if (!map[action]) throw new DeliveryAdapterError("UNSUPPORTED_ACTION", "Unsupported action");
      return requestDescriptor({
        approvedOrigins: ["https://api.uber.com"],
        method: "POST", baseUrl, path: `/v1/delivery/order/${encodeURIComponent(order.orderId)}/${map[action]}`,
        headers: { authorization: `Bearer ${accessToken}` },
        body: action === "reject" ? { reason: { explanation: order.reason ?? "Unable to fulfill" } } : {},
      });
    },
  };
}
