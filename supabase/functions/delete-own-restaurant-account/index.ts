import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Esta relacion usa ON DELETE RESTRICT para quien concedio permisos.
  // Se limpia antes de borrar Auth para que no queden accesos de personal huerfanos.
  const { error: grantedMembershipError } = await admin
    .from("restaurant_staff_memberships")
    .delete()
    .eq("granted_by_user_id", user.id);
  if (grantedMembershipError && grantedMembershipError.code !== "42P01") {
    return jsonResponse(500, { deleted: false, message: "No fue posible retirar los permisos del personal." });
  }

  const { error: restaurantMembershipError } = await admin
    .from("restaurant_staff_memberships")
    .delete()
    .eq("restaurant_user_id", user.id);
  if (restaurantMembershipError && restaurantMembershipError.code !== "42P01") {
    return jsonResponse(500, { deleted: false, message: "No fue posible retirar el equipo del restaurante." });
  }

  // Si la misma cuenta tenia documentos de colaborador, elimina solo su carpeta.
  const { data: files } = await admin.storage.from("courier-documents").list(user.id, { limit: 1000 });
  if (files?.length) {
    const paths = files.map((file) => `${user.id}/${file.name}`);
    const { error: storageError } = await admin.storage.from("courier-documents").remove(paths);
    if (storageError) return jsonResponse(500, { deleted: false, message: "No fue posible eliminar los archivos asociados." });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, false);
  if (deleteError) {
    return jsonResponse(500, { deleted: false, message: "Supabase no pudo eliminar la cuenta. No se confirmo ningun borrado." });
  }

  return jsonResponse(200, { deleted: true });
});

