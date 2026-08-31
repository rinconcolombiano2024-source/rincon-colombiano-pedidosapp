const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  apiRequest,
  authenticateActor,
  integrationGate,
} = require("./support/supabase-rest.cjs");

const planFile = String(process.env.RC_TEST_CONCURRENCY_PLAN || "").trim();
const planPath = planFile ? path.resolve(planFile) : "";
const plan = planPath && fs.existsSync(planPath)
  ? JSON.parse(fs.readFileSync(planPath, "utf8"))
  : null;
const actorNames = Array.isArray(plan?.actors) ? plan.actors : [];
const gate = integrationGate(actorNames);
const reason = !plan
  ? "Pendiente de Supabase TEST: falta RC_TEST_CONCURRENCY_PLAN con un plan de fixtures desechables."
  : gate.reason;

test("harness de concurrencia Supabase TEST", { skip: plan && gate.ready ? false : reason }, async (t) => {
  assert.ok(Array.isArray(plan.cases) && plan.cases.length > 0, "El plan no contiene casos.");
  const actors = Object.fromEntries(await Promise.all(actorNames.map(async (name) => [
    name,
    await authenticateActor(name, gate.config),
  ])));

  for (const scenario of plan.cases) {
    await t.test(String(scenario.name || "caso sin nombre"), async () => {
      for (const phase of scenario.phases || []) {
        const operations = Array.isArray(phase.parallel) ? phase.parallel : [phase];
        const results = await Promise.all(operations.map((operation) => {
          const actor = actors[operation.actor];
          assert.ok(actor, `Actor no autenticado en el plan: ${operation.actor}`);
          return apiRequest({
            config: gate.config,
            token: actor.token,
            method: operation.method || "POST",
            path: operation.path,
            body: operation.body,
          });
        }));
        results.forEach((result, index) => {
          const expectedStatus = Number(operations[index].expectedStatus || 200);
          assert.equal(result.status, expectedStatus, `${scenario.name}: fase HTTP inesperada`);
        });
      }

      for (const check of scenario.assertions || []) {
        const actor = actors[check.actor];
        const result = await apiRequest({
          config: gate.config,
          token: actor?.token || "",
          method: check.method || "GET",
          path: check.path,
          body: check.body,
        });
        assert.equal(result.status, Number(check.expectedStatus || 200));
        if (Object.hasOwn(check, "expectedJson")) assert.deepEqual(result.data, check.expectedJson);
        if (Object.hasOwn(check, "expectedRowCount")) {
          assert.ok(Array.isArray(result.data));
          assert.equal(result.data.length, Number(check.expectedRowCount));
        }
      }
    });
  }
});
