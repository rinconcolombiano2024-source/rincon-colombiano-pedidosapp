# RC ORDERA — release safety gate (2026-10-14)

Status: NOT CERTIFIED. This document is an evidence ledger, not a production approval.

## Verified from main
- package.json version 91.0.4, Node >=22, Capacitor 8.5.3.
- QA scripts exist for i18n, fiscal, delivery, readiness, shared, secrets, accounting, concurrency self-test, hardening and policy.
- cliente.js defines a customer order notes input; this does NOT establish independent per-line-item notes.
- README explicitly prohibits enabling live payments based only on deployed code.

## Mandatory blockers before release
1. Test two identical products with distinct notes across cart, language switch, offline recovery, DB persistence, kitchen, print and history.
2. Verify Android navigation from restaurant to QR customer and stations on physical devices.
3. Verify signed payment webhooks, idempotency, refunds and reconciliation in provider sandbox; live payments require separate authorization.
4. Check Supabase migrations, tenant isolation, RLS and CPU with baseline and after measurements.
5. Verify POSNET fiscal protocol and legally valid fiscal receipts on certified hardware.
6. Execute full npm run qa, browser E2E, integration, Android device smoke and deployment checks, capturing logs and commit SHAs.
7. Obtain passing required checks and review before merging; keep main and live data untouched until release approval.

Do not report a reliability percentage without measured service-level data and a defined denominator.
