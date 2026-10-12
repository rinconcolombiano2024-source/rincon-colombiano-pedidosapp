/** Canonical identifiers match GitHub readiness and SQL contracts. */
const aliases={ubereats:'uber_eats',boltfood:'bolt_food'};
const supported=new Set(['uber_eats','wolt','glovo','bolt_food','pyszne']);
export function normalizeProvider(value){const id=aliases[value]??value;if(!supported.has(id))throw Object.assign(new Error('UNSUPPORTED_PROVIDER'),{code:'UNSUPPORTED_PROVIDER'});return id;}
