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

Deno.serve(async (request) => {
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
    payload = await request.json();
  } catch {
    return response(400, { error: "Invalid request" });
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

  const clientIdentity = [
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    request.headers.get("user-agent") || "unknown",
  ].join("|");
  const quotaResult = await admin.rpc("rc_ordera_consume_translation_quota", {
    p_client_hash: await sha256(clientIdentity),
    p_hourly_limit: 120,
  });
  if (quotaResult.error) return response(500, { error: "Could not validate translation quota" });
  if (quotaResult.data !== true) return response(429, { error: "Translation limit reached" });

  const providerPayload: Record<string, unknown> = {
    q: text,
    target: targetLanguage,
    format: "text",
  };
  if (sourceLanguage) providerPayload.source = sourceLanguage;
  const providerResult = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(translationKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(providerPayload),
    },
  );
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
});
