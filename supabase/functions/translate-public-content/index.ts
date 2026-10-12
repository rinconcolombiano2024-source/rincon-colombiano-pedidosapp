import { withCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

// Bound actual streamed bytes; Content-Length alone is not trusted.
async function readTranslationPayload(request: Request) {
  const maximumBytes = 8192;
  if (Number(request.headers.get("content-length")) > maximumBytes) throw new Error("BODY_TOO_LARGE");
  if (!request.body) throw new Error("INVALID_BODY");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  const deadline = AbortSignal.timeout(5000);
  const cancel = () => { void reader.cancel().catch(() => {}); };
  deadline.addEventListener("abort", cancel, { once: true });
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (deadline.aborted) throw new Error("BODY_TIMEOUT");
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) { cancel(); throw new Error("BODY_TOO_LARGE"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("INVALID_BODY");
    return payload;
  } finally {
    deadline.removeEventListener("abort", cancel); reader.releaseLock();
  }
}

Deno.serve(withCors(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const translationKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY") || "";
  if (!supabaseUrl || !serviceKey || !translationKey) {
    return response(503, { error: "Translation service is not configured" });
  }

  let payload: { text?: string; targetLanguage?: string; sourceLanguage?: string } = {};
  try {
    payload = await readTranslationPayload(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    return response(reason === "BODY_TOO_LARGE" ? 413 : reason === "BODY_TIMEOUT" ? 408 : 400, { error: "Invalid request" });
  }

  const text = String(payload.text || "").trim().replace(/\s+/g, " ").slice(0, 500);
  const targetLanguage = String(payload.targetLanguage || "").toLowerCase();
  const sourceLanguage = String(payload.sourceLanguage || "").toLowerCase();
  if (!text || !["es", "pl", "en"].includes(targetLanguage)) {
    return response(400, { error: "Invalid translation request" });
  }
  if (sourceLanguage && !["es", "pl", "en"].includes(sourceLanguage)) {
    return response(400, { error: "Invalid source language" });
  }
  if (sourceLanguage && sourceLanguage === targetLanguage) {
    return response(200, { translatedText: text, cached: true });
  }

  const sourceHash = await sha256(text);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const cachedResult = await admin.from("public_content_translations")
    .select("translated_text")
    .eq("source_hash", sourceHash)
    .eq("target_language", targetLanguage)
    .maybeSingle();
  if (cachedResult.error) return response(500, { error: "Could not read translation cache" });
  if (cachedResult.data?.translated_text) {
    return response(200, { translatedText: cachedResult.data.translated_text, cached: true });
  }

  // Las cabeceras de IP son señales no verificadas; no son una frontera de autorización.
  // La defensa real contra el abuso es el tope GLOBAL (v2): la identidad por IP+UA sigue siendo falsificable.
  const clientIdentity = [
    request.headers.get("cf-connecting-ip")?.trim() ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    request.headers.get("user-agent") || "unknown",
  ].join("|");
  const clientHash = await sha256(clientIdentity);
  const intEnv = (name: string, fallback: number) => {
    const n = Number(Deno.env.get(name));
    return Number.isSafeInteger(n) && n > 0 ? n : fallback;
  };
  let quota: string | null = null;
  const v2 = await admin.rpc("rc_ordera_consume_translation_quota_v2", {
    p_client_hash: clientHash,
    p_hourly_limit: 120,
    p_global_hourly_limit: intEnv("RC_TRANSLATE_GLOBAL_HOURLY", 2000),
    p_global_daily_limit: intEnv("RC_TRANSLATE_GLOBAL_DAILY", 10000),
  });
  if (!v2.error) {
    quota = String(v2.data);
  } else if (v2.error.code === "PGRST202" || /does not exist|Could not find the function/i.test(v2.error.message || "")) {
    // Missing migration must not disable the global budget for a paid provider.
    return response(503, { error: "Translation quota migration is required" });
  } else {
    return response(500, { error: "Could not validate translation quota" });
  }
  if (quota === "global_limit") return response(429, { error: "Translation capacity reached" });
  if (quota !== "ok") return response(429, { error: "Translation limit reached" });

  const providerPayload: Record<string, unknown> = {
    q: text,
    target: targetLanguage,
    format: "text",
  };
  if (sourceLanguage) providerPayload.source = sourceLanguage;
  let providerResult: Response;
  try {
    providerResult = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(translationKey)}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(providerPayload),
    },
  );
  } catch {
    return response(502, { error: "Translation provider unavailable" });
  }
  const providerBody = await providerResult.json().catch(() => ({}));
  if (!providerResult.ok) return response(502, { error: "Translation provider rejected the request" });

  const translatedText = String(providerBody?.data?.translations?.[0]?.translatedText || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 1000);
  if (!translatedText) return response(502, { error: "Translation provider returned an empty result" });

  const saveResult = await admin.from("public_content_translations").upsert({
    source_hash: sourceHash,
    target_language: targetLanguage,
    source_text: text,
    translated_text: translatedText,
    provider: "google_cloud_translation",
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_hash,target_language" });
  if (saveResult.error) return response(500, { error: "Could not save translation" });

  return response(200, { translatedText, cached: false });
}));
