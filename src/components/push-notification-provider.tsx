"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────
interface PushNotificationContextType {
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  /** Trigger an immediate local SW notification for budget alerts */
  sendLocalNotification: (title: string, body: string, url?: string, tag?: string) => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────
const PushNotificationContext = createContext<PushNotificationContextType | undefined>(
  undefined
);

export function usePushNotifications() {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) throw new Error("usePushNotifications must be inside PushNotificationProvider");
  return ctx;
}

// ─── Helper: URL Base64 to Uint8Array (VAPID) ────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Track which budget alerts have already been fired this session to avoid spam
  const firedBudgetAlerts = useRef<Set<string>>(new Set());

  // ── Initialise: check current permission & subscription state ──────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    // Check if already subscribed
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      }).catch(console.error);
    }
  }, []);

  // ── Subscribe helper ───────────────────────────────────────────────────────
  const subscribeToPush = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn("VAPID public key not configured");
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
    });

    // Get auth token to send to the API
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    setIsSubscribed(true);
  }, [supabase]);

  // ── Request permission & subscribe ─────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        await subscribeToPush();
      }
    } finally {
      setIsLoading(false);
    }
  }, [subscribeToPush]);

  // ── Unsubscribe ─────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ endpoint }),
          });
        }
      }
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // ── Local SW notification ──────────────────────────────────────────────────
  const sendLocalNotification = useCallback(
    async (title: string, body: string, url = "/", tag = "xpense-local") => {
      if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        data: { url },
      });
    },
    []
  );

  // ── 3-Day Streak Reminder (client-side check on app open) ──────────────────
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      Notification.permission !== "granted"
    ) return;

    const checkStreakReminder = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch the most recent transaction date
      const { data } = await supabase
        .from("transactions")
        .select("date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1);

      if (!data || data.length === 0) return;

      const lastTxDate = new Date(data[0].date);
      const now = new Date();
      const daysDiff = Math.floor(
        (now.getTime() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only fire if gap >= 3 days and we haven't reminded this session already
      const reminderKey = "streak-reminder";
      if (daysDiff >= 3 && !firedBudgetAlerts.current.has(reminderKey)) {
        firedBudgetAlerts.current.add(reminderKey);
        await sendLocalNotification(
          "🔥 Don't lose your streak!",
          `You haven't logged an expense in ${daysDiff} days. Open Xpense to keep your streak alive!`,
          "/",
          "xpense-streak-reminder"
        );
      }
    };

    // Run after a short delay to let the app settle
    const timer = setTimeout(checkStreakReminder, 3000);
    return () => clearTimeout(timer);
  }, [supabase, sendLocalNotification]);

  return (
    <PushNotificationContext.Provider
      value={{
        permission,
        isSubscribed,
        isLoading,
        requestPermission,
        unsubscribe,
        sendLocalNotification,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}
