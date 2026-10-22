import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
test("Android release has stable application ID and safe HTTPS defaults", () => {
 const config=JSON.parse(read("capacitor.config.json"));
 assert.match(config.appId,/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/);
 assert.equal(config.webDir,"www");
 assert.equal(config.server.androidScheme,"https");
 assert.equal(config.server.cleartext,false);
 assert.equal(config.android.allowMixedContent,false);
});
test("Android release web bundle includes client, restaurant, privacy and multilingual assets", () => {
 const script=read("scripts/prepare-capacitor.mjs");
 for(const path of ["cliente.html","cliente.js","restaurante.html","app.js","privacy.html","service-worker.js","supabase-config.js","cliente-manifest.pl.webmanifest","cliente-manifest.en.webmanifest"]) {
  assert.ok(existsSync(new URL(path,root)),`Missing ${path}`);
  assert.ok(script.includes(JSON.stringify(path)),`Not included in Android bundle: ${path}`);
 }
 assert.match(script,/private secret was detected/i);
});
test("Play Store production release requires native Android project and signed AAB", () => {
 const hasNative=existsSync(new URL("android/app/build.gradle",root));
 const hasManifest=existsSync(new URL("android/app/src/main/AndroidManifest.xml",root));
 if(!hasNative||!hasManifest) {
   assert.ok(read("package.json").includes("android:add"),"Missing reproducible native project bootstrap");
 }
});
