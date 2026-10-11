import test from "node:test";
import assert from "node:assert/strict";
import { FiscalAgent, MemoryJournal } from "../src/agent.mjs";
import { FiscalDriver, FiscalError } from "../../fiscal-bridge/src/fiscal-contract.mjs";

const OP = "11111111-1111-4111-8111-111111111111";
const REST = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const payload = (over = {}) => ({ restaurantId: REST, orderId: ORDER, currency: "PLN",
  items: [{ name: "Bandeja paisa", quantityMilli: 1000, grossTotalGrosz: 4500, taxCode: "8" }], totalGrosz: 4500, ...over });

class FakeClient {
  constructor(op = { operation_id: OP, fiscal_payload: payload() }) { this.op = op; this.calls = []; this.failSending = false; this.failResult = 0; this.results = []; }
  async claim() { this.calls.push("claim"); const o = this.op; this.op = null; return o; }
  async sending() { this.calls.push("sending"); if (this.failSending) throw Object.assign(new Error("x"), { code: "SENDING_REJECTED" }); }
  async result(id, tok, outcome, result) { this.calls.push("result"); if (this.failResult-- > 0) throw Object.assign(new Error("net"), { code: "NET" }); this.results.push({ id, outcome, result }); }
}
class FakeDriver extends FiscalDriver {
  constructor(impl = {}) { super(); this.prints = 0; this.impl = impl; }
  async printReceipt(r) { this.prints++; if (this.impl.print) return this.impl.print(r); return { operationId: r.operationId, status: "confirmed", fiscal: true, fiscalNumber: "123" }; }
  async reconcile(id) { return this.impl.reconcile ? { operationId: id, ...this.impl.reconcile(id) } : { operationId: id, status: "unknown" }; }
}

test("camino feliz: claim -> sending -> imprimir -> resultado confirmed", async () => {
  const c = new FakeClient(), d = new FakeDriver(), j = new MemoryJournal();
  const out = await new FiscalAgent({ client: c, driver: d, journal: j }).runOnce();
  assert.equal(out.outcome, "confirmed");
  assert.deepEqual(c.calls, ["claim", "sending", "result"]);
  assert.equal(d.prints, 1);
  assert.equal((await j.list()).length, 0);
  assert.equal(c.results[0].result.fiscalNumber, "123");
});

test("sin trabajo: idle", async () => {
  const c = new FakeClient(null);
  assert.deepEqual(await new FiscalAgent({ client: c, driver: new FakeDriver() }).runOnce(), { idle: true });
});

test("si mark_sending falla NO se imprime", async () => {
  const c = new FakeClient(); c.failSending = true; const d = new FakeDriver(), j = new MemoryJournal();
  const out = await new FiscalAgent({ client: c, driver: d, journal: j }).runOnce();
  assert.equal(out.outcome, "skipped"); assert.equal(d.prints, 0); assert.equal((await j.list()).length, 1);
  assert.equal((await j.list())[0].phase, "unknown");
});

test("recibo inválido: no se imprime y se registra failed", async () => {
  const c = new FakeClient({ operation_id: OP, fiscal_payload: payload({ totalGrosz: 1 }) }); const d = new FakeDriver();
  const out = await new FiscalAgent({ client: c, driver: d }).runOnce();
  assert.equal(out.outcome, "failed"); assert.equal(d.prints, 0); assert.equal(c.results[0].outcome, "failed");
});

test("excepción del driver tras transmitir = unknown, NUNCA se reimprime", async () => {
  const c = new FakeClient(), d = new FakeDriver({ print: () => { throw new Error("timeout"); } }), j = new MemoryJournal();
  const agent = new FiscalAgent({ client: c, driver: d, journal: j });
  assert.equal((await agent.runOnce()).outcome, "unknown");
  assert.equal(c.results[0].outcome, "unknown");
  await agent.runOnce(); await agent.runOnce();
  assert.equal(d.prints, 1);
  assert.equal((await j.list()).length, 1); // sigue pendiente de conciliar
});

test("unknown se concilia después como confirmed sin reimprimir", async () => {
  const c = new FakeClient();
  let reconciled = false;
  const d = new FakeDriver({ print: () => { throw new Error("timeout"); }, reconcile: () => reconciled ? { status: "confirmed", fiscalNumber: "9" } : { status: "unknown" } });
  const j = new MemoryJournal(); const agent = new FiscalAgent({ client: c, driver: d, journal: j });
  await agent.runOnce(); reconciled = true; await agent.runOnce();
  assert.equal(d.prints, 1);
  assert.deepEqual(c.results.map((r) => r.outcome), ["unknown", "confirmed"]);
  assert.equal((await j.list()).length, 0);
});

test("fallo de red al reportar: se reintenta el reporte, no la impresión", async () => {
  const c = new FakeClient(); c.failResult = 1; const d = new FakeDriver(), j = new MemoryJournal();
  const agent = new FiscalAgent({ client: c, driver: d, journal: j });
  await agent.runOnce();
  assert.equal((await j.list()).length, 1);
  await agent.runOnce();
  assert.equal(d.prints, 1); assert.equal(c.results[0].outcome, "confirmed"); assert.equal((await j.list()).length, 0);
});

test("caída durante la impresión: al reiniciar se concilia, no se reimprime", async () => {
  const j = new MemoryJournal();
  await j.put({ operationId: OP, claimToken: "a".repeat(64), phase: "sending" });
  const c = new FakeClient(null), d = new FakeDriver({ reconcile: () => ({ status: "failed" }) });
  await new FiscalAgent({ client: c, driver: d, journal: j }).runOnce();
  assert.equal(d.prints, 0); assert.equal(c.results[0].outcome, "failed"); assert.equal((await j.list()).length, 0);
});

test("DEVICE error FAILED_BEFORE_SEND se registra como failed", async () => {
  const c = new FakeClient(), d = new FakeDriver({ print: () => { throw new FiscalError("FAILED_BEFORE_SEND", "tax"); } });
  assert.equal((await new FiscalAgent({ client: c, driver: d }).runOnce()).outcome, "failed");
});

test('V5: mismatched receipt confirmation cannot confirm another operation',async()=>{
 const c=new FakeClient(),d=new FakeDriver({print:()=>({operationId:ORDER,status:'confirmed',fiscal:true})});
 assert.equal((await new FiscalAgent({client:c,driver:d}).runOnce()).outcome,'unknown');
 assert.equal(c.results[0].outcome,'unknown');
});
test('V5: lost report of invalid receipt persists for recovery without printing',async()=>{
 const c=new FakeClient({operation_id:OP,fiscal_payload:payload({totalGrosz:1})});c.failResult=1;
 const j=new MemoryJournal(),d=new FakeDriver(),agent=new FiscalAgent({client:c,driver:d,journal:j});
 await agent.runOnce();assert.equal((await j.list()).length,1);await agent.runOnce();assert.equal(d.prints,0);assert.equal(c.results[0].outcome,'failed');
});

test('reclaimed UNKNOWN operation is never printed or overwritten', async()=>{
  const j=new MemoryJournal();
  await j.put({operationId:OP,claimToken:'original',phase:'unknown',outcome:'unknown',result:{reason:'lost_response'}});
  const c=new FakeClient(),d=new FakeDriver();
  await assert.rejects(new FiscalAgent({client:c,driver:d,journal:j}).runOnce(),{code:"JOURNAL_OPERATION_PENDING"});
  assert.equal(d.prints,0);assert.equal(c.calls.includes('sending'),false);
  assert.equal((await j.list())[0].claimToken,'original');
});

test('reconciliation confirmation is durable before reporting, even if reporting throws',async()=>{
  const j=new MemoryJournal();await j.put({operationId:OP,claimToken:'original',phase:'unknown',outcome:'unknown'});
  const c=new FakeClient(null),d=new FakeDriver({reconcile:()=>({status:'confirmed',fiscalNumber:'99'})});
  let savedAtReport;
  c.result=async()=>{
    [savedAtReport]=await j.list();
    throw new Error('network');
  };
  await new FiscalAgent({client:c,driver:d,journal:j}).recover();
  assert.equal(savedAtReport.outcome,'confirmed');assert.equal(savedAtReport.result.fiscalNumber,'99');
  assert.equal(savedAtReport.phase,'reported_pending');
  assert.equal((await j.list())[0].outcome,'confirmed');assert.equal(d.prints,0);
});

test('failed durable reconciliation write prevents report and claim',async()=>{
  const j=new MemoryJournal();await j.put({operationId:OP,claimToken:'original',phase:'sending'});
  j.put=async()=>{throw new Error('disk_full');};
  const c=new FakeClient(),d=new FakeDriver({reconcile:()=>({status:'confirmed',fiscalNumber:'99'})});
  await assert.rejects(new FiscalAgent({client:c,driver:d,journal:j}).runOnce(),/disk_full/);
  assert.deepEqual(c.calls,[]);assert.equal(d.prints,0);
});

test('legacy UNKNOWN without outcome is reported and remains blocked',async()=>{
  const j=new MemoryJournal();await j.put({operationId:OP,claimToken:'original',phase:'unknown'});
  const c=new FakeClient(null),d=new FakeDriver();
  await new FiscalAgent({client:c,driver:d,journal:j}).runOnce();
  assert.equal(c.results.length,1);assert.equal(c.results[0].outcome,'unknown');
  assert.equal((await j.list())[0].outcome,'unknown');assert.equal(d.prints,0);
});
