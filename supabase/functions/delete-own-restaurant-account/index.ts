import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { deleted: false, message: "Metodo no permitido." });

  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return jsonResponse(401, { deleted: false, message: "Sesion no valida." });

  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { deleted: false, message: "Solicitud no valida." });
  }
  if (payload.confirmation !== "ELIMINAR") {
    return jsonResponse(400, { deleted: false, message: "Falta la confirmacion de eliminacion." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { deleted: false, message: "La funcion no tiene configurados los secretos de Supabase." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  const user = userData?.user;
  if (userError || !user) return jsonResponse(401, { deleted: false, message: "La sesion vencio. Inicia sesion nuevamente." });

  const { data: adminRole } = await admin
    .from("user_roles")
    .select("status")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .eq("status", "active")
    .maybeSingle();
  if (adminRole) {
    return jsonResponse(403, { deleted: false, message: "La cuenta administradora de plataforma no se elimina desde el panel del restaurante." });
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurant_profiles")
    .select("user_id, business_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (restaurantError || !restaurant) {
    return jsonResponse(404, { deleted: false, message: "No existe un restaurante asociado a esta cuenta." });
  }

  const { data: deletionRows, error: deletionError } = await admin.rpc(
    "rc_ordera_finalize_restaurant_deletion",
    { p_user_id: user.id },
  );
  if (deletionError) {
    const technicalMessage = String(deletionError.message || "");
    if (/active orders/i.test(technicalMessage)) {
      return jsonResponse(409, {
        deleted: false,
        message: "El restaurante tiene pedidos activos. Finalizalos o cancelalos antes de cerrar la cuenta.",
      });
    }
    if (/payment settlements/i.test(technicalMessage)) {
      return jsonResponse(409, {
        deleted: false,
        message: "El restaurante tiene liquidaciones de pago pendientes. Completa la conciliacion antes de cerrar la cuenta.",
      });
    }
    return jsonResponse(500, {
      deleted: false,
      message: "No fue posible cerrar el restaurante de forma completa. No se aplicaron cambios parciales.",
    });
  }

  const deletion = Array.isArray(deletionRows) ? deletionRows[0] : deletionRows;
  if (!deletion?.hidden_from_customers) {
    return jsonResponse(500, { deleted: false, message: "Supabase no confirmo el cierre del restaurante." });
  }

  // La cuenta Auth se conserva porque el mismo correo puede tener perfil de cliente
  // o colaborador, y porque pedidos y pagos historicos deben mantener sus relaciones.
  return jsonResponse(200, {
    deleted: true,
    accountPreserved: deletion.account_preserved === true,
    restaurantUserId: deletion.restaurant_user_id,
  });
});
