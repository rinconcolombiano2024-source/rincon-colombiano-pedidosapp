const test = require("node:test");
const assert = require("node:assert/strict");
const {
  apiRequest,
  authenticateActor,
  integrationGate,
  restPath: fixturePath,
  rpcPath,
} = require("./support/supabase-rest.cjs");
// One visible row is sufficient to prove a leak; never fetch another tenant's full history.
const restPath=(...args)=>fixturePath(...args)+'&limit=1';

function expectNoRows(result, label, anonymous=false) {
  assert.ok((anonymous?[200,401,403]:[200,403]).includes(result.status), `${label}: HTTP inesperado ${result.status}`);
  if (result.status === 200) {
    assert.ok(Array.isArray(result.data), `${label}: la respuesta no es una lista`);
    assert.equal(result.data.length, 0, `${label}: RLS expuso registros privados`);
  }
}

async function expectOwnerFixture(config,owner,table,select,filters={}) {
 const r=await apiRequest({config,token:owner.token,path:restPath(table,select,filters)});
 assert.equal(r.status,200,`${table}: owner fixture must be readable`);
 assert.ok(Array.isArray(r.data)&&r.data.length>0,`${table}: existing fixture required to prove isolation`);
}

const restaurantGate = integrationGate(["RESTAURANT_A", "RESTAURANT_B"]);
test("RLS: Restaurante A no lee datos privados del Restaurante B", {
  skip: restaurantGate.ready ? false : restaurantGate.reason,
}, async () => {
  const [restaurantA, restaurantB] = await Promise.all([
    authenticateActor("RESTAURANT_A", restaurantGate.config),
    authenticateActor("RESTAURANT_B", restaurantGate.config),
  ]);
  assert.notEqual(restaurantA.userId, restaurantB.userId, "Los fixtures A y B deben ser usuarios diferentes.");

  const probes = [
    ["orders", "id,user_id", { user_id: restaurantB.userId }],
    ["app_settings", "user_id,updated_at", { user_id: restaurantB.userId }],
    ["restaurant_staff_memberships", "restaurant_user_id,member_user_id,station", { restaurant_user_id: restaurantB.userId }],
  ];
  for (const [table, select, filters] of probes) {
    const owner = await apiRequest({config:restaurantGate.config,token:restaurantB.token,path:restPath(table,select,filters)});
    assert.equal(owner.status,200,`${table}: fixture owner cannot read`);
    assert.ok(Array.isArray(owner.data)&&owner.data.length>0,`${table}: missing owner fixture cannot prove isolation`);
    const result = await apiRequest({
      config: restaurantGate.config,
      token: restaurantA.token,
      path: restPath(table, select, filters),
    });
    expectNoRows(result, table);
  }
});

const customerGate = integrationGate(["CUSTOMER_A", "CUSTOMER_B"]);
test("RLS: Cliente A no lee perfil ni pedidos privados del Cliente B", {
  skip: customerGate.ready ? false : customerGate.reason,
}, async () => {
  const [customerA, customerB] = await Promise.all([
    authenticateActor("CUSTOMER_A", customerGate.config),
    authenticateActor("CUSTOMER_B", customerGate.config),
  ]);
  assert.notEqual(customerA.userId, customerB.userId);
  await expectOwnerFixture(customerGate.config,customerB,"customer_profiles","user_id,full_name",{user_id:customerB.userId});
  await expectOwnerFixture(customerGate.config,customerB,"customer_orders","id,customer_user_id",{customer_user_id:customerB.userId});
  const profile = await apiRequest({
    config: customerGate.config,
    token: customerA.token,
    path: restPath("customer_profiles", "user_id,full_name", { user_id: customerB.userId }),
  });
  expectNoRows(profile, "customer_profiles");
  const orders = await apiRequest({
    config: customerGate.config,
    token: customerA.token,
    path: restPath("customer_orders", "id,customer_user_id", { customer_user_id: customerB.userId }),
  });
  expectNoRows(orders, "customer_orders");
});

const courierGate = integrationGate(["COURIER_A", "COURIER_B"]);
test("RLS: Colaborador A no lee el perfil privado del Colaborador B", {
  skip: courierGate.ready ? false : courierGate.reason,
}, async () => {
  const [courierA, courierB] = await Promise.all([
    authenticateActor("COURIER_A", courierGate.config),
    authenticateActor("COURIER_B", courierGate.config),
  ]);
  assert.notEqual(courierA.userId, courierB.userId);
  await expectOwnerFixture(courierGate.config,courierB,"courier_profiles","user_id,status",{user_id:courierB.userId});
  const result = await apiRequest({
    config: courierGate.config,
    token: courierA.token,
    path: restPath("courier_profiles", "user_id,status", { user_id: courierB.userId }),
  });
  expectNoRows(result, "courier_profiles");
});

const waiterGate = integrationGate(["WAITER","RESTAURANT_B"]);
test("RLS: Mesero solo ve sus membresias autorizadas", {
  skip: waiterGate.ready && process.env.RC_TEST_WAITER_OTHER_RESTAURANT_ID
    ? false
    : waiterGate.reason || "Pendiente de Supabase TEST: falta RC_TEST_WAITER_OTHER_RESTAURANT_ID.",
}, async () => {
  const waiter = await authenticateActor("WAITER", waiterGate.config);
  const owner=await authenticateActor("RESTAURANT_B",waiterGate.config);
  assert.equal(process.env.RC_TEST_WAITER_OTHER_RESTAURANT_ID,owner.userId);
  await expectOwnerFixture(waiterGate.config,owner,"restaurant_staff_memberships","restaurant_user_id",{restaurant_user_id:owner.userId});
  const result = await apiRequest({
    config: waiterGate.config,
    token: waiter.token,
    path: restPath(
      "restaurant_staff_memberships",
      "restaurant_user_id,member_user_id,station,active",
      { restaurant_user_id: process.env.RC_TEST_WAITER_OTHER_RESTAURANT_ID }
    ),
  });
  expectNoRows(result, "restaurant_staff_memberships de otro restaurante");
});

const adminGate = integrationGate(["PLATFORM_ADMIN"]);
test("Rol: administrador TEST es reconocido por is_platform_owner", {
  skip: adminGate.ready ? false : adminGate.reason,
}, async () => {
  const admin = await authenticateActor("PLATFORM_ADMIN", adminGate.config);
  const result = await apiRequest({
    config: adminGate.config,
    token: admin.token,
    method: "POST",
    path: rpcPath("is_platform_owner"),
    body: {},
  });
  assert.equal(result.status, 200);
  assert.equal(result.data, true);
});

const anonGate = integrationGate(["RESTAURANT_B","COURIER_B"]);
test("RLS: anonimo no obtiene tablas privadas", {
  skip: anonGate.ready ? false : anonGate.reason,
}, async () => {
  const owner=await authenticateActor("RESTAURANT_B",anonGate.config);
  const courier=await authenticateActor("COURIER_B",anonGate.config);
  for(const [table,select,actor,filters] of [["orders","id",owner,{user_id:owner.userId}],["app_settings","user_id",owner,{user_id:owner.userId}],["restaurant_staff_memberships","restaurant_user_id",owner,{restaurant_user_id:owner.userId}],["courier_profiles","user_id",courier,{user_id:courier.userId}]])await expectOwnerFixture(anonGate.config,actor,table,select,filters);
  for (const [table, select] of [
    ["orders", "id"],
    ["app_settings", "user_id"],
    ["courier_profiles", "user_id"],
    ["restaurant_staff_memberships", "restaurant_user_id"],
  ]) {
    const result = await apiRequest({ config: anonGate.config, path: restPath(table, select) });
    expectNoRows(result, `${table} para anon`,true);
  }
});

const {probeForeignMutation}=require('./support/mutation-probe.cjs');
const mutationGate=integrationGate(['RESTAURANT_A','RESTAURANT_B']);
const disposable=process.env.RC_TEST_CONFIRM_MUTATION_FIXTURES==='YES';
const mutationReason=mutationGate.reason||'Requires RC_TEST_CONFIRM_MUTATION_FIXTURES=YES and disposable fixtures.';
test('Mutacion cruzada Restaurante A -> Restaurante B (solo fixtures desechables)',{
 skip:mutationGate.ready&&disposable?false:mutationReason,
},async()=>{
 const [attacker,owner]=await Promise.all(['RESTAURANT_A','RESTAURANT_B'].map(a=>authenticateActor(a,mutationGate.config)));
 await probeForeignMutation({config:{...mutationGate.config,mutationsAllowed:disposable},attacker,owner,table:'app_settings',filters:{user_id:owner.userId},field:'updated_at',value:new Date(Date.now()+86400000).toISOString()});
});
const membershipId=process.env.RC_TEST_RESTAURANT_B_MEMBERSHIP_ID||'';
test('Manipulacion cruzada de personal Restaurante B (solo fixtures desechables)',{
 skip:mutationGate.ready&&disposable&&membershipId?false:mutationReason+' Requires RC_TEST_RESTAURANT_B_MEMBERSHIP_ID.',
},async()=>{
 const [attacker,owner]=await Promise.all(['RESTAURANT_A','RESTAURANT_B'].map(a=>authenticateActor(a,mutationGate.config)));
 await probeForeignMutation({config:{...mutationGate.config,mutationsAllowed:disposable},attacker,owner,table:'restaurant_staff_memberships',filters:{restaurant_user_id:owner.userId,id:membershipId},field:'active',value:false});
});
