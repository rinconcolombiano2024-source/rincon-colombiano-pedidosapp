import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {DeliveryOutbox} from '../src/outbox.mjs';

test('outbox does not forward commands through HTTP redirects or retry uncertain results',async()=>{
 const seen=[];
 const server=createServer((req,res)=>{
  seen.push(req.url);req.resume();
  if(req.url==='/command'){res.writeHead(307,{location:'/unexpected-target'});res.end();}
  else {res.writeHead(200);res.end('ok');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const url=`http://127.0.0.1:${server.address().port}/command`;
  const registry={create:()=>({meta:{provisional:true},buildOutbound:()=>({url,method:'POST',headers:{'content-type':'application/json'},body:'{"orderId":"test-order"}'})})};
  const box=new DeliveryOutbox({registry,simulationOnly:true,fetchImpl:(...args)=>fetch(...args)});
  await box.enqueue({provider:'wolt',orderId:'test-order',action:'accept'});
  const first=await box.tick();
  assert.deepEqual(seen,['/command']);
  assert.equal(first.unknown,1);assert.equal(first.sent,0);
  assert.equal((await box.pending())[0].state,'unknown');
  await box.tick();assert.deepEqual(seen,['/command']);
 } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
