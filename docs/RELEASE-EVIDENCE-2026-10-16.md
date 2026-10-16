# RC ORDERA — Release evidence gate (2026-10-16)

This document is an additive, reversible release checklist. It does not change payment activation, database, RLS, menus, or orders.

## Verified in GitHub
- Default branch: main; package version 91.0.4.
- Existing tests include tests/hardening/customer-independent-item-notes.test.mjs on main.
- Open work includes PR #76 (independent cart lines), #75 (delivery notes), #79 (delivery mapping safety), #85 and #88 (SumUp).
- PR #88 documents that production did not yet have the SumUp ledger/RPCs at the time of its verification. Re-check live state before any deployment.

## Mandatory release evidence
- [ ] Menu save, opening hours save, photo upload and public customer rendering: persistence verified with real test restaurant and session refresh.
- [ ] Two identical products with different notes persist across cart, language, order, Supabase, stations, history, delivery and printed kitchen tickets.
- [ ] Supabase tenant isolation/RLS and concurrent order creation checked in isolated staging.
- [ ] Stripe/SumUp/BLIK: provider test-mode end-to-end, webhook signatures, idempotency, reconciliation, refunds and no double charges verified. Never enable real payments based on mocks.
- [ ] Android physical-device navigation and PWA recovery after offline tested.
- [ ] Fiscal printer protocol verified on actual approved device; distinguish non-fiscal tickets from fiscal receipts.
- [ ] CPU baseline and after-change measurements from same workload, with order-delivery latency recorded.
- [ ] CI and browser E2E green on merge commit; production smoke and rollback plan approved.

## Release decision
BLOCKED until the checks above have dated, reproducible evidence. A green unit suite alone is not production certification. No production deployment or payment configuration change is authorized by this file.
