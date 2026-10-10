const assert=require('node:assert/strict');
const {apiRequest,restPath,normalizeUrl}=require('./supabase-rest.cjs');

// Only callers behind the explicit disposable-staging gate may invoke this probe.
// No insert/delete, financial field, order status or unrestricted PATCH is allowed.
async function probeForeignMutation({config,attacker,owner,table,filters,field,value,request=apiRequest}){
 assert.equal(config.confirmed,true,'Explicit staging confirmation required');
 assert.equal(config.mutationsAllowed,true,'Disposable mutation fixtures must be opted in');
 const url=normalizeUrl(config.url),production=normalizeUrl(config.productionUrl);
 assert.ok(url&&production&&url!==production,'Mutation cannot target production or an unknown active project');
 assert.notEqual(attacker.userId,owner.userId,'Fixture actors must differ');
 assert.ok(['app_settings','restaurant_staff_memberships'].includes(table));
 assert.equal(filters[table==='app_settings'?'user_id':'restaurant_user_id'],owner.userId);
 assert.equal(field,table==='app_settings'?'updated_at':'active');
 if(table==='restaurant_staff_memberships')assert.match(filters.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
 const path=restPath(table,field,filters);
 const read=async()=>{
  const r=await request({config,token:owner.token,path});assert.equal(r.status,200,'Owner fixture read failed');
  assert.ok(Array.isArray(r.data)&&r.data.length===1,'Exactly one existing owner fixture required');
  assert.ok(Object.hasOwn(r.data[0],field));return r.data[0][field];
 };
 const original=await read();assert.notDeepEqual(original,value,'Probe must attempt a different value');
 try{
  const r=await request({config,token:attacker.token,method:'PATCH',path,body:{[field]:value}});
  assert.ok([200,403].includes(r.status),'Invalid auth, schema or server errors cannot prove RLS');
  if(r.status===200)assert.deepEqual(r.data,[],'Foreign mutation returned rows');
  assert.deepEqual(await read(),original,'Foreign mutation altered fixture');
 }finally{
  const current=await read();
  if(current!==original){
   const restore=await request({config,token:owner.token,method:'PATCH',path,body:{[field]:original}});
   assert.equal(restore.status,200,'ALERT: owner fixture restore failed');
   assert.deepEqual(await read(),original,'ALERT: owner fixture still changed');
  }
 }
}
module.exports={probeForeignMutation};
