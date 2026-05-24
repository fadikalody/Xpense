import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Configure VAPID keys safely
let isVapidConfigured = false;
function ensureVapidConfigured() {
  if (isVapidConfigured) return;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@xpense.app";
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  
  if (pubKey && privKey) {
    webpush.setVapidDetails(subject, pubKey, privKey);
    isVapidConfigured = true;
  } else {
    console.warn("VAPID keys not configured — push notifications will not work");
  }
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

// POST /api/push/send
// Called by Supabase Edge Functions / cron (via x-cron-secret) OR authenticated users (own notifications only)
export async function POST(req: NextRequest) {
  try {
    ensureVapidConfigured();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    let authorizedUserId: string | null = null;
    let isCronCall = false;

    // Path 1: Cron / Edge Function — verified by shared secret
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret) {
      if (cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      isCronCall = true;
    }

    // Path 2: Authenticated user — verify JWT, restrict to own userId only
    if (!isCronCall) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "").trim();
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error: authError } = await authClient.auth.getUser(token);
      if (authError || !data?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      authorizedUserId = data.user.id;
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userId, title, body: msgBody, url = "/", tag = "xpense-notification" } = body;

    if (!userId || !title || !msgBody) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body" },
        { status: 400 }
      );
    }

    // Security: non-cron callers can only send to themselves
    if (!isCronCall && authorizedUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role key for reading subscriptions (bypasses RLS safely for server-side)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set — push send aborted");
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all subscriptions for the target user
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (fetchError) {
      console.error("Failed to fetch push subscriptions:", fetchError);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: "No subscriptions found for user" }, { status: 200 });
    }

    const payload: PushPayload = {
      title,
      body: msgBody,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      url,
      tag,
    };

    // Send to all subscriptions (user may have multiple devices)
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
      )
    );

    // Clean up expired/invalid subscriptions (410 Gone / 404 Not Found)
    const expiredEndpoints: string[] = [];
    results.forEach((result, idx) => {
      if (
        result.status === "rejected" &&
        (result.reason?.statusCode === 410 || result.reason?.statusCode === 404)
      ) {
        expiredEndpoints.push(subscriptions[idx].endpoint);
      }
    });

    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .in("endpoint", expiredEndpoints);
    }

    const successCount = results.filter((r) => r.status === "fulfilled").length;

    return NextResponse.json({
      sent: successCount,
      total: subscriptions.length,
      expired: expiredEndpoints.length,
    });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

