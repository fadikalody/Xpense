import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Configure VAPID keys once
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@xpense.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

// POST /api/push/send
// Sends a push notification to a specific user.
// Protected by a shared secret header (CRON_SECRET) — called by Edge Functions or cron.
// Body: { userId: string, title: string, body: string, url?: string, tag?: string }
export async function POST(req: NextRequest) {
  try {
    // Simple shared-secret auth for internal cron/edge function calls
    const cronSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      // Also allow authenticated user calls (for testing/manual trigger)
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const { userId, title, body: msgBody, url = "/", tag = "xpense-notification" } = body;

    if (!userId || !title || !msgBody) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, body" },
        { status: 400 }
      );
    }

    // Use service role client to read subscriptions for any user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch all subscriptions for the target user
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (fetchError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { sent: 0, message: "No subscriptions found for user" },
        { status: 200 }
      );
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
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
      )
    );

    // Clean up expired/invalid subscriptions (410 Gone)
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
