import test from "node:test";
import assert from "node:assert/strict";
import { authorizeRoute, protectedNavigation } from "../../security/protected-routes.mjs";

function client({ user = { id: "u1" }, roles = [], rpc = true, error = null } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: roles, error }) }) }) }),
    rpc: async () => ({ data: rpc, error })
  };
}

test("unauthenticated user is blocked", async () => {
  assert.equal((await authorizeRoute(client({user:null}), "restaurant", {restaurantId:"r"})).reason,"login_required");
});
test("public customer account route requires valid auth", async () => {
  assert.equal((await authorizeRoute(client(), "customer")).allowed,true);
});
test("restaurant routes require restaurant context", async () => {
  assert.equal((await authorizeRoute(client(), "restaurant")).allowed,false);
});
test("restaurant permission RPC denies access", async () => {
  assert.equal((await authorizeRoute(client({rpc:false}), "restaurant", {restaurantId:"r"})).allowed,false);
});
test("restaurant permission RPC allows access", async () => {
  assert.equal((await authorizeRoute(client({rpc:true}), "restaurant", {restaurantId:"r"})).allowed,true);
});
test("fail closed when permissions cannot be checked", async () => {
  assert.equal((await authorizeRoute(client({error:{message:"network"}}), "admin")).allowed,false);
});
test("never allow arbitrary routes", async () => {
  assert.equal((await authorizeRoute(client(), "fiscal-console")).allowed,false);
});
test("redirect helper distinguishes login and forbidden", () => {
  assert.equal(protectedNavigation({allowed:false,reason:"login_required"}), "index.html");
  assert.equal(protectedNavigation({allowed:false,reason:"forbidden"}), "index.html");
  assert.equal(protectedNavigation({allowed:true}), null);
});
