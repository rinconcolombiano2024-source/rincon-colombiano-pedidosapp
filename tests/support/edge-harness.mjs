import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {withCors} from '../../supabase/functions/_shared/cors.ts';
/** Executes actual handler code with injected service clients. Does not emulate Deno deployment. */
export function edgeHarness(path,{env={},createClient}={}){
 let handler;const source=stripTypeScriptTypes(readFileSync(path,'utf8').replace(/^import .*?;\s*$/mg,''));
 const context=vm.createContext({Deno:{env:{get:k=>env[k]},serve:h=>handler=h},createClient,withCors:h=>withCors(h,k=>env[k]),
  Request,Response,Headers,URL,TextEncoder,TextDecoder,crypto:webcrypto,console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,AbortSignal,
  fetch:()=>{throw new Error('REAL_NETWORK_FORBIDDEN');}});
 vm.runInContext(source,context);if(!handler)throw new Error('Handler not registered');return handler;
}
