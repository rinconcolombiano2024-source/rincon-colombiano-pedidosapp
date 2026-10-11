import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('auto-translate.js','utf8');
const fn=source.slice(source.indexOf('  async function fetchTranslation('),source.indexOf('function setOriginalAttribute('));
function harness(reply){
 let requests=0,persists=0,now=100000;
 const cache={};
 const context={cache,normalize:v=>String(v||'').trim().replace(/\s+/g,' '),dictionaryTranslation:()=>'',cacheKey:(l,t)=>`${l}|${t}`,translationRequests:new Map(),navigator:{onLine:true},translationServicePausedUntil:0,translationWarningShownAt:0,AbortController,Date:{now:()=>now},console:{warn(){}},window:{RC_ORDERA_SUPABASE:{url:'https://example.test',anonKey:'test'},setTimeout,clearTimeout},scheduleCachePersist:()=>persists++,fetch:async()=>{requests++;return {ok:true,json:async()=>typeof reply==='function'?await reply():reply};}};
 const fetchTranslation=vm.runInNewContext(fn+'; fetchTranslation',context);
 return {fetchTranslation,cache,advance:ms=>now+=ms,stats:()=>({requests,persists})};
}
test('remote translation rejects object/number/array instead of displaying coerced text',async()=>{
 for(const value of [{message:'hello'},42,['hello']]){
  const h=harness({translatedText:value});
  assert.equal(await h.fetchTranslation('Texto desconocido','en'),'Texto desconocido');
  assert.deepEqual(h.cache,{});assert.equal(h.stats().persists,0);
 }
});
test('malformed remote response backs off for subsequent text without caching fallback',async()=>{
 for(const reply of [null,{}, {translatedText:'   '}, {translatedText:'x'.repeat(2001)}]){
  const h=harness(reply);
  assert.equal(await h.fetchTranslation('Primero desconocido','pl'),'Primero desconocido');
  assert.equal(await h.fetchTranslation('Segundo desconocido','pl'),'Segundo desconocido');
  assert.deepEqual(h.stats(),{requests:1,persists:0});assert.deepEqual(h.cache,{});
 }
});
test('valid translated text is normalized and reused without additional request',async()=>{
 const h=harness({translatedText:'  Hello   world  '});
 assert.equal(await h.fetchTranslation('Texto desconocido','en'),'Hello world');
 assert.equal(await h.fetchTranslation('Texto desconocido','en'),'Hello world');
 assert.deepEqual(h.stats(),{requests:1,persists:1});
});
test('concurrent translations of same text share one remote operation',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const h=harness(()=>pending);
 const a=h.fetchTranslation('Texto desconocido','en'),b=h.fetchTranslation('Texto desconocido','en');
 release({translatedText:'Hello'});
 assert.deepEqual(await Promise.all([a,b]),['Hello','Hello']);
 assert.deepEqual(h.stats(),{requests:1,persists:1});
});

test('translation resumes after backoff and replaces no original text in cache on failure',async()=>{
 let valid=false;const h=harness(()=>valid?{translatedText:'Recovered'}:{});
 assert.equal(await h.fetchTranslation('Texto desconocido','en'),'Texto desconocido');
 valid=true;h.advance(19999);
 assert.equal(await h.fetchTranslation('Texto desconocido','en'),'Texto desconocido');
 h.advance(1);
 assert.equal(await h.fetchTranslation('Texto desconocido','en'),'Recovered');
 assert.deepEqual(h.stats(),{requests:2,persists:1});
});
