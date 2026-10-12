import { readFileSync, existsSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const PHASES = new Set(['sending', 'result', 'unknown', 'reported_pending']);
const OUTCOMES = new Set(['confirmed', 'failed', 'unknown']);
function validateEntry(entry, id) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      typeof id !== 'string' || !id.trim() || entry.operationId !== id ||
      !PHASES.has(entry.phase) ||
      (entry.outcome !== undefined && !OUTCOMES.has(entry.outcome)) ||
      (['result', 'reported_pending'].includes(entry.phase) && !OUTCOMES.has(entry.outcome)) ||
      (entry.phase === 'unknown' && entry.outcome !== undefined && entry.outcome !== 'unknown')) {
    throw new Error('JOURNAL_INVALID_RECONCILE_REQUIRED');
  }
}
/** Single local process per journal. Lock survives crashes: operator must reconcile before removing it. */
export class FileJournal {
  #closed=false;
  #seenFile=false;
  constructor(path) {
    this.path=resolve(path);this.lock=this.path+'.lock';
    this.#seenFile=existsSync(this.path);
    mkdirSync(dirname(this.path),{recursive:true});
    try{mkdirSync(this.lock,{mode:0o700});}catch{throw new Error('JOURNAL_LOCKED_RECONCILE_BEFORE_UNLOCK');}
    writeFileSync(this.lock+'/owner',String(process.pid),{mode:0o600});
  }
  #read(){
    if(this.#closed)throw new Error('JOURNAL_CLOSED');
    if(!existsSync(this.path)) {
      if(this.#seenFile)throw new Error('JOURNAL_MISSING_RECONCILE_REQUIRED');
      return Object.create(null);
    }
    this.#seenFile=true;
    let entries;
    try { entries=JSON.parse(readFileSync(this.path,'utf8')); }
    catch { throw new Error('JOURNAL_UNREADABLE_RECONCILE_REQUIRED'); }
    if(!entries || typeof entries!=='object' || Array.isArray(entries))
      throw new Error('JOURNAL_INVALID_RECONCILE_REQUIRED');
    for(const [id,entry] of Object.entries(entries))validateEntry(entry,id);
    return Object.assign(Object.create(null),entries);
  }
  #write(obj){
    const tmp=this.path+'.tmp',fd=openSync(tmp,'w',0o600);
    try{writeFileSync(fd,JSON.stringify(obj));fsyncSync(fd);}finally{closeSync(fd);}
    renameSync(tmp,this.path);
    this.#seenFile=true;
    const dir=openSync(dirname(this.path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}
  }
  async list(){return Object.values(this.#read());}
  async put(e){const entries=this.#read();validateEntry(e,e?.operationId);entries[e.operationId]=e;this.#write(entries);}
  async remove(id){const entries=this.#read();delete entries[id];this.#write(entries);}
  close(){if(this.#closed)return;rmSync(this.lock,{recursive:true});this.#closed=true;}
}
