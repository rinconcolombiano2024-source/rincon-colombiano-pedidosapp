import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

function harness(options={}) {
  let handler;
  const calls={provider:[],writes:[],filters:[]};
  const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',STRIPE_SECRET_KEY:'sk_test_fixture',APP_BASE_URL:'https://restaurant.example',...options.env};
  const account={id:'acct_fixture',type:'express',country:'PL',metadata:{rc_ordera_user_id:options.otherOwner?'other':'owner',account_type:options.accountType||'restaurant'},details_submitted:!options.pending,payouts_enabled:!options.pending,charges_enabled:true,capabilities:{transfers:'active'},requirements:{}};
  const admin={auth:{getUser:async()=>({data:{user:options.unauthorized?null:{id:'owner',email:'owner@example.invalid'}},error:null})},from(table){
    let write=false;
    const query={select(){return this;},eq(key,value){calls.filters.push([table,key,value]);return this;},is(){return this;},update(data){write=true;calls.writes.push(data);return this;},upsert(data){write=true;calls.writes.push(data);return this;},async maybeSingle(){
      const data=table==='restaurant_profiles'?{country_code:options.country||'PL'}:table==='courier_profiles'?{country:'PL',status:'approved'}:table==='marketplace_provider_availability'?{provider:'stripe_connect',online_payments_enabled:true,marketplace_split_enabled:true}:write?{id:'row',provider_account_id:'acct_fixture'}:options.existing?{id:'row',provider_account_id:'acct_fixture'}:null;
      return {data,error:null};
    }};return query;
  }};
  const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextDecoder,Uint8Array,AbortController,DOMException,setTimeout,clearTimeout,console,
    Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},withCors:fn=>fn,createClient:()=>admin,
    fetch:async(url,init)=>{calls.provider.push({url,method:init.method,body:String(init.body||''),headers:init.headers});return new Response(JSON.stringify(url.endsWith('/account_links')?{url:options.linkUrl||'https://connect.stripe.com/setup/fixture',expires_at:Math.floor(Date.now()/1000)+300}:account));},
  });
  const source=readFileSync('supabase/functions/marketplace-onboarding/index.ts','utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(stripTypeScriptTypes(source),context);
  return {calls,invoke:(action='status',authorization='Bearer fixture',body)=>handler(new Request('https://project.example/onboarding',{method:'POST',headers:{authorization,'content-type':'application/json'},body:body??JSON.stringify({accountType:options.accountType||'restaurant',action,owner_user_id:'attacker'})}))};
}

test('onboarding missing configuration fails without provider calls or writes',async()=>{
 const h=harness({env:{STRIPE_SECRET_KEY:''}});assert.equal((await h.invoke()).status,503);assert.equal(h.calls.provider.length,0);assert.equal(h.calls.writes.length,0);
});
test('onboarding missing and invalid sessions cannot access provider',async()=>{
 for(const options of [{authorization:''},{unauthorized:true}]){const h=harness(options);assert.equal((await h.invoke('onboarding',options.authorization??'Bearer fixture')).status,401);assert.equal(h.calls.provider.length,0);assert.equal(h.calls.writes.length,0);}
});
test('onboarding rejects oversized payload before account operations',async()=>{
 const h=harness();assert.equal((await h.invoke('status','Bearer fixture',JSON.stringify({padding:'x'.repeat(17000)}))).status,413);assert.equal(h.calls.provider.length,0);assert.equal(h.calls.writes.length,0);
});
test('status of unconnected company never creates a provider account',async()=>{
 const h=harness();const r=await h.invoke();assert.equal(r.status,200);assert.equal((await r.json()).onboardingStatus,'not_started');assert.equal(h.calls.provider.length,0);assert.equal(h.calls.writes.length,0);assert.ok(h.calls.filters.some(([t,k,v])=>t==='marketplace_accounts'&&k==='owner_user_id'&&v==='owner'));
});
test('unavailable country cannot create company account',async()=>{
 const h=harness({country:'CO'});assert.equal((await h.invoke('onboarding')).status,409);assert.equal(h.calls.provider.length,0);assert.equal(h.calls.writes.length,0);
});
test('another company provider account cannot become verified',async()=>{
 const h=harness({existing:true,otherOwner:true});assert.equal((await h.invoke()).status,409);assert.equal(h.calls.writes.length,0);
});
test('owned completed company is reconciled without initiating charges',async()=>{
 const h=harness({existing:true});const r=await h.invoke();assert.equal(r.status,200);assert.equal((await r.json()).onboardingStatus,'complete');assert.equal(h.calls.provider.length,1);assert.equal(h.calls.provider[0].method,'GET');assert.equal(h.calls.writes.length,1);
});

for(const type of ['restaurant','courier']) {
 test(`${type}: expired onboarding link returns to authenticated refresh flow`,async()=>{
  const h=harness({existing:true,pending:true,accountType:type});
  const r=await h.invoke('onboarding');assert.equal(r.status,200);
  const request=h.calls.provider.find(call=>call.url.endsWith('/account_links'));
  assert.ok(request);const body=new URLSearchParams(request.body);
  assert.equal(body.get('refresh_url'),`https://restaurant.example/${type==='restaurant'?'restaurante':'colaborador'}.html?payments=refresh`);
  assert.equal(body.get('return_url'),`https://restaurant.example/${type==='restaurant'?'restaurante':'colaborador'}.html?payments=return`);
  assert.equal(body.get('account'),'acct_fixture');
 });
}
test('onboarding rejects credential-bearing provider redirect',async()=>{
 const h=harness({existing:true,pending:true,linkUrl:'https://secret@connect.stripe.com/setup/fixture'});
 assert.equal((await h.invoke('onboarding')).status,502);
});
for(const accountType of ['restaurant','courier']) {
 test(`${accountType}: repeated onboarding creation uses stable owner-scoped idempotency`,async()=>{
  const h=harness({pending:true,accountType});
  for(let i=0;i<2;i++) assert.equal((await h.invoke('onboarding')).status,200);
  const creates=h.calls.provider.filter(call=>call.url.endsWith('/accounts'));
  assert.equal(creates.length,2);
  for(const call of creates){
   assert.equal(call.headers['Idempotency-Key'],`rc-ordera-account:owner:${accountType}`);
   const body=new URLSearchParams(call.body);
   assert.equal(body.get('metadata[rc_ordera_user_id]'),'owner');
   assert.equal(body.get('metadata[account_type]'),accountType);
  }
  assert.ok(h.calls.provider.every(call=>!call.url.includes('payment_intents')&&!call.url.includes('charges')));
 });
}
