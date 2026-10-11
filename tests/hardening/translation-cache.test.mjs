import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('auto-translate.js','utf8');
const start=source.indexOf('  function trimTranslationCache(');
const end=source.indexOf('  function readCache()',start);
const trim=vm.runInNewContext(`${source.slice(start,end)}; trimTranslationCache`,{TRANSLATION_CACHE_MAX_ENTRIES:900});
test('translation cache rejects non-text values and invalid language keys',()=>{
 const result=trim({'pl|Hola':{text:'Cześć'},'en|Hola':42,'fr|Hola':'Bonjour','pl|Adiós':'Do widzenia'});
 assert.deepEqual(Object.keys(result),['pl|Adiós']);
});
test('translation cache rejects empty and oversized values without losing valid entries',()=>{
 const result=trim({'en|a':' '.repeat(10),'en|b':'x'.repeat(2001),'en|c':'Hello',['pl|'+ 'a'.repeat(501)]:'Cześć'});
 assert.deepEqual(Object.keys(result),['en|c']);
});
test('translation cache keeps latest 900 valid entries, malformed tail cannot evict them',()=>{
 const input=Object.fromEntries(Array.from({length:1000},(_,i)=>['en|item '+i,'Item '+i]));
 for(let i=0;i<1000;i++)input['pl|bad '+i]=null;
 const result=trim(input);
 assert.equal(Object.keys(result).length,900);
 assert.equal(result['en|item 100'],'Item 100');
 assert.equal(result['en|item 999'],'Item 999');
 assert.equal(result['en|item 99'],undefined);
});
test('translation cache handles invalid roots and dangerous property names',()=>{
 for(const value of [null,[],true,'text',12])assert.equal(Object.keys(trim(value)).length,0);
 const result=trim(JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","en|Hola":"Hello"}'));
 assert.deepEqual(Object.keys(result),['en|Hola']);
 assert.equal(result['en|Hola'],'Hello');
});
