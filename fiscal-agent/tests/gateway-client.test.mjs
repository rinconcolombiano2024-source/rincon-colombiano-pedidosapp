import test from "node:test";
import assert from "node:assert/strict";
import {createGatewayClient} from "../src/gateway-client.mjs";
import {FiscalAgent, MemoryJournal} from "../src/agent.mjs";
const OP = "11111111-1111-4111-8111-111111111111";
const config = {url:"https://gateway.test/functions/v1/fiscal-agent-gateway",deviceId:OP,deviceToken:"test-only-token"};
const response = body => ({ok:true,status:200,json:async()=>body});
test("gateway URL requires exact loopback host for plaintext and rejects credentials", () => {
 for (const url of ["http://localhost.evil.test", "http://127.0.0.1.evil.test", "http://localhost@evil.test", "https://user:password@gateway.test", "https://gateway.test/#token", "invalid"])
  assert.throws(()=>createGatewayClient({...config,url}), {code:"INSECURE_GATEWAY_URL"});
 for (const url of ["http://localhost:54321/functions/v1/gateway", "http://127.0.0.1:8080/gateway",config.url])
  assert.doesNotThrow(()=>createGatewayClient({...config,url}));
});
test("gateway refuses redirects and applies bounded timeout", async () => {
 const c = createGatewayClient({...config,fetchImpl:async (url, init)=>{
  assert.equal(init.redirect,"error");assert.ok(init.signal);return response({ok:true});
 }});
 await c.sending(OP,"claim");
 for (const timeoutMs of [0,Infinity,60001,1.5]) assert.throws(()=>createGatewayClient({...config,timeoutMs}), {code:"INVALID_GATEWAY_CONFIG"});
});
test("sending and result require explicit positive acknowledgement",async()=>{
 for (const body of [{},{ok:false},{ok:true,error:"rejected"},[],null]) {
  const c = createGatewayClient({...config,fetchImpl:async()=>response(body)});
  await assert.rejects(()=>c.sending(OP,"claim"));
  await assert.rejects(()=>c.result(OP,"claim","confirmed",{}));
 }
 const c=createGatewayClient({...config,fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw Error("truncated");}})});
 await assert.rejects(()=>c.sending(OP,"claim"),{code:"INVALID_GATEWAY_RESPONSE"});
});
test("claim missing operation is an error rather than idle",async()=>{
 for (const body of [{},{operation:[]},{operation:"invalid"}]) {
  const c=createGatewayClient({...config,fetchImpl:async()=>response(body)});
  await assert.rejects(()=>c.claim("claim"),{code:"INVALID_GATEWAY_RESPONSE"});
 }
 assert.equal(await createGatewayClient({...config,fetchImpl:async()=>response({operation:null})}).claim("claim"),null);
});
test("invalid sending ACK prevents printing and persists uncertain operation",async()=>{
 let printed=0;
 const operation={operation_id:OP,fiscal_payload:{restaurantId:OP,orderId:OP,currency:"PLN",items:[{name:"Test",quantityMilli:1000,grossTotalGrosz:100,taxCode:"8"}],totalGrosz:100}};
 const client=createGatewayClient({...config,fetchImpl:async(url,init)=>response(JSON.parse(init.body).action==="claim"?{operation}:{})});
 const journal=new MemoryJournal();const agent=new FiscalAgent({client,journal,driver:{printReceipt:async()=>{printed++;},reconcile:async()=>({status:"unknown"})}});
 const result=await agent.runOnce();assert.equal(result.printed,false);assert.equal(printed,0);assert.equal((await journal.list())[0].phase,"unknown");
});
test("lost result ACK retains journal and recovery reports without reprinting",async()=>{
 let claimed=false, valid=false,printed=0;
 const operation={operation_id:OP,fiscal_payload:{restaurantId:OP,orderId:OP,currency:"PLN",items:[{name:"Test",quantityMilli:1000,grossTotalGrosz:100,taxCode:"8"}],totalGrosz:100}};
 const client=createGatewayClient({...config,fetchImpl:async(url,init)=>{
  const action=JSON.parse(init.body).action;
  if(action==="claim"){const op=claimed?null:operation;claimed=true;return response({operation:op});}
  return response(action==="result"&&!valid?{}:{ok:true});
 }});
 const journal=new MemoryJournal();const agent=new FiscalAgent({client,journal,driver:{printReceipt:async()=>{printed++;return {operationId:OP,status:"confirmed",simulated:true,fiscal:false};},reconcile:async()=>({status:"unknown"})}});
 await agent.runOnce();assert.equal((await journal.list()).length,1);
 valid=true;await agent.recover();assert.equal((await journal.list()).length,0);assert.equal(printed,1);
});


test("claim: 409 CLAIM_FAILED is never treated as an empty fiscal queue", async () => {
 for (const reason of ["CLAIM_FAILED", "PAYLOAD_TENANT_MISMATCH", "SERVER_CONFLICT"]) {
  const c = createGatewayClient({...config,fetchImpl: async () => ({
    ok:false,status:409,json:async()=>({error:reason})
  })});
  await assert.rejects(()=>c.claim("claim-token"),{name:"GatewayError",code:reason,status:409});
 }
});

test("claim: server errors stop the agent without printing, not a successful idle", async () => {
 let printed=0;
 const client=createGatewayClient({...config,fetchImpl:async()=>({
  ok:false,status:409,json:async()=>({error:"CLAIM_FAILED"})
 })});
 const agent=new FiscalAgent({
  client,journal:new MemoryJournal(),
  driver:{printReceipt:async()=>{printed++;},reconcile:async()=>null}
 });
 await assert.rejects(()=>agent.runOnce(),{code:"CLAIM_FAILED"});
 assert.equal(printed,0);
});

test("claim: only 200 operation:null indicates an empty queue", async () => {
 const c=createGatewayClient({...config,fetchImpl:async()=>response({operation:null})});
 assert.equal(await c.claim("claim-token"),null);
});

test("claim: malformed operation envelopes fail closed before local printing", async () => {
 const bad=[
  {},{operationId:"not-an-id",fiscal_payload:{}},
  {operation_id:OP},{operation_id:OP,fiscal_payload:null},
  {operation_id:OP,fiscal_payload:[]},
  {operation_id:OP,fiscal_payload:"payload"}
 ];
 for (const operation of bad) {
  const client=createGatewayClient({...config,fetchImpl:async()=>response({operation})});
  await assert.rejects(()=>client.claim("claim-token"),{code:"INVALID_CLAIM_OPERATION"});
 }
 const valid=createGatewayClient({...config,fetchImpl:async()=>response({operation:{operation_id:OP,fiscal_payload:{restaurantId:OP}}})});
 assert.equal((await valid.claim("claim-token")).operation_id,OP);
});
