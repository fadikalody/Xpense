import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push VAPID sender for Deno
// Uses the web-push protocol directly via fetch (no npm package needed in Deno)

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@xpense.app";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Simple base64url encode/decode for Deno
function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(b64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

// Generate VAPID JWT for Authorization header
async function generateVapidAuthHeader(endpoint: string): Promise<string> {
  const urlObj = new URL(endpoint);
  const audience = `${urlObj.protocol}//${urlObj.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600; // 12 hours

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: expiry, sub: VAPID_SUBJECT };

  const encodedHeader = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Import VAPID private key (EC P-256)
  const privateKeyData = base64ToUint8Array(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privateKeyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signingInput}.${encodedSignature}`;

  return `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;
}

// Send a push notification to a single subscription
async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object
): Promise<{ ok: boolean; status?: number }> {
  const authHeader = await generateVapidAuthHeader(endpoint);

  // Encrypt the payload using the Web Push encryption spec (RFC 8291)
  // For simplicity in the Edge Function, we send an unencrypted JSON body
  // In production, use a full RFC 8291 implementation
  const body = JSON.stringify(payload);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      TTL: "86400",
    },
    body,
  });

  return { ok: resp.ok, status: resp.status };
}

serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find users who haven't logged a transaction in the last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Get all users with push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth");

    if (subError || !subscriptions) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500 }
      );
    }

    const results = [];

    for (const sub of subscriptions) {
      // Check last transaction for this user
      const { data: lastTx } = await supabase
        .from("transactions")
        .select("date")
        .eq("user_id", sub.user_id)
        .order("date", { ascending: false })
        .limit(1);

      let shouldNotify = false;
      let daysSinceLast = 0;

      if (!lastTx || lastTx.length === 0) {
        // Never logged — notify after 3 days of account existence (skip for now)
        continue;
      }

      const lastDate = new Date(lastTx[0].date);
      daysSinceLast = Math.floor(
        (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLast >= 3) {
        shouldNotify = true;
      }

      if (shouldNotify) {
        const result = await sendPush(
          sub.endpoint,
          sub.p256dh,
          sub.auth,
          {
            title: "🔥 Don't lose your Xpense streak!",
            body: `It's been ${daysSinceLast} days since your last log. Open the app to keep your streak alive!`,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            url: "/",
            tag: "xpense-streak-reminder",
          }
        );

        results.push({
          user_id: sub.user_id,
          daysSinceLast,
          sent: result.ok,
          status: result.status,
        });

        // Clean up expired subscriptions
        if (result.status === 410 || result.status === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", sub.user_id)
            .eq("endpoint", sub.endpoint);
        }
      }
    }

    return new Response(
      JSON.stringify({ processed: subscriptions.length, notified: results }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
});
