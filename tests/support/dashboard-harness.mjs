import vm from 'node:vm';
import {readFileSync} from 'node:fs';
export function dashboardHarness(source=readFileSync('centro-integraciones-status.js','utf8')) {
 let writes=0, translations=0,requests=0;
 class Text {
  constructor(v){this.value=v;this.parentElement=null;}
  get nodeValue(){return this.value;} set nodeValue(v){writes++;this.value=v;}
  get textContent(){return this.value;}
 }
 class Element {
  constructor(tag='DIV'){this.tagName=tag;this.children=[];this.style={};this.listeners={};this.disabled=false;this.attributes={};}
  setAttribute(k,v){this.attributes[k]=v;}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
  prepend(...nodes){for(const n of nodes)n.parentElement=this;this.children.unshift(...nodes);}
  replaceChildren(){this.children=[];}
  addEventListener(k,v){this.listeners[k]=v;}
  set textContent(v){this.children=[];this.append(new Text(v));}
  get textContent(){return this.children.map(n=>n.textContent).join('');}
 }
 const document=new Element(),panel=new Element(),delivery=new Element(),selector=new Element('SELECT');
 const heading=new Element('H1');heading.textContent='Centro de Integraciones';
 document.append(heading,selector,panel,delivery);
 for(let i=0;i<200;i++){const p=new Element('P');p.textContent='Sin conectar';document.append(p);}
 document.documentElement={};document.getElementById=id=>({'panel-fiscal':panel,'panel-delivery':delivery,integrationLanguage:selector}[id]);
 document.createElement=tag=>new Element(tag.toUpperCase());document.createTextNode=v=>new Text(v);
 document.createTreeWalker=root=>{
  const nodes=[];function walk(n){if(n instanceof Text)nodes.push(n);else for(const child of n.children||[])walk(child);}walk(root);
  let at=0;return {nextNode:()=>nodes[at++]||null};
 };
 const context=vm.createContext({document,NodeFilter:{SHOW_TEXT:4},URL,URLSearchParams,AbortSignal,
 localStorage:{getItem:()=>null,setItem:()=>{}},window:{location:{search:''},
 RC_ORDERA_SUPABASE:{url:'https://fixture.supabase.co',anonKey:'public'},
 supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-session'}}})}})}},
 fetch:async()=>{requests++;return {ok:true,json:async()=>({fiscal:{registeredDevices:2,unknownOperations:1},delivery:{pendingReview:3},payment:{}})};}});
 vm.runInContext(readFileSync('offline-i18n.js','utf8'),context);
 const translate=context.window.RC_ORDERA_OFFLINE_I18N.translate;
 context.window.RC_ORDERA_OFFLINE_I18N={...context.window.RC_ORDERA_OFFLINE_I18N,translate:(...args)=>{translations++;return translate(...args);}};
 vm.runInContext(source,context);
 const controls=panel.children[0],button=controls.children[2],results=controls.children[3];
 return {document,heading,results,button,stats:()=>({writes,translations,requests}),
 changeLanguage(lang){selector.value=lang;selector.listeners.change();},load:()=>button.listeners.click()};
}
