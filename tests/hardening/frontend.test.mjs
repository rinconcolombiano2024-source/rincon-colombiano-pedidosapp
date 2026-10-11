import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const source=readFileSync('cliente.js','utf8');
function customerHarness(invoke,storageBlocked=false){
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const blocked=new Proxy({}, {get:()=>()=>{throw new Error('storage unavailable');}});
 const context=vm.createContext({customerClient:{functions:{invoke}},customerStoreId:'restaurant-A',customerUser:null,
  customerGenerateId:randomUUID,customerOrderGuardId:randomUUID,customerPendingOrderStorageKey:()=> 'pending',sessionStorage:storageBlocked?blocked:storage,localStorage:storageBlocked?blocked:storage,console});
 vm.runInContext(source.slice(source.indexOf('let customerOrderFlight ='),source.indexOf('function customerStatusText(')),context);
 const payload={items:[{product_id:'dish',quantity:1}],paymentMethod:'Pago al recoger',customer:'Test',createdAt:'2026-10-10'};
 const create=()=>context.customerCreateCustomerOrder(payload,10,'T','Test','Recoger en el punto');return {context,create,payload};
}
test('customer: 100 concurrent submits use one Edge request even when storage is denied',async()=>{
 let calls=0,release;const blocked=new Promise(r=>release=r);
 const h=customerHarness(async(_,{body})=>{calls++;await blocked;return {data:{id:body.p_id,public_token:body.p_public_token}};},true);
 const requests=Array.from({length:100},()=>h.create());assert.equal(calls,1);release();
 const rows=await Promise.all(requests);assert.equal(new Set(rows.map(r=>r.id)).size,1);
});
test('customer: lost response retry reuses ID/token in memory with denied storage',async()=>{
 const sent=[];const h=customerHarness(async(_,{body})=>{sent.push(body);if(sent.length===1)return {error:new Error('network timeout')};return {data:{id:body.p_id,public_token:body.p_public_token}};},true);
 await assert.rejects(h.create,/network timeout/);await h.create();assert.equal(sent[0].p_id,sent[1].p_id);assert.equal(sent[0].p_public_token,sent[1].p_public_token);
 assert.equal(sent[1].p_order_json.publicToken,undefined);
});
test('customer: mismatched server identity fails without destroying pending retry credentials',async()=>{
 const sent=[];const h=customerHarness(async(_,{body})=>{sent.push(body);return {data:{id:sent.length===1?randomUUID():body.p_id,public_token:body.p_public_token}};});
 await assert.rejects(h.create,/INVALID_RESPONSE/);await h.create();assert.equal(sent[0].p_id,sent[1].p_id);
});
test('customer: account/restaurant change cannot display a late confirmation under another session',async()=>{
 let release;const blocked=new Promise(r=>release=r);const h=customerHarness(async(_,{body})=>{await blocked;return {data:{id:body.p_id,public_token:body.p_public_token}};});
 const pending=h.create();h.context.customerStoreId='restaurant-B';release();await assert.rejects(()=>pending,/SESSION_CHANGED/);
});
test('customer: changed cart cannot create a parallel sale while a request is in flight',async()=>{
 let release;const blocked=new Promise(r=>release=r);const h=customerHarness(async(_,{body})=>{await blocked;return {data:{id:body.p_id,public_token:body.p_public_token}};});
 const pending=h.create();h.payload.items[0].quantity=2;await assert.rejects(h.create,/ALREADY_SENDING/);release();await pending;
});
function statusHarness(){
 class Element {constructor(){this.children=[];this.style={};this.disabled=false;this.listeners={};}setAttribute(){}append(...e){this.children.push(...e);}prepend(...e){this.children.unshift(...e);}replaceChildren(){this.children=[];}addEventListener(n,f){this.listeners[n]=f;}}
 const panel=new Element(),delivery=new Element(),clients=[],requests=[];let token='session-A';
 const context=vm.createContext({window:{RC_ORDERA_SUPABASE:{url:'https://fixture.supabase.co',anonKey:'public'},supabase:{createClient:(url,key,options)=>{clients.push(options);return {auth:{getSession:async()=>({data:{session:{access_token:token}}})}};}}},
 document:{getElementById:id=>id==='panel-fiscal'?panel:delivery,createElement:()=>new Element(),createTextNode:value=>({textContent:value})},URL,AbortSignal,fetch:async(url,options)=>{requests.push(options);return {ok:true,json:async()=>({fiscal:{registeredDevices:0,unknownOperations:0},delivery:{pendingReview:0},payment:{}})};}});
 vm.runInContext(readFileSync('centro-integraciones-status.js','utf8'),context);
 const button=panel.children[0].children[2];return {panel,clients,requests,button,context,setToken:t=>token=t};
}
test('dashboard: repeated manual requests reuse one auth client without a refresh timer',async()=>{
 const h=statusHarness();assert.equal(h.requests.length,0);
 for(let i=0;i<20;i++)await h.button.listeners.click();assert.equal(h.requests.length,20);assert.equal(h.clients.length,1);assert.equal(h.clients[0].auth.autoRefreshToken,false);
 assert.ok(h.requests.every(r=>r.signal instanceof AbortSignal));
});
test('dashboard: changed session clears late diagnostic result and permits retry',async()=>{
 const h=statusHarness();h.context.fetch=async()=>{h.setToken('session-B');return {ok:true,json:async()=>({fiscal:{registeredDevices:10,unknownOperations:0},delivery:{pendingReview:0},payment:{}})};};
 await h.button.listeners.click();assert.equal(h.panel.children[0].children[3].children.length,0);assert.equal(h.button.disabled,false);
});

test('integration centre reuses offline catalogue: all 74 entries have ES/PL/EN text',()=>{
 const context=vm.createContext({window:{}});vm.runInContext(readFileSync('offline-i18n.js','utf8'),context);
 const i18n=context.window.RC_ORDERA_OFFLINE_I18N,rows=i18n.rows.filter(r=>r[0].startsWith('integration.centre.'));
 assert.equal(rows.length,74);for(const row of rows)for(const lang of ['es','pl','en'])assert.ok(i18n.catalog[lang][row[0]].trim());
 assert.equal(i18n.translate('Centro de Integraciones','pl'),'Centrum integracji');assert.equal(i18n.translate('Consultar estado','en'),'Check status');
});
test('PWA hardening uses a fresh cache identity; source and runtime keep identical assets',()=>{
 const sw=readFileSync('service-worker.js','utf8');assert.match(sw,/v6-verified-20261011-pwa-safe-r11/);assert.doesNotMatch(sw,/production-hardening-20261010/);
 for(const name of ['service-worker.js','cliente.js','offline-i18n.js','centro-integraciones.html','centro-integraciones-status.js'])assert.deepEqual(readFileSync(name),readFileSync('www/'+name));
});
