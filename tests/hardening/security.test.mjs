import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
test('patched UUID remains compatible with Capacitor xcode CommonJS v4 identifier generation',()=>{
 const xcode=require('xcode'),project=xcode.project('fixture.pbxproj');project.hash={project:{objects:{}}};
 const values=Array.from({length:1000},()=>project.generateUuid());
 assert.ok(values.every(id=>/^[A-F0-9]{24}$/.test(id)));assert.equal(new Set(values).size,1000);
});
test('vendored Supabase boots and creates auth client without dynamic Function fallback',async()=>{
 const context=vm.createContext({console,URL,Headers,Request,Response,TextEncoder,TextDecoder,AbortController,AbortSignal,setTimeout,clearTimeout,setInterval,clearInterval,
  fetch:()=>{throw new Error('network forbidden');},Function:()=>{throw new Error('CSP blocked dynamic evaluation');}});
 context.self=context;context.window=context;
 vm.runInContext(readFileSync('vendor/supabase-2.57.4.js','utf8'),context);
 const client=context.supabase.createClient('https://fixture.supabase.co','fixture-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const session=await client.auth.getSession();assert.equal(session.data.session,null);
});
test('enforced CSP blocks eval while preserving existing explicit script hosts',()=>{
 const header=JSON.parse(readFileSync('vercel.json')).headers.flatMap(h=>h.headers).find(h=>h.key==='Content-Security-Policy').value;
 assert.ok(!header.includes('unsafe-eval'));assert.ok(header.includes('https://*.googleapis.com'));assert.ok(header.includes("object-src 'none'"));
});
