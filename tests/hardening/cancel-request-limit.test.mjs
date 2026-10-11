import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {edgeHarness} from '../support/edge-harness.mjs';

const userId = randomUUID();
const env = {
  SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-not-a-real-secret',
  SUPABASE_ANON_KEY: 'test-public-key',
};
const headers = {origin:'https://rincon-colombiano-pedidosapp.vercel.app',
  authorization: 'Bearer fixture-user-token', 'content-type':'application/json'};
function harness() {
  let reads = 0;
  const handler = edgeHarness('supabase/functions/marketplace-cancel-order/index.ts',{
    env,
    createClient: () => {
      return {
        auth: {getUser: async () => ({data:{user:{id:userId}},error:null})},
        from: () => {reads++;throw new Error('Order database must not be touched by invalid payload');},
        rpc: () => {reads++;throw new Error('Cancellation RPC must not be called');},
      };
    },
  });
  return {handler,dbReads:()=>reads};
}
const make = (body,extra={}) => new Request('https://fixture.supabase.co/functions/v1/marketplace-cancel-order',{
  method:'POST',headers:{...headers,...extra},body,
});
test('cancellation reads only bounded bytes even without Content-Length',async()=>{
  const h=harness();let pulls=0;
  const body = new ReadableStream({
    pull(controller) {
      pulls++;
      controller.enqueue(new TextEncoder().encode('A'.repeat(9000)));
      if(pulls>5)throw new Error('Exceeded stream read limit');
    },
    cancel() {},
  });
  const response = await h.handler(new Request(
    'https://fixture.supabase.co/functions/v1/marketplace-cancel-order',
    {method:'POST',duplex:'half',headers,body},
  ));
  assert.equal(response.status,413);
  assert.equal((await response.json()).error,'Payload too large');
  assert.ok(pulls<=3,'must abort stream after crossing the 16KiB bound');
  assert.equal(h.dbReads(),0);
});
test('cancellation rejects claimed oversized, malformed content length and malformed JSON',async()=>{
  const h=harness();
  for(const [body,extra,expected] of [
    ['{}',{'content-length':'20000'},413],
    ['{}',{'content-length':'abc'},400],
    ['{bad',{},400],
    ['null',{},400],
    ['[]',{},400],
    [JSON.stringify({orderId:{toString:null}}),{},400],
    [JSON.stringify({orderId:userId,reason:{toString:null}}),{},400],
    [JSON.stringify({orderId:userId,reason:123}),{},400],
    [new Uint8Array([0xff,0xfe]),{},400],
  ]) {
    const response = await h.handler(make(body,extra));
    assert.equal(response.status,expected,`body=${String(body)}`);
  }
  assert.equal(h.dbReads(),0);
});
test('well-formed invalid order is rejected without contacting orders table',async()=>{
  const h=harness();
  const response=await h.handler(make(JSON.stringify({orderId:'not-a-uuid',reason:'test'})));
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'Invalid order');
  assert.equal(h.dbReads(),0);
});
