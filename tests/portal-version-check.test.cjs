"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root,p),"utf8");

test("new portal includes explicit version checker, without restoring public stations",()=>{
  const html=read("index.html");
  assert.equal(html,read("www/index.html"));
  assert.match(html,/data-rc-release="2026-10-14-r23"/);
  assert.match(html,/data-check-portal-version/);
  assert.match(html,/id="portalVersionStatus"/);
  assert.doesNotMatch(html,/(?:Personal y estaciones|href="mesero\.html")/i);
  assert.match(html,/href="cliente.html"/);
  assert.match(html,/href="restaurante.html"/);
  assert.match(html,/href="colaborador.html"/);
});
test("version check is manual, bounded and cannot erase order or fiscal data",()=>{
  const script=read("install-app.js");
  assert.equal(script,read("www/install-app.js"));
  assert.match(script,/versionButton\.addEventListener\('click'/);
  assert.match(script,/cache:'no-store'/);
  assert.match(script,/AbortSignal\.timeout\(10000\)/);
  assert.match(script,/serviceWorker\.getRegistration\(\)/);
  assert.match(script,/window\.location\.assign/);
  assert.doesNotMatch(script,/localStorage\.(clear|removeItem)|indexedDB\.deleteDatabase|caches\.delete|serviceWorker\.getRegistrations\(\)/);
  for(const lang of ["es:","pl:","en:"]) assert.ok(script.includes(lang));
});
test("PWA release is incremented and mirrored, without deleting browser order storage",()=>{
  const marker=JSON.parse(read("rc-ordera-release.json"));
  assert.equal(marker.release,"2026-10-14-r23");
  assert.equal(read("rc-ordera-release.json"),read("www/rc-ordera-release.json"));
  const worker=read("service-worker.js");
  assert.equal(worker,read("www/service-worker.js"));
  assert.ok(worker.includes(marker.pwaCache));
  assert.doesNotMatch(worker,/localStorage\.(clear|removeItem)|indexedDB\.deleteDatabase/);
});
