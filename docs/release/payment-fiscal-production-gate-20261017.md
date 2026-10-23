# RC ORDERA — Payment and fiscal production release gate

**Status:** NOT CERTIFIED. This document is an operational gate, not evidence that real payments or fiscal devices work.

## Mandatory evidence before enabling real payments

- [ ] Record immutable deployed commit SHA and database migration version; maintain rollback procedure.
- [ ] Verify menu edits, opening hours, photos and prices persist and match the customer view after reload.
- [ ] Run `npm run qa`, `npm run qa:e2e`, and integration tests against isolated fixtures. Record skipped tests explicitly.
- [ ] In a separate test environment, verify payment table/RPC deployment and least-privilege grants without altering production.
- [ ] Confirm SumUp merchant onboarding, test credentials and provider-approved live credentials are distinct; never log or commit keys.
- [ ] Test successful, failed, expired, cancelled and retried payments; webhook signature, idempotency, exact currency/amount, duplicate callbacks and refunds.
- [ ] Confirm restaurant/driver allocation and reconciliation from authoritative server records, not browser callbacks.
- [ ] Verify two restaurants cannot read or change each other's payments, orders or menus.
- [ ] Validate POSNET model, authorized protocol, physical connection and fiscal compliance with a real certified device; never substitute mock printouts for fiscal receipts.
- [ ] Check mobile and PWA navigation, kitchen alerts, message notifications, offline recovery and two identical items with different notes.
- [ ] Record production CPU baseline, query latency and realtime subscriber counts; monitor after staged rollout.
- [ ] Obtain explicit owner approval for live charges, fiscal issuance and production migrations.

## Release decision

Block activation if any mandatory payment/fiscal gate lacks evidence. Rollback means disabling new payment initiation via the existing approved configuration and reverting the application deployment to the recorded SHA; **do not** revert successful charges or delete accounting records. Reconcile in-flight attempts before switching providers. Do not treat passing unit tests as merchant approval or fiscal certification.

## Scope of this change

Documentation only. No runtime code, dependency, schema, policy, secret, payment setting or deployment is modified.
