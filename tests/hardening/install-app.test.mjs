import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function harness(standalone=false){
 class E {constructor(){this.children=[];this.listeners={};this.disabled=false;this.open=false;}setAttribute(){}append(...n){this.children.push(...n);}addEventListener(n,f){this.listeners[n]=f;}showModal(){this.open=true;}close(){this.open=false;}focus(){this.focused=true;}}
 const button=new E(),body=new E(),events={},html={lang:'es'};let translate;
 const window={matchMedia:()=>({matches:standalone}),addEventListener:(n,f)=>events[n]=f};
 const context=vm.createContext({window,navigator:{},document:{querySelector:()=>button,createElement:()=>new E(),body,documentElement:html},MutationObserver:class{constructor(f){translate=f;}observe(){}}});
 vm.runInContext(readFileSync('install-app.js','utf8'),context);
 return {button,dialog:body.children[0],events,change(lang){html.lang=lang;translate();}};
}
test('download action is visible and help works without native install availability in ES/PL/EN',async()=>{
 const h=harness();for(const [lang,label] of [['es','Descargar app'],['pl','Pobierz aplikację'],['en','Download app']]){
 h.change(lang);assert.equal(h.button.textContent,label);await h.button.listeners.click();assert.equal(h.dialog.open,true);assert.ok(h.dialog.children[1].textContent.includes('Android'));h.dialog.children[2].listeners.click();assert.equal(h.dialog.open,false);assert.equal(h.button.focused,true);
 }
});
test('one native prompt per gesture even on double click; dismissal permits help',async()=>{
 const h=harness();let calls=0,release;const choice=new Promise(r=>release=r);
 h.events.beforeinstallprompt({preventDefault(){},prompt:async()=>{calls++;},userChoice:choice});
 const first=h.button.listeners.click();await h.button.listeners.click();assert.equal(calls,1);release({outcome:'dismissed'});await first;assert.equal(h.button.disabled,false);assert.equal(h.dialog.open,false);
 await h.button.listeners.click();assert.equal(h.dialog.open,true);assert.equal(calls,1);
});
test('native failure recovers to help without leaving button disabled',async()=>{
 const h=harness();h.events.beforeinstallprompt({preventDefault(){},prompt:async()=>{throw Error('unsupported');}});await h.button.listeners.click();assert.equal(h.dialog.open,true);assert.equal(h.button.disabled,false);
});
test('standalone app never requests another installation',async()=>{
 const h=harness(true);await h.button.listeners.click();assert.match(h.dialog.children[1].textContent,/ya está abierta/);
});
test('all three pages include a visible entry point and their correct manifests',()=>{
 for(const f of ['index.html','cliente.html','colaborador.html']){const s=readFileSync(f,'utf8');assert.match(s,/data-install-app>Descargar app/);assert.match(s,/src="install-app.js" defer/);assert.match(s,/rel="manifest"/);assert.deepEqual(readFileSync(f),readFileSync('www/'+f));}
 assert.equal(JSON.parse(readFileSync('portal-manifest.webmanifest')).start_url,'./index.html');
});
