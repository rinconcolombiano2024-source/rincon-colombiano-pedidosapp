import {isTrustedSumUpHostedUrl} from './sumup-hosted.ts';
type Order = {id:string;user_id:string;payment_provider?:string;order_type?:string;tip_amount?:number;final_delivery_fee?:number};
/** Called only after marketplace-checkout has authenticated order ownership. */
export async function routeSumUpCheckout(order:Order,publicToken:string,authorization:string,
 env:(name:string)=>string|undefined,readSettings:()=>Promise<{data:any;error:any}>,fetchImpl:typeof fetch=fetch):Promise<Response|null>{
 const reply=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 const provider=String(order.payment_provider||'').trim().toLowerCase();
 // Existing Stripe reservations always remain in Stripe, even after a settings change.
 if(provider && provider!=='sumup')return null;
 const enabled=env('RC_SUMUP_PAYMENTS_ENABLED')==='1';
 const whitelisted=order.user_id===env('RC_SUMUP_RESTAURANT_USER_ID');
 if(provider==='sumup'&&(!enabled||!whitelisted))return reply(503,'SUMUP_NOT_CONFIGURED');
 if(!enabled||!whitelisted)return null;
 const settings=await readSettings();
 if(settings.error)return reply(503,'PAYMENT_PROVIDER_LOOKUP_FAILED');
 if(settings.data?.settings?.onlinePaymentProvider!=='sumup'){
  return provider==='sumup'?reply(409,'SUMUP_RECONCILIATION_REQUIRED'):null;
 }
 // This initial integration does not implement delivery/tip beneficiary payouts.
 if(!['Comer en el punto','Recoger en el punto'].includes(order.order_type||'') ||
    Number(order.tip_amount||0)!==0 || Number(order.final_delivery_fee||0)!==0)
   return reply(409,'SUMUP_ORDER_TYPE_UNSUPPORTED');
 const backend=env('SUPABASE_URL')||'';
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(backend))return reply(503,'SUMUP_NOT_CONFIGURED');
 try{
  const result=await fetchImpl(backend.replace(/\/$/,'')+'/functions/v1/sumup-checkout',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{'content-type':'application/json',...(authorization?{authorization}:{})},
   body:JSON.stringify({orderId:order.id,publicToken}),
  });
  if(!result.ok)return reply(result.status>=500?503:409,'SUMUP_CHECKOUT_UNAVAILABLE');
  const body=await result.json();
  if(!isTrustedSumUpHostedUrl(body?.url))return reply(503,'SUMUP_CHECKOUT_UNVERIFIED');
  return new Response(JSON.stringify({url:body.url,provider:'sumup'}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
 }catch{return reply(503,'SUMUP_CHECKOUT_UNAVAILABLE');}
}
