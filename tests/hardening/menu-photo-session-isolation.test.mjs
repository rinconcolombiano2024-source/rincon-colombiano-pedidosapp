import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const file of ['app.js','www/app.js']) {
  const source=readFileSync(file,'utf8');
  const start=source.indexOf('async function uploadRestaurantImageDataUrl(');
  const end=source.indexOf('async function materializeMenuImagesForCloud(',start);
  assert.ok(start>0&&end>start);
  function harness({deferAuth=false,deferUpload=false,authId='A'}={}) {
    let releaseAuth,releaseUpload,uploads=0,urls=0;
    const storage={
      upload:async(path)=>{uploads++;assert.ok(path.startsWith('A/'));return deferUpload?new Promise(r=>{releaseUpload=r;}):{data:{path},error:null};},
      getPublicUrl:()=>{urls++;return {data:{publicUrl:'https://example.test/storage/v1/object/public/restaurant-media/A/photo.png'}};},
    };
    const client={auth:{getUser:async()=>deferAuth?new Promise(r=>{releaseAuth=r;}):{data:{user:{id:authId}},error:null}},storage:{from:()=>storage}};
    const state={client,user:{id:'A'}};
    const ctx=vm.createContext({cloudState:state,navigator:{onLine:true},console:{log(){},error(){}},
      appUiText:s=>s,isInlineRestaurantImage:s=>s.startsWith('data:'),normalizeProductImageUrl:s=>s,
      restaurantImageDataUrlToBlob:()=>({size:1,type:'image/png'}),restaurantMediaPathSegment:s=>s,
      hashText:()=> 'hash',RESTAURANT_MEDIA_BUCKET:'restaurant-media',withCloudTimeout:p=>p});
    vm.runInContext(source.slice(start,end),ctx);
    return {state,client,run:()=>ctx.uploadRestaurantImageDataUrl('data:image/png;base64,AA==','products','dish'),
      auth:()=>releaseAuth({data:{user:{id:authId}},error:null}),upload:()=>releaseUpload({data:{path:'A/photo.png'},error:null}),
      counts:()=>({uploads,urls})};
  }
  for(const change of ['owner','client','logout'])test(`${file}: late photo auth cannot restore or upload for a previous session (${change})`,async()=>{
    const h=harness({deferAuth:true});const run=h.run();
    if(change==='owner')h.state.user={id:'B'};
    if(change==='client')h.state.client={};
    if(change==='logout')h.state.user=null;
    const current=h.state.user;h.auth();
    await assert.rejects(run,{code:'RC_ORDERA_MENU_SESSION_CHANGED'});
    assert.equal(h.state.user,current);assert.deepEqual(h.counts(),{uploads:0,urls:0});
  });
  test(`${file}: authentication for another owner cannot upload the old menu photo`,async()=>{
    const h=harness({authId:'B'});
    await assert.rejects(h.run(),{code:'RC_ORDERA_MENU_SESSION_CHANGED'});
    assert.equal(h.state.user.id,'A');assert.equal(h.counts().uploads,0);
  });
  test(`${file}: completed upload cannot publish a URL into the next restaurant`,async()=>{
    const h=harness({deferUpload:true});const run=h.run();
    await new Promise(r=>setImmediate(r));h.state.user={id:'B'};h.upload();
    await assert.rejects(run,{code:'RC_ORDERA_MENU_SESSION_CHANGED'});
    assert.equal(h.state.user.id,'B');assert.deepEqual(h.counts(),{uploads:1,urls:0});
  });
  test(`${file}: unchanged owner still uploads and obtains its public image`,async()=>{
    const h=harness();assert.match(await h.run(),/restaurant-media\/A\/photo.png$/);
    assert.deepEqual(h.counts(),{uploads:1,urls:1});
  });
  test(`${file}: a batch cannot continue old restaurant photos under a new session`,async()=>{
    let uploads=0;
    const state={client:{},user:{id:'A'}};
    const ctx=vm.createContext({cloudState:state,navigator:{onLine:true},
      normalizeMenuCatalog:structuredClone,isInlineRestaurantImage:s=>s.startsWith('data:'),appUiText:s=>s,
      uploadRestaurantImageDataUrl:async()=>{uploads++;state.user={id:'B'};return 'https://example.test/image.png';},
    });
    const stop=source.indexOf('function menuHasInlineRestaurantImages(',end);
    vm.runInContext(source.slice(end,stop),ctx);
    const menu={Food:Array.from({length:4},(_,i)=>({id:String(i),imageUrl:'data:image/png;base64,AA=='}))};
    await assert.rejects(ctx.materializeMenuImagesForCloud(menu),{code:'RC_ORDERA_MENU_SESSION_CHANGED'});
    assert.ok(uploads<=3,'a second batch must never start');
    assert.ok(menu.Food.every(p=>p.imageUrl.startsWith('data:')));
  });
}
