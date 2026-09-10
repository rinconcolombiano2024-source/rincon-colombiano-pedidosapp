import { createClient } from "@supabase/supabase-js";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const dispatchSecret = Deno.env.get("DELIVERY_DISPATCH_SECRET") || "";
  const authorization = request.headers.get("authorization") || "";
  const suppliedSecret = request.headers.get("x-rc-ordera-dispatch-secret") || "";
  const authorized =
    (Boolean(serviceRoleKey) && authorization === `Bearer ${serviceRoleKey}`) ||
    (dispatchSecret.length >= 24 && suppliedSecret === dispatchSecret);

  if (!supabaseUrl || !serviceRoleKey || !authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("process_delivery_dispatch_queue", {
    p_limit: 20,
  });

  if (error) {
    console.error(JSON.stringify({
      operation: "delivery_dispatch",
      error_code: error.code || "unknown",
      message: error.message,
      timestamp: new Date().toISOString(),
    }));
    return new Response(JSON.stringify({ error: "Dispatch failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ processed: data ?? 0 }), {
    status: 200,
    headers: jsonHeaders,
  });
});
