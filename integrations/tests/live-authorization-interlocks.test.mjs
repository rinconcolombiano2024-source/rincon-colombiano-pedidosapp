import test from "node:test";
import assert from "node:assert/strict";
import {createAgentRegistry} from "../../fiscal-agent/src/registry.mjs";
import {createPreparedDeliveryRegistry} from "../../delivery-bridge/src/adapter-registry.mjs";
import {evaluateIntegrationReadiness} from "../src/integration-readiness.mjs";

test("registrar POSNET, ELZAB y Novitus no habilita emisión fiscal real", () => {
  const fiscal=createAgentRegistry();
  const drivers=fiscal.supportedDrivers();
  for(const id of ["posnet","elzab","novitus-noviapi"]) assert.ok(drivers.includes(id));
  for(const id of ["posnet","elzab"]) {
    assert.throws(()=>fiscal.create(id), {code:"DRIVER_NOT_IMPLEMENTED"});
  }
  assert.throws(()=>fiscal.create("novitus-noviapi",{
    baseUrl:"https://device.example",username:"test",password:"not-a-real-password"
  }), {code:"PROTOCOL_UNVERIFIED"});
});

test("ningún adaptador provisional autoriza automáticamente reparto externo",()=>{
  const registry=createPreparedDeliveryRegistry();
  for(const provider of ["wolt","glovo","uber_eats","pyszne","bolt_food"]){
    const adapter=registry.create(provider);
    assert.equal(adapter.meta.provisional,true,provider);
  }
});

test("todos los controles nominales nunca conceden permisos sin autorización del backend",()=>{
  const fiscal=evaluateIntegrationReadiness({type:"fiscal",checks:{
    deviceRegistered:true,agentAuthenticated:true,driverVerified:true,
    vatConfigured:true,operationServiceReady:true,reconciliationReady:true
  }});
  const delivery=evaluateIntegrationReadiness({type:"delivery",provider:"glovo",checks:{
    providerAuthorized:true,credentialsVerified:true,storeMapped:true,
    webhookVerified:true,catalogMapped:true,idempotencyReady:true,statusSyncReady:true
  }});
  const payment=evaluateIntegrationReadiness({type:"payment",checks:{
    providerConfigured:true,webhookVerified:true,checkoutVerified:true,
    idempotencyReady:true,reconciliationReady:true,refundsVerified:true
  }});
  for(const result of [fiscal,delivery,payment]){
    assert.equal(result.status,"READY_FOR_AUTHORIZATION");
    assert.equal(result.operationAuthorized,false);
  }
});
