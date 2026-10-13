/** SumUp provider callback: provider GET is authoritative, never event JSON.
 * Remains unavailable unless explicit RC_SUMUP_PAYMENTS_ENABLED=1 and secrets.
 * Do not use for multi-merchant Stripe Connect disbursements.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { inspectSumUpWebhook,parseSumUpWebhookEvent } from "../_shared/sumup-webhook.ts";
import { validateSumUpConfig } from "../_shared/sumup-hosted.ts";
import { withCors } from "../_shared/cors.ts";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const answer=(status:number)=>new Response(null,{status,headers:{"cache-control":"no-store"}});
Deno.serve(withCors(async(req:Request)=>{
 if(req.method!=="POST")return answer(405);
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const merchantCode=Deno.env.get("SUMUP_MERCHANT_CODE")||"";
 const apiKey=Deno.env.get("SUMUP_API_KEY")||"";
 const appOrigin=Deno.env.get("APP_BASE_URL")||"";
 const restaurantId=Deno.env.get("RC_SUMUP_RESTAURANT_USER_ID")||"";
 if(Deno.env.get("RC_SUMUP_PAYMENTS_ENABLED")!=="1" || !url || !key || !apiKey ||
  !merchantCode || !appOrigin || !UUID.test(restaurantId))return answer(503);
 try {validateSumUpConfig({apiKey,merchantCode,appOrigin});} catch {return answer(503);}
 if(Number(req.headers.get("content-length")||0)>4096)return answer(413);
 let raw:unknown;
 try {
   if(!req.body)return answer(400);
   const reader=req.body.getReader();let size=0;const chunks:Uint8Array[]=[];
   try {while(true){const {done,value}=await reader.read();if(done)break;
     size+=value?.byteLength||0;if(size>4096){await reader.cancel();return answer(413);}
     if(value)chunks.push(value);
   }}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   raw=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return answer(400);}
 let event;
 try {event=parseSumUpWebhookEvent(raw);}
 catch{return answer(400);}
 if(!event)return answer(204);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const record=await admin.from("rc_sumup_payment_attempts")
   .select("checkout_id,order_id,restaurant_user_id,merchant_code,attempt_number,amount_minor,currency,status")
   .eq("checkout_id",event.checkoutId).maybeSingle();
 if(record.error)return answer(503);
 const row=record.data;
 if(!row)return answer(204);
 if(row.restaurant_user_id!==restaurantId || row.merchant_code!==merchantCode ||
    row.currency!=="PLN")return answer(503);
 // Paid is a committed ledger state, not a claim from the incoming event.
 // Replayed callbacks need no provider GET or database mutation.
 if(row.status==="paid")return answer(204);
 try {
   const inspected=await inspectSumUpWebhook(
     raw,
     async(id:string)=>id===row.checkout_id?{
       checkoutId:row.checkout_id,
       attempt:{orderId:row.order_id,attemptNumber:row.attempt_number,
         amountMinor:Number(row.amount_minor),currency:"PLN" as const}
     }:null,
     {apiKey,merchantCode,appOrigin},
   );
   if(inspected.kind!=="verified_only")return answer(204);
   const saved=await admin.rpc("rc_sumup_apply_verified_checkout",{
     p_checkout_id:inspected.checkoutId,p_provider_status:inspected.providerStatus
   });
   if(saved.error || !saved.data)return answer(503);
   return answer(204);
 }catch(error){
   console.error("SUMUP_WEBHOOK_RECONCILIATION_FAILED",String((error as Error)?.message||"ERROR"));
   return answer(503);
 }
}));
