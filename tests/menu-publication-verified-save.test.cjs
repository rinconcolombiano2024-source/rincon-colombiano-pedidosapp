"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.equal(source, fs.readFileSync(path.join(root, "www/app.js"), "utf8"));
function block(start, end) {
  const a=source.indexOf(start), b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a, "missing block "+start);
  return source.slice(a,b);
}
const saveCode=block("async function verifyPublicMenuProjection(", "\nasync function saveRestaurantPublicProfile(");
const whenCode=block("async function saveMenuWhenPossibleNow(", "\nfunction saveMenuWhenPossible(");

function harness({publicAvailable=true, privateMenu={Platos:[{id:"one",name:"Sancocho",description:"Original",price:45}]}, revision=41}={}) {
  const calls=[], state={current:structuredClone(privateMenu), public:structuredClone(privateMenu), expectedRevision:revision};
  const client={
    from:(table)=>{
      assert.equal(table,"restaurant_public_catalogs");
      return { select:()=>({eq:(column,user)=>{
        assert.equal(column,"restaurant_user_id"); assert.equal(user,"restaurant-1");
        return { maybeSingle:async()=>({data:publicAvailable?{menu:structuredClone(state.public),menu_revision:state.expectedRevision}:null,error:null}) };
      }}) };
    },
  };
  const ctx=vm.createContext({
    cloudState:{client,user:{id:"restaurant-1"}},
    menuCatalog:state.current,
    EMPTY_MENU_CATALOG:{},
    normalizeMenuCatalog:input=>structuredClone(input||{}),
    menuCatalogsMatch:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    storeCloudRevision:(key,revision)=>calls.push(["revision",revision]),
    STORAGE_KEYS:{menuRevision:"rev"},
    saveMenuCache:()=>calls.push(["local"]),
    storeConfirmedCloudMenu:(menu)=>calls.push(["confirmed",structuredClone(menu)]),
    markMenuPending:()=>calls.push(["pending"]),
    appUiText:text=>text,
    console:{error:()=>{}},
  });
  vm.runInContext(saveCode,ctx,{filename:"app.js:menu-publication"});
  return {ctx,client,calls,state};
}

test("private save only succeeds after public catalog matches menu AND revision",async()=>{
 const h=harness();
 const r=await h.ctx.confirmSavedCloudMenu({menu:h.state.current,menuRevision:41},null,h.state.current);
 assert.equal(r.localChangesPending,false);
 assert.ok(h.calls.some(x=>x[0]==="confirmed"));
 assert.ok(h.calls.some(x=>x[0]==="local"));
});

test("public projection failure rejects instead of displaying false synchronized",async()=>{
 const h=harness({publicAvailable:false});
 await assert.rejects(h.ctx.confirmSavedCloudMenu({menu:h.state.current,menuRevision:41},null,h.state.current),/publicacion del menu/);
 const m=harness();
 m.state.public={Platos:[{id:"old",name:"Old product"}]};
 await assert.rejects(m.ctx.confirmSavedCloudMenu({menu:m.state.current,menuRevision:41},null,m.state.current),/disponible para los clientes/);
 const rv=harness();
 rv.state.expectedRevision=40;
 await assert.rejects(rv.ctx.confirmSavedCloudMenu({menu:rv.state.current,menuRevision:41},null,rv.state.current),/version del menu/);
});

test("a newer unsent local product is never replaced by an older Supabase confirmation",async()=>{
 const before={Platos:[{id:"one",name:"Sancocho",description:"Original",price:45}]};
 const h=harness({privateMenu:before});
 const newer={Platos:[{id:"one",name:"Sancocho",description:"Descripción de hoy",price:45},{id:"two",name:"Producto nuevo",price:20}]};
 h.ctx.menuCatalog=structuredClone(newer);
 const result=await h.ctx.confirmSavedCloudMenu({menu:before,menuRevision:41},null,before);
 assert.equal(result.localChangesPending,true);
 assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.menuCatalog)),newer);
 assert.ok(h.calls.some(x=>x[0]==="pending"));
 assert.ok(h.calls.some(x=>x[0]==="confirmed"));
 assert.ok(!h.calls.some(x=>x[0]==="local"),"must not overwrite local cache with old snapshot");
});

test("store switch during projection read refuses to trust previous restaurant's response",async()=>{
 let release;
 const pending=new Promise(resolve=>{release=resolve});
 const h=harness();
 const old=h.client.from;
 h.client.from=()=>({select:()=>({eq:()=>({maybeSingle:()=>pending})})});
 const result=h.ctx.verifyPublicMenuProjection(h.state.current,41);
 h.ctx.cloudState.user={id:"restaurant-2"};
 release({data:{menu:h.state.current,menu_revision:41},error:null});
 await assert.rejects(result,/Cambió la cuenta/);
 h.client.from=old;
});

test("a failed public publication leaves the local pending token and shows a warning",async()=>{
 const pendingToken="draft-123", operations=[];
 const ctx=vm.createContext({
   cloudState:{user:{id:"restaurant-1"}},
   navigator:{onLine:true},
   currentMenuPendingToken:()=>pendingToken,
   saveCloudMenu:async()=>{throw Error("public projection mismatch")},
   withCloudTimeout:async p=>p,
   updateCloudStatus:(t)=>operations.push(t),
   clearMenuPending:()=>{throw Error("must not clear pending on failed save")},
   markMenuPending:()=>operations.push("pending"),
   shouldQueueForCloud:()=>true,
   console:{error:()=>{}},
 });
 vm.runInContext(whenCode,ctx);
 const result=await ctx.saveMenuWhenPossibleNow();
 assert.equal(result.synced,undefined);
 assert.ok(result.error);
 assert.ok(operations.includes("pending"));
 assert.ok(!operations.includes("Sincronizado"));
});
