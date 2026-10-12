/**
 * RC ORDERA protected-route authorization.
 * Client navigation is UX only: database RLS/privileged RPC must enforce access.
 * No cache of permissions, and never trust user_metadata or localStorage roles.
 */
export async function authorizeRoute(supabase, route, options = {}) {
  if (!supabase?.auth?.getUser) throw new TypeError("Supabase Auth client required");
  const { data: userData, error: authError } = await supabase.auth.getUser();
  const user = authError ? null : userData?.user;
  if (!user) return { allowed: false, reason: "login_required", user: null };

  if (route === "customer") return { allowed: true, user, reason: "ok" };
  if (!["restaurant", "station", "courier", "admin"].includes(route)) {
    return { allowed: false, reason: "unknown_route", user };
  }

  const query = supabase.from("user_roles").select("role,scope_type,scope_id,status").eq("user_id",user.id).eq("status","active");
  const { data: roles, error: rolesError } = await query;
  if (rolesError) return { allowed: false, reason: "permissions_unavailable", user };
  const active = Array.isArray(roles) ? roles : [];
  const hasRole = (...names) => active.some(row => names.includes(row.role));
  if (route === "admin") {
    // Admin authorization must also be enforced by rc_ordera_is_platform_admin / RLS.
    const { data, error } = await supabase.rpc("rc_ordera_is_platform_admin", { p_user_id: user.id });
    return { allowed: !error && data === true, reason: error ? "permissions_unavailable" : data === true ? "ok" : "forbidden", user };
  }
  if (route === "courier") return { allowed: hasRole("platform_courier"), reason: hasRole("platform_courier") ? "ok" : "forbidden", user };
  const restaurantId = options.restaurantId;
  if (!restaurantId) return { allowed: false, reason: "restaurant_required", user };

  // Use the existing backend permission check for restaurant and station access.
  const permission = route === "station" ? "view_orders" : "manage_settings";
  const { data, error } = await supabase.rpc("rc_ordera_can_manage_restaurant", {
    p_restaurant_user_id: restaurantId,
    p_permission: permission
  });
  return { allowed: !error && data === true, reason: error ? "permissions_unavailable" : data === true ? "ok" : "forbidden", user };
}

export function protectedNavigation(result, { login = "index.html", forbidden = "index.html" } = {}) {
  if (result.allowed) return null;
  return result.reason === "login_required" ? login : forbidden;
}
