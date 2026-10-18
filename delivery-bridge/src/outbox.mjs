import { createHash, randomUUID } from 'node:crypto';
import { normalizeProvider } from './providers.mjs';
const PRECEDENCE = { accept:0, reject:0, ready:1, delivered:2, cancel:9 };
const TRANSIENT = new Set([408,425,429,500,502,503,504]);
function fingerprint(value) {
  if (Array.isArray(value)) return '[' + value.map(fingerprint).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+fingerprint(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const copy = e => e ? structuredClone(e) : null;

/** Test store only. Production requires a durable atomic backend. */
export class MemoryOutboxStore {
  durable = false; #m = new Map(); events = [];
  async get(id) { return copy(this.#m.get(id)); }
  async list({limit=100,afterId=null,states=null}={}) {
    return [...this.#m.values()].filter(e=>(!afterId||e.id>afterId)&&(!states||states.includes(e.state))).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limit).map(copy);
  }
  async due(now,limit=100,blockedProviders=[]) {
    return [...this.#m.values()].filter(e=>e.state==='pending'&&e.nextAttemptAt<=now&&!blockedProviders.includes(e.provider)
      &&(e.action!=='ready'||[...this.#m.values()].some(a=>a.restaurantId===e.restaurantId&&a.provider===e.provider&&a.orderId===e.orderId&&a.action==='accept'&&(a.state==='sent'||(a.state==='pending'&&a.nextAttemptAt<=now)))))
      .sort((a,b)=>PRECEDENCE[a.action]-PRECEDENCE[b.action]||a.createdAt-b.createdAt||a.id.localeCompare(b.id)).slice(0,limit).map(copy);
  }
  async insert(e) { if (this.#m.has(e.id)) return false; this.#m.set(e.id,copy(e)); this.events.push({id:e.id,type:'enqueued'}); return true; }
  async claim(id, token, now, leaseMs) {
    const e=this.#m.get(id); if (!e || e.state!=='pending' || e.nextAttemptAt>now) return null;
    if(e.action==='ready'&&![...this.#m.values()].some(a=>a.restaurantId===e.restaurantId&&a.provider===e.provider&&a.orderId===e.orderId&&a.action==='accept'&&a.state==='sent'))return null;
    const next={...e,state:'processing' ,claimToken:token,leaseUntil:now+leaseMs};
    this.#m.set(id,next); this.events.push({id,type:'claimed'}); return copy(next);
  }
  async finish(e, token) {
    const old=this.#m.get(e.id); if (old?.state!=='processing' || old.claimToken!==token) throw new Error('CLAIM_LOST');
    this.#m.set(e.id,copy(e)); this.events.push({id:e.id,type:e.state});
  }
  async recover(now) { for (const e of this.#m.values()) if(e.state==='processing' && e.leaseUntil<=now) { e.state='unknown'; e.lastError='worker_lost'; this.events.push({id:e.id,type:'unknown'}); } }
  async resolve(id,state,evidence) {
    if (!['sent','dead'].includes(state)||typeof evidence!=='string'||!evidence.trim()) throw new Error('RECONCILIATION_EVIDENCE_REQUIRED');
    const e=this.#m.get(id);if(e?.state!=='unknown')throw new Error('NOT_UNKNOWN');
    e.state=state;e.reconciliationEvidence=evidence;this.events.push({id,type:'reconciled'});
  }
}
function rollback(stats,state){const k={sent:'sent',unknown:'unknown',dead:'dead',pending:'retried'}[state];if(k&&stats[k]>0)stats[k]--;}
export class DeliveryOutbox {
  #store; #registry; #options; #fetch; #now; #rand; #cfg; #restaurant; #simulation; #breaker=new Map(); #flight=null;
  constructor({store=new MemoryOutboxStore(),registry,restaurantId,simulationOnly=false,providerOptions={},fetchImpl=globalThis.fetch,now=()=>Date.now(),random=Math.random,
    maxAttempts=6,baseDelayMs=2000,maxDelayMs=120000,deadlineMs={accept:240000,reject:240000,ready:1800000,delivered:3600000,cancel:600000},breakerThreshold=5,breakerPauseMs=60000,timeoutMs=10000,leaseMs=30000,batchSize=100,maxTickMs=15000}={}) {
    if(!registry || typeof registry.create!=='function')throw new Error('REGISTRY_REQUIRED');
    if(simulationOnly && (typeof fetchImpl!=='function'||fetchImpl===globalThis.fetch))throw new Error('SIMULATION_FETCH_REQUIRED');
    if(!simulationOnly && (!store.durable || !restaurantId))throw new Error('DURABLE_TENANT_STORE_REQUIRED');
    if(store.restaurantId && store.restaurantId!==restaurantId)throw new Error('TENANT_MISMATCH');
    for(const m of ['insert','claim','finish','recover','resolve','list','get','due'])if(typeof store[m]!=='function')throw new Error('ATOMIC_STORE_REQUIRED');
    if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>500||!Number.isFinite(maxTickMs)||maxTickMs<1)throw new Error('INVALID_BATCH');
    const positiveInteger=v=>Number.isSafeInteger(v)&&v>0;
    if(![maxAttempts,baseDelayMs,maxDelayMs,breakerThreshold,breakerPauseMs,timeoutMs,leaseMs,maxTickMs].every(positiveInteger)
      ||maxAttempts>100||maxDelayMs<baseDelayMs||timeoutMs>300000||leaseMs>3600000||maxTickMs>300000
      ||!deadlineMs||typeof deadlineMs!=='object'||Array.isArray(deadlineMs)
      ||Object.entries(deadlineMs).some(([action,ms])=>!Object.hasOwn(PRECEDENCE,action)||!positiveInteger(ms)||ms>Number.MAX_SAFE_INTEGER-Date.now()))throw new Error('INVALID_QUEUE_LIMITS');
    if(leaseMs<=timeoutMs)throw new Error('INVALID_LEASE');
    this.#store=store;this.#registry=registry;this.#options=providerOptions;this.#fetch=fetchImpl;this.#now=now;this.#rand=random;
    this.#restaurant=restaurantId??'simulation';this.#simulation=simulationOnly;
    this.#cfg={maxAttempts,baseDelayMs,maxDelayMs,deadlineMs,breakerThreshold,breakerPauseMs,timeoutMs,leaseMs,batchSize,maxTickMs};
  }
  static idFor(provider,orderId,action,restaurantId='simulation') { return createHash('sha256').update(JSON.stringify([restaurantId,normalizeProvider(provider),orderId,action])).digest('hex').slice(0,32); }
  async enqueue({provider,orderId,action,payload={}}) {
    if(!Object.hasOwn(PRECEDENCE,action))throw Object.assign(new Error('Unsupported action'),{code:'UNSUPPORTED_ACTION'});
    provider=normalizeProvider(provider);
    if(typeof orderId!=='string'||!orderId.trim()||orderId.length>200)throw new Error('INVALID_ORDER');
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.hasOwn(payload,'orderId'))throw new Error('INVALID_PAYLOAD');
    if (Buffer.byteLength(JSON.stringify(payload)) > 65536) throw new Error("PAYLOAD_TOO_LARGE");
    const id=DeliveryOutbox.idFor(provider,orderId,action,this.#restaurant),t=this.#now();
    const entry={id,restaurantId:this.#restaurant,provider,orderId,action,payload,state:'pending',attempts:0,nextAttemptAt:t,createdAt:t,deadlineAt:t+(this.#cfg.deadlineMs[action]??300000),lastError:null};
    const inserted=await this.#store.insert(entry),existing=await this.#store.get(id);
    if(existing && fingerprint(existing.payload)!==fingerprint(payload))throw new Error('IDEMPOTENCY_CONFLICT');
    return {id,duplicate:!inserted,state:existing?.state??'pending'};
  }
  #delay(n) {const exp=Math.min(this.#cfg.maxDelayMs,this.#cfg.baseDelayMs*2**(n-1));return Math.round(exp/2+this.#rand()*exp/2);}
  tick() {
    if(this.#flight)return this.#flight;
    this.#flight=this.#tick().finally(()=>{this.#flight=null;});return this.#flight;
  }
  async #tick() {
    const started=performance.now();const now=this.#now();await this.#store.recover(now,this.#cfg.batchSize);
    const blocked=[...this.#breaker].filter(([,b])=>b.openUntil>now).map(([p])=>p);
    const candidates=await this.#store.due(now,this.#cfg.batchSize,blocked);
    const stats={sent:0,retried:0,dead:0,expired:0,skipped:0,unknown:0,lost:0};
    for(const candidate of candidates.filter(e=>e.restaurantId===this.#restaurant)) {
      if(performance.now()-started>=this.#cfg.maxTickMs)break;
      const claimNow=this.#now();
      if(candidate.nextAttemptAt>claimNow || (this.#breaker.get(candidate.provider)?.openUntil??0)>claimNow){stats.skipped++;continue;}
      const token=randomUUID(),e=await this.#store.claim(candidate.id,token,claimNow,this.#cfg.leaseMs);
      if(!e){stats.skipped++;continue;}
      if(claimNow>e.deadlineAt){if(await this.#finishSafe({...e,state:'expired',lastError:'deadline_exceeded'},token))stats.expired++;else stats.lost++;continue;}
      const outcome=await this.#attempt(e); const next={...e,attempts:e.attempts+1,lastError:outcome.reason??null};
      if(outcome.state==='sent'){next.state='sent';next.sentAt=this.#now();this.#breaker.delete(e.provider);stats.sent++;}
      else if(outcome.state==='unknown'){next.state='unknown';stats.unknown++;}
      else if(outcome.state==='dead'){next.state='dead';stats.dead++;}
      else {
        const b=this.#breaker.get(e.provider)??{fails:0,openUntil:0};b.fails++;if(b.fails>=this.#cfg.breakerThreshold){b.openUntil=this.#now()+this.#cfg.breakerPauseMs;b.fails=0;}this.#breaker.set(e.provider,b);
        if(next.attempts>=this.#cfg.maxAttempts){next.state='dead';stats.dead++;}
        else{next.state='pending';next.nextAttemptAt=this.#now()+this.#delay(next.attempts);stats.retried++;}
      }
      if(!(await this.#finishSafe(next,token))){stats.lost++;rollback(stats,next.state);}
    }
    return stats;
  }
  // CLAIM_LOST: otro proceso ya recuperó/finalizó la operación (lease vencido). No se reintenta ni se aborta el lote.
  async #finishSafe(entry,token){try{await this.#store.finish(entry,token);return true;}catch(error){if(error?.message==='CLAIM_LOST')return false;throw error;}}
  async #attempt(e) {
    let adapter,req;
    try {
      adapter=this.#registry.create(e.provider,this.#options[e.provider]??{});
      if(adapter.meta?.provisional===true&&!this.#simulation)return {state:'dead',reason:'provider_protocol_unverified'};
      req=adapter.buildOutbound(e.action,{...e.payload,orderId:e.orderId});
    } catch(error){return {state:'dead',reason:`build_failed:${error?.code??'ERR'}`};}
    try {
      // Never forward operational commands to a redirected endpoint. A rejected
      // redirect is uncertain: the original endpoint may have applied the command.
      const res=await this.#fetch(req.url,{redirect:'error',method:req.method,headers:{...req.headers,'idempotency-key':e.id},body:req.body,signal:AbortSignal.timeout(this.#cfg.timeoutMs)});
      if(res.ok)return {state:'sent'};
      // HTTP 409 does not prove acceptance of this command.
      if(res.status===409)return {state:'unknown',reason:'http_409_requires_reconciliation'};
      if(TRANSIENT.has(res.status))return {state:(adapter.meta?.safeRetries===true||this.#simulation)?'retry':'unknown',reason:`http_${res.status}`};
      return {state:'dead',reason:`http_${res.status}`};
    } catch {return {state:'unknown',reason:'network_result_uncertain'};}
  }
  async pending({limit=100,afterId=null}={}){return (await this.#store.list({limit,afterId,states:['pending','processing','dead','expired','unknown']})).filter(e=>e.restaurantId===this.#restaurant);}
  async reconcile(id,state,evidence){const e=await this.#store.get(id);if(e?.restaurantId!==this.#restaurant)throw new Error('TENANT_MISMATCH');await this.#store.resolve(id,state,evidence);}
}
