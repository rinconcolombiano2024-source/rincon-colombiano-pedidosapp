"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("APK CI is debug-only, nonsecret, manually repeatable and uses JDK 21",()=>{
  const w=read(".github/workflows/android-debug-apk.yml");
  assert.match(w,/workflow_dispatch:/);
  assert.match(w,/permissions:\s*\n\s*contents: read/);
  assert.match(w,/java-version: '21'/);
  assert.match(w,/node-version: '22'/);
  assert.match(w,/npm ci --ignore-scripts=false/);
  assert.match(w,/npx cap add android/);
  assert.match(w,/npx cap sync android/);
  assert.match(w,/:app:assembleDebug/);
  assert.match(w,/actions\/upload-artifact@v4/);
  assert.doesNotMatch(w,/assembleRelease|bundleRelease|KEYSTORE_PASSWORD|ANDROID_KEYSTORE|VITE_SECRET|service_role|secrets\./i);
});

test("current Capacitor project packages Browser for window isolation",()=>{
  const cfg=JSON.parse(read("capacitor.config.json"));
  const pkg=JSON.parse(read("package.json"));
  assert.equal(cfg.appId,"com.rcordera.app");
  assert.equal(pkg.dependencies["@capacitor/android"],"8.5.3");
  assert.equal(pkg.dependencies["@capacitor/browser"],"8.0.5");
  assert.match(read("restaurant-fiscal-ui.js"),/capacitor\.Plugins\?\.Browser/);
  assert.match(read("scripts/prepare-capacitor.mjs"),/"restaurant-fiscal-ui\.js"/);
});
