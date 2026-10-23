import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";

const original = readFileSync("supabase/functions/delivery-quote/index.ts", "utf8");
const begin = original.indexOf("const boundedSupabaseFetch: typeof fetch =");
const end = original.indexOf("\nfunction response(", begin);
assert.ok(begin >= 0 && end > begin, "bounded backend transport must be defined");

function harness() {
  const calls = [];
  const timeoutRequests = [];
  const fakeSignal = {
    timeout(milliseconds) {
      timeoutRequests.push(milliseconds);
      return { source: "deadline", milliseconds };
    },
    any(signals) {
      return { source: "combined", signals };
    },
  };
  const context = vm.createContext({
    AbortSignal: fakeSignal,
    fetch: async (input, init) => {
      calls.push({ input, init });
      return { ok: true };
    },
  });
  const code = stripTypeScriptTypes(original.slice(begin, end), { mode: "strip" });
  const bounded = vm.runInContext(code + "\nboundedSupabaseFetch;", context);
  return { bounded, calls, timeoutRequests };
}

test("delivery quote bounds every Supabase request without modifying inputs", async () => {
  const h = harness();
  const payload = { method: "POST", headers: { apikey: "fixture" }, body: "{}" };
  assert.deepEqual(await h.bounded("https://example.invalid/rest/v1/rpc", payload), { ok: true });
  assert.deepEqual(h.timeoutRequests, [8000]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].input, "https://example.invalid/rest/v1/rpc");
  assert.equal(h.calls[0].init.method, "POST");
  assert.equal(h.calls[0].init.body, "{}");
  assert.equal(h.calls[0].init.signal.source, "deadline");
  assert.match(original, /global:\s*\{\s*fetch:\s*boundedSupabaseFetch\s*\}/);
});

test("delivery backend deadline preserves an existing abort signal", async () => {
  const h = harness();
  const callerSignal = { source: "caller" };
  await h.bounded("https://example.invalid/auth/v1/user", { signal: callerSignal });
  assert.deepEqual(h.timeoutRequests, [8000]);
  const s = h.calls[0].init.signal;
  assert.equal(s.source, "combined");
  assert.equal(s.signals[0], callerSignal);
  assert.equal(s.signals[1].source, "deadline");
});

test("maps and price authority remain unchanged and never fall back to fake fees", () => {
  assert.match(original, /https:\/\/maps\.googleapis\.com\/maps\/api\/geocode\/json/);
  assert.match(original, /https:\/\/routes\.googleapis\.com\/directions\/v2:computeRoutes/);
  assert.match(original, /admin\.rpc\("rc_ordera_create_delivery_quote"/);
  assert.match(original, /if \(!quote\?\.quote_id \|\| !quote\?\.quote_token\)/);
  assert.doesNotMatch(original, /return response\(200, \{[^}]*finalFee:\s*0/);
});
