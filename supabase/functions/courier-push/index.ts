import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

type NotificationRecord = {
  id: string;
  recipient_user_id: string;
  notification_type: string;
  title: string;
  body: string;
  reference_id: string | null;
  payload: Record<string, unknown> | null;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: NotificationRecord;
};

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const webhookSecret = Deno.env.get("COURIER_PUSH_WEBHOOK_SECRET") || "";
  const authorization = request.headers.get("authorization") || "";
  const suppliedWebhookSecret = request.headers.get("x-rc-ordera-webhook-secret") || "";
  const authorized = authorization === `Bearer ${serviceRoleKey}`
    || (webhookSecret.length >= 24 && suppliedWebhookSecret === webhookSecret);

  if (!supabaseUrl || !serviceRoleKey || !authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
  }

  const payload = await request.json() as WebhookPayload;
  const record = payload.record;
  if (!record || payload.table !== "notifications" || record.notification_type !== "courier_assigned") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: jsonHeaders });
  }

  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "";
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "VAPID secrets are missing" }), { status: 500, headers: jsonHeaders });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!record.reference_id) {
    return new Response(JSON.stringify({ skipped: true, reason: "missing_assignment" }), { status: 200, headers: jsonHeaders });
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("delivery_assignments")
    .select("id, courier_user_id, status, offer_expires_at")
    .eq("id", record.reference_id)
    .maybeSingle();

  if (assignmentError) {
    return new Response(JSON.stringify({ error: "Could not validate assignment", code: assignmentError.code }), { status: 500, headers: jsonHeaders });
  }

  const offerExpiresAt = new Date(assignment?.offer_expires_at || 0).getTime();
  const validOffer = assignment
    && assignment.courier_user_id === record.recipient_user_id
    && assignment.status === "offered"
    && Number.isFinite(offerExpiresAt)
    && offerExpiresAt > Date.now();
  if (!validOffer) {
    return new Response(JSON.stringify({ skipped: true, reason: "inactive_assignment" }), { status: 200, headers: jsonHeaders });
  }

  const { data: subscriptions, error } = await supabase
    .from("courier_push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", record.recipient_user_id)
    .eq("active", true);

  if (error) {
    return new Response(JSON.stringify({ error: "Could not load subscriptions", code: error.code }), { status: 500, headers: jsonHeaders });
  }

  const pushPayload = JSON.stringify({
    title: record.title || "Nuevo domicilio - RC ORDERA",
    body: record.body || "Hay un nuevo pedido disponible.",
    tag: record.reference_id ? `rc-ordera-${record.reference_id}` : "rc-ordera-delivery",
    assignment_id: record.reference_id || "",
    url: String(
      record.payload?.url
      || `./colaborador.html?view=offers&assignment=${encodeURIComponent(record.reference_id || "")}&app=v84.1`
    ),
  });

  let sent = 0;
  let deactivated = 0;
  for (const subscription of subscriptions || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
        },
        pushPayload
      );
      sent += 1;
    } catch (pushError) {
      const statusCode = Number((pushError as { statusCode?: number }).statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("courier_push_subscriptions")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
        deactivated += 1;
      }
    }
  }

  return new Response(JSON.stringify({ sent, deactivated }), { status: 200, headers: jsonHeaders });
});
