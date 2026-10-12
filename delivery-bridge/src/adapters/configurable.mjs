/**
 * Adaptador por configuración, para plataformas cuyo contrato solo recibirás al firmar con ellas
 * (Pyszne.pl / Just Eat Takeaway, Bolt Food). Con la documentación oficial solo hay que rellenar `mapping`.
 * Sin mapping falla cerrado (NOT_CONFIGURED).
 */
import { DeliveryAdapterError } from "../adapter-registry.mjs";
import { buildEvent, cleanCurrency, parseJson, pick, toGrosz, verifyWith } from "../canonical.mjs";

export function createConfigurableAdapter(provider, options = {}) {
  const { mapping, verification, webhookSecret } = options;
  const meta = Object.freeze({ provider, provisional: true, docs: "Requiere alta como partner y documentación oficial" });
  const need = () => {
    if (!mapping || !verification) throw new DeliveryAdapterError("NOT_CONFIGURED", `${provider}: falta mapping/verification oficial`);
  };
  return {
    meta,
    verify(req) { need(); return verifyWith(verification, req, webhookSecret); },
    normalize(rawBody) {
      need();
      const p = parseJson(rawBody);
      cleanCurrency(pick(p, mapping.currency));
      const unit = mapping.moneyUnit ?? "minor";
      return buildEvent(provider, {
        orderId: pick(p, mapping.orderId), eventId: pick(p, mapping.eventId),
        eventType: mapping.eventTypes?.[pick(p, mapping.eventType)] ?? "order_status",
        status: pick(p, mapping.status),
        totalGrosz: toGrosz(pick(p, mapping.total), { unit }),
        customer: mapping.customerName ? { name: pick(p, mapping.customerName), phone: pick(p, mapping.customerPhone) } : null,
        items: (pick(p, mapping.items.path) ?? []).map((i) => ({
          externalId: pick(i, mapping.items.id), name: pick(i, mapping.items.name),
          quantity: pick(i, mapping.items.quantity), unitPriceGrosz: toGrosz(pick(i, mapping.items.price) ?? 0, { unit }),
        })),
      });
    },
    buildOutbound() { throw new DeliveryAdapterError("NOT_CONFIGURED", `${provider}: acciones salientes pendientes de documentación oficial`); },
  };
}
