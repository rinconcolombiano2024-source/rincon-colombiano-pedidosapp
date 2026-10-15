import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

function harness(options={}) {
  let handler;
  const calls={provider:[],writes:[],filters:[]};
  const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',STRIPE_SECRET_KEY:'sk_test_fixture',APP_BASE_URL:'https://restaurant.example',...options.env};
  const account={id:'acct_fixture',type:'express',country:'PL',metadata:{rc_ordera_user_id:options.otherOwner?'other':'owner',account_type:'restaurant'},details_submitted:true,payouts_enabled:true,charges_enabled:true,capabilities:{transfers:'active'},requirements:{}};
  const admin={auth:{getUser:async()=>({data:{user:options.unauthorized?null:{id:'owner',email:'owner@example.invalid'}},error:null})},from(table){
    let write=false;
    const query={select(){return this;},eq(key,value){calls.filters.push([table,key,value]);return this;},is(){return this;},update(data){write=true;calls.writes.push(data);return this;},upsert(data){write=true;calls.writes.push(data);return this;},async maybeSingle(){
      const data=table==='restaurant_profiles'?{country_code:options.country||'PL'}:table==='marketplace_provider_availability'?{provider:'stripe_connect',online_payments_enabled:true,marketplace_split_enabled:true}:write?{id:'row',provider_account_id:'acct_fixture'}:options.existing?{id:'row',provider_account_id:'acct_fixture'}:null;
      return {data,error:null};
    }};return query;
  }};
  const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextDecoder,Uint8Array,AbortController,DOMException,setTimeout,clearTimeout,console,
    Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},withCors:fn=>fn,createClient:()=>admin,
    fetch:async(url,init)=>{calls.provider.push({url,method:init.method,body:String(init.body||''),headers:init.headers});return new Response(JSON.stringify(account));},
  });
  const source=readFileSync('supabase/functions/marketplace-onboarding/index.ts','utf8').replace(/^import .*;\n/gm,'');
  vm.runInContext(stripTypeScriptTypes(source),context);
  return {calls,invoke:(action='status',authorization='Bearer fixture',body)=>handler(new Request('https://project.example/onboarding',{method:'POST',headers:{authorization,'content-type':'application/json'},body:body??JSON.stringify({accountType:'restaurant',action,owner_user_id:'attacker'})}))};
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
