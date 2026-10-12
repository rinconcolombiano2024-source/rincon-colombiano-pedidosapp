import test from "node:test";
import assert from "node:assert/strict";
import { FiscalAgent, MemoryJournal } from "../src/agent.mjs";

const opId = (index) => `11111111-1111-4111-8111-${index.toString(16).padStart(12, "0")}`;

async function unresolvedJournal(count) {
  const journal = new MemoryJournal();
  for (let i=0;i<count;i++) {
    await journal.put({
      operationId: opId(i), claimToken: "a".repeat(64),
      phase: "unknown", outcome: "unknown",
      result: {reason: "response_lost"}
    });
  }
  return journal;
}

test("fiscal recovery has a bounded device/network budget per pass and rotates fairly", async () => {
  const journal = await unresolvedJournal(70);
  const reconciled = [], reported = [];
  const agent = new FiscalAgent({
    client: {
      claim: async()=>null, sending:async()=>{},
      result:async(id)=>{reported.push(id);}
    },
    journal,
    driver: {
      reconcile:async(id)=>{reconciled.push(id);return {operationId:id,status:"unknown"};},
      printReceipt:async()=>{throw Error("MUST_NEVER_PRINT_UNKNOWN");}
    }
  });
  await agent.recover();
  assert.equal(reconciled.length,25);
  assert.equal(reported.length,25);
  await agent.recover();
  assert.equal(reconciled.length,50);
  await agent.recover();
  assert.equal(reconciled.length,75);
  assert.equal(new Set(reconciled).size,70,"all 70 journal entries reached across three passes");
  assert.equal((await journal.list()).length,70,"unknown evidence retained until reconciliation");
});

test("an unresolved operation beyond the recovery batch is NEVER reclaimed for printing", async () => {
  const journal = await unresolvedJournal(70);
  let claimCount=0,printCount=0;
  const reClaimId=opId(69);
  const agent=new FiscalAgent({
    client:{
      claim:async()=>{claimCount++;return {
        operation_id:reClaimId,fiscal_payload:{restaurantId:opId(69),orderId:reClaimId,currency:"PLN",
          items:[{name:"Dish",quantityMilli:1000,grossTotalGrosz:100,taxCode:"8"}],totalGrosz:100}
      };},
      sending:async()=>{throw Error("MUST_NOT_SEND");},
      result:async()=>{}
    },
    journal,
    driver:{
      reconcile:async(id)=>({operationId:id,status:"unknown"}),
      printReceipt:async()=>{printCount++;return {operationId:reClaimId,status:"confirmed"};}
    }
  });
  await assert.rejects(()=>agent.runOnce(),{code:"JOURNAL_OPERATION_PENDING"});
  assert.equal(claimCount,1);
  assert.equal(printCount,0);
  const original=(await journal.list()).find(x=>x.operationId===reClaimId);
  assert.equal(original.outcome,"unknown");
  assert.equal(original.claimToken,"a".repeat(64));
});

test("small journals still reconcile completely in one pass and clear confirmed evidence", async () => {
  const journal=await unresolvedJournal(2);
  const reported=[];
  const agent=new FiscalAgent({
    client:{claim:async()=>null,result:async(id,_token,outcome)=>reported.push({id,outcome})},
    journal,
    driver:{reconcile:async(id)=>({operationId:id,status:"confirmed",fiscalNumber:"12"})}
  });
  await agent.recover();
  assert.equal(reported.length,2);
  assert.equal(reported.every(x=>x.outcome==="confirmed"),true);
  assert.deepEqual(await journal.list(),[]);
});
