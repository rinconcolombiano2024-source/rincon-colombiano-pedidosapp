# RC ORDERA — release gate after merging PR #35 and #36
**Reference date:** 2026-10-13. **Currency:** PLN. **Scope:** existing Rincón Colombiano installation, without changing live transactions.

## Code integrated into main
- **#36**: native Capacitor links for customer QR and kitchen/stations now use the production HTTPS site rather than native localhost. Browser/PWA links remain same-origin. Courier-tracking RPC calls are coalesced with a maximum 3-second cache bound per authenticated restaurant and Supabase client. Stripe/SumUp checkout endpoints reject provider crossovers; staged SumUp SQL records provider reservation and detects amount drift.
- **#35**: client menu Realtime preserves the selected category if it still exists; menu item names and descriptions prioritize explicitly saved ES/PL/EN restaurant translations; regression tests protect client and distributed Android assets.
- Reversible source-change records were updated without removing original-content hash checks.
- **GitHub Actions on individual PRs** passed their automated suites. A release-gate PR based on the **already merged main** provides an additional combined QA check.

## Production release gates (fail closed)
- Vercel reported **failure — build-rate-limit** on new commits. Merging to main is NOT proof that the production web or installed PWA picked up the changes. Resolve the Vercel build quota and verify the deployment SHA, content and service-worker revision before claiming release.
- Supabase **SumUp functions and financial SQL** were not deployed during this operation; SumUp payments remain disabled. Do not install historical migrations indiscriminately. Reconcile the exact live schema first and perform test transactions with verified merchant credentials and refunds before any live enablement.
- Stripe checkout function was already deployed but code changes committed to GitHub are NOT automatically reflected in Supabase Edge Functions. Verify active deployment versions, account capabilities and sandbox/live webhook evidence.
- The integrated fiscal printer button performs local USB/serial permission preflight. It is **not POSNET fiscal printing**. Hardware-specific protocol/agent/PTU and real fiscal tests are outstanding.
- Opening Android module URLs in a separate window was checked by automated link tests; behavior on the **actual installed Android WebView/device** still requires a manual smoke test.
- Historic PostgreSQL stats and lint reports do **not** measure the present CPU percentage. Establish before/after runtime CPU metrics and review the remaining foreign-key indexing suggestions individually.

## Minimum production acceptance sequence
1. Record backup/recovery plan, check deployment readiness and all CI checks on merged tree; verify expected SHA.
2. Resolve Vercel build quota, deploy main and validate route access, TLS, cache/service-worker update on Android/PWA/web.
3. Use two genuine sessions (restaurant + customer): QR, station, language, menu edits, one low-risk non-online order through preparation, completion and history; confirm no duplication and navigation does not replace Restaurant.
4. Check Supabase resource graphs and RPC count under realistic restaurant workload; monitor errors and rollback if production deviates.
5. Separately qualify and roll out providers/fiscal hardware, with idempotent replay, provider reconciliation and physical certified-device evidence.

**No publication, fiscal connection, availability percentage, CPU improvement percentage or live payment certification is claimed by this document.**
