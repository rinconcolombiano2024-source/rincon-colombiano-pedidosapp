import test from "node:test";
import assert from "node:assert/strict";
import { MemoryOutboxStore } from "../src/outbox.mjs";

test("reconciliation requires explicit nonempty textual evidence", async () => {
  const store = new MemoryOutboxStore();
  await store.insert({ id: "reconcile-1", state: "unknown", restaurantId: "r1" });
  for (const evidence of [undefined, null, "", "  ", 1, true, [], {}, { trim() { throw Error("EXECUTED"); } }]) {
    await assert.rejects(store.resolve("reconcile-1", "sent", evidence), { message: "RECONCILIATION_EVIDENCE_REQUIRED" });
    assert.equal((await store.get("reconcile-1")).state, "unknown");
  }
  await store.resolve("reconcile-1", "sent", "provider-confirmation-123");
  assert.equal((await store.get("reconcile-1")).reconciliationEvidence, "provider-confirmation-123");
  assert.equal((await store.get("reconcile-1")).state, "sent");
});
