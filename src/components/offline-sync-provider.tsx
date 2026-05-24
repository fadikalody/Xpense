"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { WifiOff, Wifi, Loader2, CloudLightning } from "lucide-react";
import confetti from "canvas-confetti";

interface OfflineTransaction {
  type: "income" | "expense";
  amount: number;
  merchant_name: string;
  category: string;
  date: string;
  created_at: string;
}

interface OfflineSyncContextType {
  isOnline: boolean;
  queueLength: number;
  queueOfflineTransaction: (tx: Omit<OfflineTransaction, "created_at">) => void;
  /** Register a callback to be called after offline sync completes (instead of hard reload) */
  registerSyncCallback: (fn: (() => void) | null) => void;
}

interface OfflineSyncProviderProps {
  children: React.ReactNode;
  /** Called instead of window.location.reload() after a successful offline sync */
  onSyncComplete?: () => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSync must be used within an OfflineSyncProvider");
  }
  return context;
}

export function OfflineSyncProvider({ children, onSyncComplete }: OfflineSyncProviderProps) {
  const supabase = createClient();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queueLength, setQueueLength] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef(false);
  const [showStatusIndicator, setShowStatusIndicator] = useState<boolean>(false);
  const [indicatorState, setIndicatorState] = useState<"offline" | "online" | "syncing">("online");
  // Holds a page-level callback registered via registerSyncCallback()
  const syncCallbackRef = useRef<(() => void) | null>(onSyncComplete ?? null);

  const registerSyncCallback = useCallback((fn: (() => void) | null) => {
    syncCallbackRef.current = fn;
  }, []);

  // Read queue length on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const queue = JSON.parse(localStorage.getItem("xpense_offline_queue") || "[]");
      setQueueLength(queue.length);
    }
  }, []);

  // Sync function to push localStorage items to Supabase
  const syncOfflineQueue = useCallback(async () => {
    if (isSyncingRef.current) return;

    const queue: OfflineTransaction[] = JSON.parse(
      localStorage.getItem("xpense_offline_queue") || "[]"
    );

    if (queue.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // User is logged out, sync when logged in

    isSyncingRef.current = true;
    setIsSyncing(true);
    setIndicatorState("syncing");
    setShowStatusIndicator(true);

    try {
      // Map to supabase insert format
      const inserts = queue.map((tx) => ({
        user_id: user.id,
        type: tx.type,
        amount: tx.amount,
        merchant_name: tx.merchant_name,
        category: tx.category,
        date: tx.date,
      }));

      const { error } = await supabase.from("transactions").insert(inserts);

      if (error) throw error;

      // Sync complete, clear queue
      localStorage.removeItem("xpense_offline_queue");
      setQueueLength(0);

      // Celebrate!
      confetti({
        particleCount: 50,
        spread: 30,
        colors: ["#34d399", "#22d3ee"],
      });

      setIndicatorState("online");
      // Keep online toast for 3 seconds, then hide
      setTimeout(() => {
        setShowStatusIndicator(false);
      }, 3000);

      // Soft refresh: call registered callback, prop callback, or fall back to full reload
      if (syncCallbackRef.current) {
        syncCallbackRef.current();
      } else {
        window.location.reload();
      }

    } catch (err) {
      console.error("Failed to sync offline transaction queue to Supabase:", err);
      setIndicatorState("offline"); // Remain in offline state warning
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, [supabase]);

  // Handle going online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIndicatorState("syncing");
      setShowStatusIndicator(true);

      // Delay slightly for visual comfort before syncing
      setTimeout(() => {
        syncOfflineQueue();
      }, 1500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIndicatorState("offline");
      setShowStatusIndicator(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check on load
    if (navigator.onLine) {
      syncOfflineQueue();
    } else {
      setIndicatorState("offline");
      setShowStatusIndicator(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  // Add transaction to localStorage queue during downtime
  const queueOfflineTransaction = (tx: Omit<OfflineTransaction, "created_at">) => {
    const queue: OfflineTransaction[] = JSON.parse(
      localStorage.getItem("xpense_offline_queue") || "[]"
    );

    const newTx: OfflineTransaction = {
      ...tx,
      created_at: new Date().toISOString(),
    };

    queue.push(newTx);
    localStorage.setItem("xpense_offline_queue", JSON.stringify(queue));
    setQueueLength(queue.length);

    // Confetti to acknowledge offline saving
    confetti({
      particleCount: 25,
      spread: 20,
      colors: ["#f59e0b"],
    });
  };

  return (
    <OfflineSyncContext.Provider value={{ isOnline, queueLength, queueOfflineTransaction, registerSyncCallback }}>
      {children}

      {/* Elegant sliding status banner */}
      {showStatusIndicator && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          {indicatorState === "offline" && (
            <Badge variant="destructive" className="flex items-center gap-2 p-3 rounded-xl shadow-2xl bg-amber-500/90 text-slate-950 border border-amber-400 font-bold max-w-sm glass">
              <WifiOff className="h-5 w-5 animate-pulse text-slate-950" />
              <div className="text-left leading-normal text-xs text-slate-950">
                Connection Lost! <span className="font-normal block">Transactions will be saved locally in cache.</span>
              </div>
            </Badge>
          )}

          {indicatorState === "syncing" && (
            <Badge className="flex items-center gap-2 p-3 rounded-xl shadow-2xl bg-violet-600/90 text-white border border-violet-500 font-bold max-w-sm glass">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
              <div className="text-left leading-normal text-xs text-slate-100">
                Back Online! <span className="font-normal block">Synchronizing offline queue items to cloud...</span>
              </div>
            </Badge>
          )}

          {indicatorState === "online" && (
            <Badge variant="success" className="flex items-center gap-2 p-3 rounded-xl shadow-2xl bg-emerald-500/90 text-slate-950 border border-emerald-400 font-bold max-w-sm glass">
              <Wifi className="h-5 w-5 text-slate-950" />
              <div className="text-left leading-normal text-xs text-slate-950">
                Synced Successfully! <span className="font-normal block">All offline transactions are now secure in Supabase.</span>
              </div>
            </Badge>
          )}
        </div>
      )}
    </OfflineSyncContext.Provider>
  );
}
