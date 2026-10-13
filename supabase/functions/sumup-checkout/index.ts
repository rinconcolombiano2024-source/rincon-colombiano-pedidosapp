/** RC ORDERA — SumUp single restaurant, explicitly disabled until configured.
 * Never accepts price, merchant or return URL from the browser.
 * Stripe Connect remains unchanged for the marketplace.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { withCors } from "../_shared/cors.ts";
import { createSumUpHostedCheckout, isTrustedSumUpHostedUrl, validateSumUpConfig } from "../_shared/sumup-hosted.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JSON_HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const response = (code:number, body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{status:code,headers:JSON_HEADERS});
const disabled = () => response(503,{error:"SUMUP_NOT_CONFIGURED"});
async function smallJson(request:Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length>4096 || !request.body) throw new Error("INVALID_BODY");
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true) {
      const {value,done}=await reader.read();if(done)break;
      size+=value?.byteLength||0;
      if(size>4096) { await reader.cancel();throw new Error("BODY_TOO_LARGE"); }
      if(value)chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let index=0;
  for(const chunk of chunks){bytes.set(chunk,index);index+=chunk.length;}
  const payload=JSON.parse(new TextDecoder().decode(bytes));
  if(!payload || typeof payload!=="object" || Array.isArray(payload))throw new Error("INVALID_BODY");
  return payload as Record<string,unknown>;
}
Deno.serve(withCors(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{
    "access-control-allow-methods":"POST, OPTIONS",
    "access-control-allow-headers":"authorization, apikey, content-type, x-client-info",
  }});
  if(request.method!=="POST")return response(405,{error:"METHOD_NOT_ALLOWED"});
  const url=Deno.env.get("SUPABASE_URL")||"";
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const apiKey=Deno.env.get("SUMUP_API_KEY")||"";
  const merchantCode=Deno.env.get("SUMUP_MERCHANT_CODE")||"";
  const restaurantId=Deno.env.get("RC_SUMUP_RESTAURANT_USER_ID")||"";
  const appOrigin=Deno.env.get("APP_BASE_URL")||"";
  if(Deno.env.get("RC_SUMUP_PAYMENTS_ENABLED")!=="1" || !url || !key || !apiKey ||
     !merchantCode || !UUID.test(restaurantId) || !appOrigin)return disabled();
  let backendUrl:URL;
  try {backendUrl=new URL(url);} catch {return disabled();}
  if(backendUrl.protocol!=="https:" || !/^[a-z0-9]{20}\.supabase\.co$/.test(backendUrl.hostname) ||
     backendUrl.pathname!=="/" || backendUrl.username || backendUrl.password)return disabled();
  const providerConfig={apiKey,merchantCode,appOrigin,
    webhookUrl:backendUrl.origin+"/functions/v1/sumup-webhook"};
  // Reject configuration errors before any order lookup or immutable reservation.
  try {validateSumUpConfig(providerConfig);} catch {return disabled();}
  let body:Record<string,unknown>;
  try{body=await smallJson(request);}catch{return response(400,{error:"INVALID_REQUEST"});}
  const orderId=typeof body.orderId==="string"?body.orderId.trim():"";
  const publicToken=typeof body.publicToken==="string"?body.publicToken.trim():"";
  if(!UUID.test(orderId) || publicToken.length>512)return response(400,{error:"ORDER_INVALID"});
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const result=await admin.from("customer_orders")
    .select("id,user_id,customer_user_id,status,payment_status,payment_method,payment_provider,currency")
    .eq("id",orderId).maybeSingle();
  if(result.error)return response(503,{error:"ORDER_LOOKUP_FAILED"});
  const order=result.data;
  if(!order || order.user_id!==restaurantId)return response(404,{error:"ORDER_NOT_FOUND"});
  const bearer=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  let authenticated=false;
  if(bearer.length>0 && bearer.length<8192){
    const session=await admin.auth.getUser(bearer);
    authenticated=Boolean(session.data?.user?.id && session.data.user.id===order.customer_user_id);
  }
  let tokenValid=false;
  if(!authenticated && publicToken.length>=8){
    const proof=await admin.rpc("rc_ordera_customer_token_matches",{
      p_order_id:orderId,p_public_token:publicToken
    });
    if(proof.error)return response(503,{error:"ACCESS_CHECK_UNAVAILABLE"});
    tokenValid=proof.data===true;
  }
  if(!authenticated && !tokenValid)return response(403,{error:"NOT_AUTHORIZED"});
  // A previous or uncertain Stripe attempt must not silently switch PSP.
  const existingProvider=String(order.payment_provider||"").trim().toLowerCase();
  if(existingProvider && existingProvider!=="sumup")
    return response(409,{error:"ORDER_RESERVED_FOR_OTHER_PAYMENT_PROVIDER"});
  if(order.status!=="pending" || String(order.payment_method).toLowerCase()!=="online" ||
      !["pending","failed",""].includes(String(order.payment_status).toLowerCase()) ||
      String(order.currency).toUpperCase()!=="PLN")
    return response(409,{error:"ORDER_NOT_PAYABLE"});
  // Database transaction locks the order and creates exactly one attempt.
  // It checks the restaurant's persisted SumUp opt-in and server-calculated cents.
  const reserved=await admin.rpc("rc_sumup_reserve_checkout",{
    p_order_id:orderId,p_restaurant_user_id:restaurantId,p_merchant_code:merchantCode
  });
  if(reserved.error || !reserved.data || typeof reserved.data!=="object")
    return response(503,{error:"SUMUP_RESERVATION_UNAVAILABLE"});
  const attempt=reserved.data as Record<string,unknown>;
  if(attempt.creationAllowed!==true){
    if(attempt.status==="pending" && isTrustedSumUpHostedUrl(attempt.url))
      return response(200,{url:attempt.url,checkoutId:attempt.checkoutId,reused:true});
    return response(409,{error:"SUMUP_RECONCILIATION_REQUIRED"});
  }
  // No automatic POST retry: a lost response may have created a checkout.
  let checkout;
  try {
    checkout=await createSumUpHostedCheckout(providerConfig,{
      orderId,attemptNumber:Number(attempt.attemptNumber),
      amountMinor:Number(attempt.amountMinor),currency:"PLN"
    });
  } catch(error) {
    console.error("SUMUP_CREATE_UNCERTAIN",String((error as Error)?.message||"UNAVAILABLE"));
    return response(503,{error:"SUMUP_CREATE_UNCERTAIN_REVIEW_REQUIRED"});
  }
  const committed=await admin.rpc("rc_sumup_commit_checkout",{
    p_attempt_id:attempt.attemptId,p_checkout_id:checkout.id,p_hosted_url:checkout.hostedUrl
  });
  if(committed.error || committed.data!==true)
    return response(503,{error:"SUMUP_CHECKOUT_NEEDS_RECONCILIATION"});
  return response(200,{url:checkout.hostedUrl,checkoutId:checkout.id,reused:false});
}));
