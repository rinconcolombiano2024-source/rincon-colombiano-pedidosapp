# Strict order revision conflicts and PostgREST retries

The production call chain is `save_and_publish_restaurant_order_atomic` →
`save_restaurant_order_atomic` → `save_restaurant_order_atomic_strict`.
The earlier V91-33 migration targets the outer function, while the deployed
strict implementation still raises five business conflicts using SQLSTATE 40001.

On 23 October 2026 the 24-hour Supabase log aggregation returned 6,234,802
PostgREST 14.5 errors with SQLSTATE 40001 for the outer RPC. Observed timestamps:
2026-10-22 12:30:46.733 UTC to 2026-10-23 05:56:02.477 UTC. These are log counts,
not a CPU utilization measurement, and do not establish the originating client.

Supabase documents the PostgREST 14 custom-40001 retry issue:
https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

## Change

The migration changes only the five explicit logical-conflict codes to P0001.
Conflict messages, authentication, ownership, locks, revision checks, successful
writes, function ACLs and security attributes remain unchanged. The frontend
already recognizes `ORDER_REVISION_CONFLICT` and `ORDER_REVISION_REQUIRED` messages.
Actual PostgreSQL serialization failures remain untouched.

The migration checks the exact normalized function body hash before changing it
and the expected hash afterward. An unfamiliar body fails closed; reapplying the
known patched body is a no-op. Lock timeout is three seconds. It never updates
orders, menus, payments or historical records.

## Verification

The fixture is the inspected production function definition, without customer
records or credentials. PGlite executes it to reproduce 40001, applies the
migration twice and verifies valid creation/update, stale/missing/cancelled
revision rejection, ownership/authentication rejection, unchanged ACLs and exact
body equivalence except the five error codes. A drifted function is rejected.

This prevents the documented retry classification; CPU reduction must be checked
with same-window host metrics and cannot be inferred from passing tests alone.
Do not reset statistics or remove data to make the diagnostics appear healthy.
