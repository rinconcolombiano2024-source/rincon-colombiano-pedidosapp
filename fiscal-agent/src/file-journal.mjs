import { readFileSync, existsSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
/** Single local process per journal. Lock survives crashes: operator must reconcile before removing it. */
export class FileJournal {
  #closed=false;
  constructor(path) {
    this.path=resolve(path);this.lock=this.path+'.lock';
    mkdirSync(dirname(this.path),{recursive:true});
    try{mkdirSync(this.lock,{mode:0o700});}catch{throw new Error('JOURNAL_LOCKED_RECONCILE_BEFORE_UNLOCK');}
    writeFileSync(this.lock+'/owner',String(process.pid),{mode:0o600});
  }
  #read(){if(this.#closed)throw new Error("JOURNAL_CLOSED");return existsSync(this.path)?JSON.parse(readFileSync(this.path,'utf8')):{};}
  #write(obj){
    const tmp=this.path+'.tmp',fd=openSync(tmp,'w',0o600);
    try{writeFileSync(fd,JSON.stringify(obj));fsyncSync(fd);}finally{closeSync(fd);}
    renameSync(tmp,this.path);
    const dir=openSync(dirname(this.path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}
  }
  async list(){return Object.values(this.#read());}
  async put(e){const entries=this.#read();entries[e.operationId]=e;this.#write(entries);}
  async remove(id){const entries=this.#read();delete entries[id];this.#write(entries);}
  close(){if(this.#closed)return;rmSync(this.lock,{recursive:true});this.#closed=true;}
}
