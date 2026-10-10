import test from "node:test";
import assert from "node:assert/strict";
import { NovitusNoviApiDriver, taxLetter } from "../src/drivers/novitus-noviapi.mjs";
import { createAgentRegistry } from "../src/registry.mjs";

const OP = "11111111-1111-4111-8111-111111111111";
const receipt = (taxCode = "8") => ({ operationId: OP, restaurantId: "r", orderId: "o", currency: "PLN", totalGrosz: 4500,
  items: [{ name: "Bandeja", quantityMilli: 1500, grossTotalGrosz: 4500, taxCode }] });

// Servidor NoviAPI simulado (según el flujo SUPUESTO de 3 pasos).
function fakeDevice({ finalStatus = "done", confirmOk = true, dropAfterConfirm = false } = {}) {
  const log = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); const m = init.method ?? "GET"; log.push(`${m} ${u.pathname}${u.search}`);
    const j = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (m === "POST" && u.pathname === "/api/token") return j(200, { token: "jwt" });
    if (m === "POST" && u.pathname === "/api/command") return j(200, { commandId: "c1", echo: JSON.parse(init.body) });
    if (m === "PUT") { if (dropAfterConfirm) throw new Error("socket"); return confirmOk ? j(200, {}) : j(500, {}); }
    if (m === "GET" && u.pathname === "/api/command/c1") return j(200, { status: finalStatus, receiptNumber: 77 });
    if (m === "GET" && u.pathname === "/api/command") return j(200, { status: finalStatus, receiptNumber: 77 });
    return j(404, {});
  };
  return { fetchImpl, log };
}
const mk = (dev, extra = {}) => new NovitusNoviApiDriver({ simulationOnly: true, baseUrl: "http://printer.local", username: "u", password: "p", fetchImpl: dev.fetchImpl, sleep: async () => {}, maxPolls: 3, ...extra });

test("taxLetter: 23/8/5/0/ZW -> A/B/C/D/E y rechazo de códigos desconocidos", () => {
  assert.deepEqual(["23", "VAT_8", "5", "0", "ZW", "b"].map((c) => taxLetter(c)), ["A", "B", "C", "D", "E", "B"]);
  assert.throws(() => taxLetter("19"), { code: "FAILED_BEFORE_SEND" });
});

test("flujo feliz POST -> PUT -> GET y número de recibo", async () => {
  const dev = fakeDevice(); const d = mk(dev); await d.connect();
  const r = await d.printReceipt(receipt());
  assert.equal(r.status, "confirmed"); assert.equal(r.fiscalNumber, "77");
  assert.deepEqual(dev.log.slice(0, 4), ["POST /api/token", "POST /api/command", "PUT /api/command/c1/confirm", "GET /api/command/c1"]);
});

test("IVA no mapeado falla ANTES de enviar nada al dispositivo", async () => {
  const dev = fakeDevice(); const d = mk(dev); await d.connect();
  await assert.rejects(() => d.printReceipt(receipt("19")), { code: "FAILED_BEFORE_SEND" });
  assert.equal(dev.log.filter((l) => l.startsWith("POST /api/command")).length, 0);
});

test("confirmación con corte de red = unknown; sondeo agotado = unknown", async () => {
  let d = mk(fakeDevice({ dropAfterConfirm: true })); await d.connect();
  assert.equal((await d.printReceipt(receipt())).status, "unknown");
  d = mk(fakeDevice({ finalStatus: "pending" })); await d.connect();
  assert.equal((await d.printReceipt(receipt())).status, "unknown");
});

test("reconcile devuelve confirmed / failed / unknown", async () => {
  for (const [st, expect] of [["done", "confirmed"], ["error", "unknown"], ["pending", "unknown"]]) {
    const d = mk(fakeDevice({ finalStatus: st })); await d.connect();
    assert.equal((await d.reconcile(OP)).status, expect);
  }
});

test("registro: mock y novitus disponibles; Posnet/Elzab fallan cerrado", () => {
  const reg = createAgentRegistry();
  assert.deepEqual(reg.supportedDrivers().sort(), ["elzab", "mock", "novitus-noviapi", "posnet"]);
  assert.throws(() => reg.create("posnet"), { code: "DRIVER_NOT_IMPLEMENTED" });
  assert.throws(() => reg.create("elzab"), { code: "DRIVER_NOT_IMPLEMENTED" });
  assert.throws(() => reg.create("novitus-noviapi", {}), { code: "NOT_CONFIGURED" });
});

test('V5: lost POST acknowledgement, invalid creation response and confirmation HTTP500 remain unknown',async()=>{
 for(const mode of ['lost','invalid','confirm']){
  const dev=fakeDevice({confirmOk:false});
  const real=dev.fetchImpl;
  dev.fetchImpl=async(url,init)=>{
   if(init.method==='POST'&&new URL(url).pathname==='/api/command'){
    if(mode==='lost')throw new Error('response_lost_after_accept');
    if(mode==='invalid')return {ok:true,status:200,json:async()=>({})};
   }
   return real(url,init);
  };
  const d=mk(dev);await d.connect();assert.equal((await d.printReceipt(receipt())).status,'unknown');
 }
});
