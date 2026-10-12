import { toGrosz, sum } from "./money.mjs";

/** Single provider rows represent net settlement after refunds; aggregate rows sum signed movements. */
/** Never collapse duplicate references into a Map: ambiguous groups cannot match. */
/**
 * aggregateProviderRows (opt-in): el proveedor puede tener VARIAS filas por referencia (cargo, reembolso, ajuste).
 * Cada movimiento exige event_id único (identidad oficial del movimiento, no la venta).
 * Se suman con signo y se comparan con amount - refunded_amount del pago local. Los duplicados LOCALES nunca se agregan.
 */
export function reconcileProvider(localPayments, providerRows, { aggregateProviderRows = false } = {}) {
  const out = { matched: [], missingInProvider: [], missingLocal: [], amountMismatch: [], currencyMismatch: [], duplicateLocal: [], duplicateProvider: [], invalidReferences: [], invalidProviderEvents: [], aggregatedProvider: [] };
  function group(rows, field, side) {
    const groups = new Map();
    for (const [index, row] of rows.entries()) {
      const raw = row[field];
      if (typeof raw !== 'string' || !raw.trim() || raw !== raw.trim()) {
        out.invalidReferences.push({ side, index }); continue;
      }
      const entries = groups.get(raw) ?? []; entries.push(row); groups.set(raw, entries);
    }
    return groups;
  }
  const local = group(localPayments, 'provider_reference', 'local');
  const prov = group(providerRows, 'reference', 'provider');
  for (const [ref, rows] of local) if (rows.length > 1) out.duplicateLocal.push({ ref, count: rows.length });
  const unsafe = new Set();
  if (aggregateProviderRows) {
    const events = new Map();
    for (const [ref, rows] of prov) for (const row of rows) {
      const id = row.event_id;
      if (typeof id !== 'string' || !id.trim() || id !== id.trim()) {
        unsafe.add(ref); out.invalidProviderEvents.push({ ref, reason: 'event_id_required' }); continue;
      }
      if (events.has(id)) {
        unsafe.add(ref); unsafe.add(events.get(id));
        out.invalidProviderEvents.push({ ref, eventId: id, reason: 'duplicate_event_id' });
      } else events.set(id, ref);
    }
  }
  for (const [ref, rows] of prov) if (rows.length > 1 && (!aggregateProviderRows || unsafe.has(ref))) out.duplicateProvider.push({ ref, count: rows.length });
  for (const [ref, payments] of local) {
    const rows = prov.get(ref);
    if (!rows) { if (payments.some(p => p.status === 'paid')) out.missingInProvider.push(ref); continue; }
    if (unsafe.has(ref) || payments.length !== 1 || (rows.length !== 1 && !aggregateProviderRows)) continue;
    const p = payments[0], r = rows[0];
    if (aggregateProviderRows && new Set(rows.map((x) => String(x.currency ?? '').toUpperCase())).size > 1) { out.currencyMismatch.push(ref); continue; }
    if (!/^[A-Z]{3}$/.test(String(r.currency ?? '').toUpperCase()) || !/^[A-Z]{3}$/.test(String(p.currency ?? '').toUpperCase()) || String(r.currency).toUpperCase() !== String(p.currency).toUpperCase()) { out.currencyMismatch.push(ref); continue; }
    const gross = toGrosz(p.amount), refund = p.refunded_amount != null ? toGrosz(p.refunded_amount) : 0;
    if (gross < 0 || refund < 0 || refund > gross || ((p.status === 'paid' && refund !== 0) || (p.status === 'refunded' && refund !== gross) || (p.status === 'partially_refunded' && (refund <= 0 || refund >= gross)))) {
      out.amountMismatch.push({ ref, reason: 'invalid_local_refund' }); continue;
    }
    const a = sum([gross, -refund]);
    const b = aggregateProviderRows ? sum(rows, x => toGrosz(x.amount)) : toGrosz(r.amount);
    if (aggregateProviderRows && rows.length > 1) out.aggregatedProvider.push({ ref, eventIds: rows.map(x => x.event_id), totalGrosz: b });
    if (a !== b) out.amountMismatch.push({ ref, local: a, provider: b });
    else if (!['paid', 'partially_refunded', 'refunded'].includes(p.status)) out.amountMismatch.push({ ref, reason: 'local_not_settled' });
    else out.matched.push(ref);
  }
  for (const ref of prov.keys()) if (!local.has(ref)) out.missingLocal.push(ref);
  out.ok = Object.entries(out).every(([key, value]) => ['matched', 'aggregatedProvider'].includes(key) || value.length === 0);
  return out;
}
