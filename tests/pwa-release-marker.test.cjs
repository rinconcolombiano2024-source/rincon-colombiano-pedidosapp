"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const load=p=>fs.readFileSync(path.join(root,p),"utf8");
test("release indicator is present and matches published files",()=>{
  const a=load("rc-ordera-release.json"),b=load("www/rc-ordera-release.json");
  assert.equal(a,b);
  const info=JSON.parse(a);
  assert.equal(info.release,"2026-10-14-r24");
  assert.equal(info.app,"RC ORDERA");
  const sw=load("service-worker.js");
  assert.equal(sw,load("www/service-worker.js"));
  assert.ok(sw.includes('const CACHE_NAME = "' + info.pwaCache + '";'), "PWA cache must match published release");
});
test("PWA cache rollover never removes local orders, indexedDB or localStorage",()=>{
  const sw=load("service-worker.js");
  assert.match(sw,/keys\(\)/);
  assert.match(sw,/caches\.delete\(key\)/);
  assert.doesNotMatch(sw,/localStorage\.(removeItem|clear)\(/);
  assert.doesNotMatch(sw,/indexedDB\.deleteDatabase\(/);
  assert.doesNotMatch(sw,/unregister\s*\(/);
  assert.match(sw,/network-first semantics|fetch\(event\.request\)/);
});
test("runtime release check reads one no-store marker and never touches customer data",()=>{
  const script=load("scripts/verify-production-release.mjs");
  assert.match(script,/rc-ordera-release\.json/);
  assert.match(script,/cache: "no-store"/);
  assert.match(script,/['"]index\.html['"]/);
  assert.match(script,/await download\(''\)/);
  assert.match(script,/restaurantStaffAccessLink/);
  assert.match(script,/waiterTeamButton/);
  assert.doesNotMatch(script,/\.from\(|\.rpc\(|localStorage|service_role|DELETE|POST/);
});
