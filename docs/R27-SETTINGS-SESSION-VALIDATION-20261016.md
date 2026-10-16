# R27: settings response isolation

This release integrates the frontend-only correction from PR #64 onto main after
R26 and payment fixes #81/#82. No database migration or payment activation is included.

## Reproduced failure and minimal fix

Five of six focused regression tests failed before the fix: a delayed settings
confirmation replaced a newer draft or updated local state after the active
restaurant changed. The save now captures its Supabase client and user, checks
them after asynchronous boundaries, and avoids applying stale snapshots. Newer
drafts retain their pending token; an obsolete conflict does not trigger a retry.

The original six pending-confirmation tests and six added response-isolation
tests pass. The full local QA suite passed 832 tests with zero failures. The
previous PR #83 CI passed; release acceptance additionally requires the final
commit's CI, including the new browser tests, to pass.

## Browser scope

`tests/e2e/settings-session-response.spec.js` loads the real restaurant page and
uses its actual save, local persistence, and revision functions. Only provider
responses are simulated. It checks a newer draft and a switch between synthetic
restaurant identities with both a reused and replaced client. The CI matrix runs
these scenarios on mobile, tablet and desktop layouts.

These tests validate frontend response handling, not real authentication, RLS,
or financial settlement. No real restaurant records or credentials are used.
The change does not require a paid Supabase branch because it modifies no server
contract or schema. Financial migrations still require isolated backend testing.

## Release and rollback

The R27 marker and service-worker cache version are updated together; web and
Android-distributed sources must match. No local orders, drafts, IndexedDB or
localStorage are deleted. Verify production using
`node scripts/verify-production-release.mjs` after deployment.

If a regression is detected, revert the release commit through a reviewed PR and
publish a new cache version. No database rollback is needed for this change.

## Remaining production checks

SumUp migrations V91-73/V91-74, provider test transactions, Stripe/BLIK settlement,
actual Android-device behavior, POSNET hardware and live CPU measurements remain
separate gates. R27 does not certify those integrations or an availability percentage.
