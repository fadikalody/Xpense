"use client";

import React from "react";
import { usePushNotifications } from "./push-notification-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Bell, BellOff, BellRing, Loader2, CheckCircle2, XCircle } from "lucide-react";

export function NotificationSettingsCard() {
  const { permission, isSubscribed, isLoading, requestPermission, unsubscribe, sendLocalNotification } =
    usePushNotifications();

  const isGranted = permission === "granted";
  const isDenied = permission === "denied";
  const isUnsupported = permission === "unsupported";

  const handleTestNotification = async () => {
    await sendLocalNotification(
      "🎉 Xpense Notifications Active!",
      "You'll be notified when budgets hit 90% and when your streak is at risk.",
      "/",
      "xpense-test"
    );
  };

  return (
    <Card className="glass border-white/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Bell className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-semibold">
                Push Notifications
              </CardTitle>
              <CardDescription className="text-slate-500 text-xs">
                Budget alerts &amp; streak reminders
              </CardDescription>
            </div>
          </div>

          {/* Status Badge */}
          {isUnsupported ? (
            <Badge className="text-[10px] bg-slate-800/60 text-slate-500 border-slate-700/40 px-2">
              Not Supported
            </Badge>
          ) : isDenied ? (
            <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20 px-2">
              Blocked
            </Badge>
          ) : isGranted && isSubscribed ? (
            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2">
              Active
            </Badge>
          ) : (
            <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20 px-2">
              Off
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Feature list */}
        <div className="space-y-2">
          {[
            { icon: BellRing, text: "Budget hits 90% utilization", active: isGranted && isSubscribed },
            { icon: Bell, text: "3-day expense streak reminder", active: isGranted && isSubscribed },
          ].map(({ icon: Icon, text, active }) => (
            <div key={text} className="flex items-center gap-2.5 text-xs">
              {active ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
              <span className={active ? "text-slate-300" : "text-slate-600"}>{text}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {isUnsupported ? (
          <p className="text-xs text-slate-600">
            Your browser does not support push notifications.
          </p>
        ) : isDenied ? (
          <p className="text-xs text-amber-600">
            Notifications are blocked. Please enable them in your browser settings, then revisit this page.
          </p>
        ) : isGranted && isSubscribed ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-slate-800 text-slate-400 hover:text-white cursor-pointer"
              onClick={handleTestNotification}
            >
              <BellRing className="w-3.5 h-3.5 mr-1.5" />
              Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-red-500/20 text-red-400 hover:text-red-300 hover:border-red-500/40 cursor-pointer"
              onClick={unsubscribe}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <BellOff className="w-3.5 h-3.5 mr-1.5" />
              )}
              Disable
            </Button>
          </div>
        ) : (
          <Button
            variant="gradient"
            size="sm"
            className="w-full text-xs font-semibold cursor-pointer"
            onClick={requestPermission}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Bell className="w-3.5 h-3.5 mr-1.5" />
            )}
            Enable Notifications
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
