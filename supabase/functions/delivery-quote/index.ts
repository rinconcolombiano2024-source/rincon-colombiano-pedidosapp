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

function finiteCoordinate(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function waypoint(address: string, latitude: number | null, longitude: number | null) {
  if (latitude !== null && longitude !== null) {
    return { location: { latLng: { latitude, longitude } } };
  }
  return { address };
}

function durationSeconds(value: unknown) {
  const match = String(value || "").match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.max(0, Math.round(Number(match[1]))) : 0;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function addressComponent(result: Record<string, unknown>, type: string) {
  const components = Array.isArray(result?.address_components) ? result.address_components : [];
  const match = components.find((entry: Record<string, unknown>) =>
    Array.isArray(entry?.types) && entry.types.includes(type)
  );
  return match || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const routesKey = Deno.env.get("GOOGLE_ROUTES_API_KEY") || "";
  if (!supabaseUrl || !serviceKey || !routesKey) {
    return response(503, { error: "Delivery calculation is not configured" });
  }

  let payload: {
    restaurantUserId?: string;
    destinationAddress?: string;
    destinationCountryCode?: string;
    destinationRegion?: string;
    destinationLat?: number;
    destinationLng?: number;
  } = {};
  try {
    payload = await request.json();
  } catch {
    return response(400, { error: "Invalid request" });
  }

  const restaurantUserId = String(payload.restaurantUserId || "").trim();
  const destinationAddress = String(payload.destinationAddress || "").trim().replace(/\s+/g, " ").slice(0, 500);
  const countryCode = String(payload.destinationCountryCode || "").trim().toUpperCase();
  const destinationRegion = String(payload.destinationRegion || "").trim().slice(0, 160);
  const destinationLat = finiteCoordinate(payload.destinationLat, -90, 90);
  const destinationLng = finiteCoordinate(payload.destinationLng, -180, 180);
  if (!/^[0-9a-f-]{36}$/i.test(restaurantUserId)
      || destinationAddress.length < 5
      || !["PL", "CO"].includes(countryCode)) {
    return response(400, { error: "Restaurant, address, and country are required" });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: userData } = accessToken ? await admin.auth.getUser(accessToken) : { data: { user: null } };
  const customerUserId = userData?.user?.id || null;

  const clientIdentity = [
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    request.headers.get("user-agent") || "unknown",
  ].join("|");
  const quotaResult = await admin.rpc("rc_ordera_consume_delivery_quote_quota", {
    p_client_hash: await sha256(clientIdentity),
    p_hourly_limit: 60,
  });
  if (quotaResult.error) return response(500, { error: "Could not validate delivery quota" });
  if (quotaResult.data !== true) return response(429, { error: "Delivery calculation limit reached" });

  const profileResult = await admin.from("restaurant_profiles")
    .select("user_id,active,deleted_at,public_address,latitude,longitude,country_code,region")
    .eq("user_id", restaurantUserId)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (profileResult.error) return response(500, { error: "Could not read restaurant" });
  const restaurant = profileResult.data;
  if (!restaurant) return response(404, { error: "Restaurant is unavailable" });
  if (String(restaurant.country_code || "").toUpperCase() !== countryCode) {
    return response(409, { error: "Restaurant country does not match delivery country" });
  }

  const originAddress = String(restaurant.public_address || "").trim();
  const originLat = finiteCoordinate(restaurant.latitude, -90, 90);
  const originLng = finiteCoordinate(restaurant.longitude, -180, 180);
  if ((originLat === null || originLng === null) && originAddress.length < 5) {
    return response(409, { error: "Restaurant location is incomplete" });
  }

  const geocodeParams = new URLSearchParams({ key: routesKey, language: countryCode === "PL" ? "pl" : "es" });
  if (destinationLat !== null && destinationLng !== null) {
    geocodeParams.set("latlng", `${destinationLat},${destinationLng}`);
  } else {
    geocodeParams.set("address", destinationAddress);
    geocodeParams.set("components", `country:${countryCode}`);
  }
  const geocodeResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${geocodeParams.toString()}`);
  const geocodeBody = await geocodeResponse.json().catch(() => ({}));
  const geocodeResult = geocodeBody?.results?.[0];
  if (!geocodeResponse.ok || geocodeBody?.status !== "OK" || !geocodeResult) {
    return response(422, { error: "Delivery address could not be verified" });
  }
  const detectedCountry = String(addressComponent(geocodeResult, "country")?.short_name || "").toUpperCase();
  if (detectedCountry !== countryCode) {
    return response(409, { error: "Restaurant country does not match delivery country" });
  }
  const detectedRegion = String(
    addressComponent(geocodeResult, "administrative_area_level_1")?.long_name || destinationRegion,
  ).trim().slice(0, 160);
  const verifiedLat = finiteCoordinate(geocodeResult?.geometry?.location?.lat, -90, 90);
  const verifiedLng = finiteCoordinate(geocodeResult?.geometry?.location?.lng, -180, 180);
  const verifiedAddress = String(geocodeResult?.formatted_address || destinationAddress).trim().slice(0, 500);

  const routeRequest = {
    origin: waypoint(originAddress, originLat, originLng),
    destination: waypoint(verifiedAddress, verifiedLat, verifiedLng),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    languageCode: countryCode === "PL" ? "pl-PL" : "es-CO",
    units: "METRIC",
  };
  const routeResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "X-Goog-Api-Key": routesKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify(routeRequest),
  });
  const routeBody = await routeResponse.json().catch(() => ({}));
  if (!routeResponse.ok) return response(502, { error: "Route provider rejected the request" });

  const route = routeBody?.routes?.[0];
  const distanceMeters = Math.round(Number(route?.distanceMeters) || 0);
  const routeDurationSeconds = durationSeconds(route?.duration);
  if (distanceMeters < 100 || distanceMeters > 200000) {
    return response(422, { error: "No valid delivery route was found" });
  }

  const reference = await sha256(JSON.stringify({
    restaurantUserId,
    destinationAddress: verifiedAddress,
    distanceMeters,
    routeDurationSeconds,
  }));
  const quoteResult = await admin.rpc("rc_ordera_create_delivery_quote", {
    p_restaurant_user_id: restaurantUserId,
    p_customer_user_id: customerUserId,
    p_destination_address: verifiedAddress,
    p_destination_country_code: countryCode,
    p_destination_region: detectedRegion,
    p_destination_lat: verifiedLat,
    p_destination_lng: verifiedLng,
    p_distance_meters: distanceMeters,
    p_duration_seconds: routeDurationSeconds,
    p_provider_reference: reference,
  });
  if (quoteResult.error) {
    const message = String(quoteResult.error.message || "");
    if (/country|region/i.test(message)) return response(409, { error: message });
    return response(500, { error: "Could not save delivery quote" });
  }

  const quote = Array.isArray(quoteResult.data) ? quoteResult.data[0] : quoteResult.data;
  if (!quote?.quote_id || !quote?.quote_token) {
    return response(500, { error: "Delivery quote was not created" });
  }
  return response(200, {
    quoteId: quote.quote_id,
    quoteToken: quote.quote_token,
    distanceKm: Number(quote.distance_km),
    durationSeconds: Number(quote.duration_seconds) || 0,
    finalFee: Number(quote.final_fee),
    currency: quote.currency,
    expiresAt: quote.expires_at,
    feeBreakdown: quote.fee_breakdown || {},
  });
});
