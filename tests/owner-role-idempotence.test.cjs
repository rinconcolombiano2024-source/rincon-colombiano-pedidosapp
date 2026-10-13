'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const original=fs.readFileSync('www/app.js','utf8');
const start=source.indexOf('// Cache only confirmed profile writes in this page session.');
const finish=source.indexOf('function applyRestaurantProfile(',start);
const ensureFn=source.slice(start,finish);
assert.ok(ensureFn.includes('async function ensureRestaurantOwnerIdentity('));
assert.ok(ensureFn.includes('let confirmedRestaurantOwnerProfileWrite = null;'));

async function run(ownerRoleActive, upsertError=false){
  let activationCalls=0,upserts=0;
  const ctx=vm.createContext({
    cloudState:{client:{from(table){assert.equal(table,'user_profiles');return {
      upsert:async() => {upserts++;return {error:upsertError?new Error('temporary profile error'):null}}
    }}},user:{id:'restaurant-test'}},
    restaurantProfileFromUserMetadata:()=>({businessName:'Test'}),
    restaurantOwnerUserProfilePayload:profile=>profile,
    activateCurrentUserRole:async role=>{assert.equal(role,'restaurant_owner');activationCalls++},
    console:{warn:()=>{}}
  });
  vm.runInContext(ensureFn,ctx);
  await vm.runInContext('ensureRestaurantOwnerIdentity({businessName:"Test"}, {roleAlreadyActive:'+ownerRoleActive+'})',ctx);
  return {activationCalls,upserts};
}
test('existing active platform role never produces redundant activation RPC',async()=>{
  const r=await run(true);assert.equal(r.activationCalls,0);assert.equal(r.upserts,1);
});
test('missing or unverified role is still activated (no auth regression)',async()=>{
  const r=await run(false);assert.equal(r.activationCalls,1);assert.equal(r.upserts,1);
});
test('transient profile failure does not prevent required role activation',async()=>{
  const r=await run(false,true);assert.equal(r.activationCalls,1);assert.equal(r.upserts,1);
});
test('active role check is scoped to platform and current owner',()=>{
  const sql=source.slice(source.indexOf('const ownerRoleRequest = cloudState.client'),source.indexOf('const ordersRequest = cloudState.client'));
  assert.match(sql,/\.eq\("scope_type", "platform"\)/);
  assert.match(sql,/\.eq\("scope_id", PLATFORM_SCOPE_ID\)/);
  assert.match(sql,/\.eq\("status", "active"\)/);
  assert.match(source,/roleAlreadyActive: !ownerRoleError && ownerRole\?\.status === "active"/);
  assert.equal(source,original,'published runtime equals source');
});
