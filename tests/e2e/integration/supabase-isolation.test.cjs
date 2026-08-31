const test = require("node:test");
const assert = require("node:assert/strict");
const {
  apiRequest,
  authenticateActor,
  integrationGate,
  restPath,
  rpcPath,
} = require("./support/supabase-rest.cjs");

function expectNoRows(result, label) {
  assert.ok([200, 401, 403].includes(result.status), `${label}: HTTP inesperado ${result.status}`);
  if (result.status === 200) {
    assert.ok(Array.isArray(result.data), `${label}: la respuesta no es una lista`);
    assert.equal(result.data.length, 0, `${label}: RLS expuso registros privados`);
  }
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
  const result = await apiRequest({
    config: courierGate.config,
    token: courierA.token,
    path: restPath("courier_profiles", "user_id,status", { user_id: courierB.userId }),
  });
  expectNoRows(result, "courier_profiles");
});

const waiterGate = integrationGate(["WAITER"]);
test("RLS: Mesero solo ve sus membresias autorizadas", {
  skip: waiterGate.ready && process.env.RC_TEST_WAITER_OTHER_RESTAURANT_ID
    ? false
    : waiterGate.reason || "Pendiente de Supabase TEST: falta RC_TEST_WAITER_OTHER_RESTAURANT_ID.",
}, async () => {
  const waiter = await authenticateActor("WAITER", waiterGate.config);
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

const anonGate = integrationGate();
test("RLS: anonimo no obtiene tablas privadas", {
  skip: anonGate.ready ? false : anonGate.reason,
}, async () => {
  for (const [table, select] of [
    ["orders", "id"],
    ["app_settings", "user_id"],
    ["courier_profiles", "user_id"],
    ["restaurant_staff_memberships", "restaurant_user_id"],
  ]) {
    const result = await apiRequest({ config: anonGate.config, path: restPath(table, select) });
    expectNoRows(result, `${table} para anon`);
  }
});

test.todo("Mutacion cruzada Restaurante A -> Restaurante B (solo en fixtures desechables de Supabase TEST)");
test.todo("Manipulacion cruzada de personal de Restaurante B (solo en fixtures desechables de Supabase TEST)");
