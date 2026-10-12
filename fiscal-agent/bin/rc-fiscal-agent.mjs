#!/usr/bin/env node
/**
 * Uso (en el PC del restaurante, Node >= 22):
 *   RC_GATEWAY_URL=https://<proyecto>.supabase.co/functions/v1/fiscal-agent-gateway \
 *   RC_DEVICE_ID=<uuid> RC_DEVICE_TOKEN=<token del dispositivo> \
 *   RC_FISCAL_DRIVER=mock  RC_DRIVER_OPTIONS=./driver.json \
 *   node fiscal-agent/bin/rc-fiscal-agent.mjs
 */
import { readFileSync } from "node:fs";
import { createAgentRegistry } from "../src/registry.mjs";
import { createGatewayClient } from "../src/gateway-client.mjs";
import { FiscalAgent } from "../src/agent.mjs";

import { FileJournal } from "../src/file-journal.mjs";

const env = (k, req = true) => { const v = process.env[k]; if (req && !v) { console.error(`Falta ${k}`); process.exit(2); } return v; };
const log = (event, data = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));

const driverId = env("RC_FISCAL_DRIVER");
const options = process.env.RC_DRIVER_OPTIONS ? JSON.parse(readFileSync(process.env.RC_DRIVER_OPTIONS, "utf8")) : {};
if (driverId !== "mock") throw new Error("HARDWARE_DRIVER_NOT_VERIFIED: POSNET model/protocol required");
const client = createGatewayClient({ url: env("RC_GATEWAY_URL"), deviceId: env("RC_DEVICE_ID"), deviceToken: env("RC_DEVICE_TOKEN") });
const driver = createAgentRegistry().create(driverId, options);
const journal = new FileJournal(process.env.RC_JOURNAL || "./fiscal-journal.json");
await driver.connect();

const agent = new FiscalAgent({
  client,
  driver, journal, log,
});

let stop = false;
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { stop = true; });
log("agent_started", { driverId });
let delay = 2000;
while (!stop) {
  try {
    const r = await agent.runOnce();
    if (r.idle) { delay = Math.min(delay * 1.5, 15000); } else { delay = 500; log("processed", r); }
  } catch (e) { delay = Math.min(delay * 2, 60000); log("loop_error", { code: e?.code ?? "ERR" }); }
  await new Promise((r) => setTimeout(r, delay));
}
await driver.disconnect();

journal.close();
