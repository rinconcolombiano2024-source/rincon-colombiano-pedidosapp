import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardHarness} from '../support/dashboard-harness.mjs';
test('dashboard ES/PL/EN preserves spacing between translated labels and values',async()=>{
 const h=dashboardHarness();
 for(const [lang,title,label] of [['es','Centro de Integraciones','Dispositivos registrados: 2'],['pl','Centrum integracji','Zarejestrowane urządzenia: 2'],['en','Integration centre','Registered devices: 2'],['es','Centro de Integraciones','Dispositivos registrados: 2']]){
  h.changeLanguage(lang);await h.load();assert.equal(h.heading.textContent,title);assert.equal(h.results.children[0].textContent,label);
 }
});
test('dashboard manual refresh translates only diagnostics, not 200 static cards',async()=>{
 const h=dashboardHarness();const before=h.stats();await h.load();const after=h.stats();
 assert.equal(after.requests-before.requests,1);assert.ok(after.translations-before.translations<30);
 assert.equal(h.heading.textContent,'Centro de Integraciones');
});
test('dashboard selecting the same language causes no redundant text writes',()=>{
 const h=dashboardHarness();h.changeLanguage('pl');const before=h.stats();h.changeLanguage('pl');assert.equal(h.stats().writes,before.writes);
});
test('screen reader labels switch ES/PL/EN and restore their Spanish source',async()=>{
 const h=dashboardHarness();
 for(const [lang,categories,diagnostics] of [['pl','Kategorie','Diagnostyka integracji'],['en','Categories','Integration diagnostics'],['es','Categorías','Diagnóstico de integraciones']]){
  h.changeLanguage(lang);await h.load();
  assert.equal(h.categories.getAttribute('aria-label'),categories);
  assert.equal(h.controls.getAttribute('aria-label'),diagnostics);
 }
});
