"use client";

import React, { useState } from "react";
import { useBiometricLock } from "./biometric-lock-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Fingerprint,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export function SecuritySettingsCard() {
  const { isSupported, isEnabled, isLocked, enableLock, disableLock, lock } = useBiometricLock();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<"success" | "failure" | null>(null);

  const handleEnable = async () => {
    setIsProcessing(true);
    setLastResult(null);
    const success = await enableLock();
    setLastResult(success ? "success" : "failure");
    setIsProcessing(false);
  };

  const handleDisable = async () => {
    setIsProcessing(true);
    await disableLock();
    setLastResult(null);
    setIsProcessing(false);
  };

  const handleLockNow = () => {
    lock();
  };

  return (
    <Card className="glass border-white/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <Fingerprint className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base text-slate-900 dark:text-white font-semibold">
                Biometric Lock
              </CardTitle>
              <CardDescription className="text-slate-500 text-xs">
                WebAuthn device authentication
              </CardDescription>
            </div>
          </div>

          {/* Status Badge */}
          {!isSupported ? (
            <Badge className="text-[10px] bg-slate-800/60 text-slate-500 border-slate-700/40 px-2">
              Not Supported
            </Badge>
          ) : isEnabled ? (
            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2">
              Enabled
            </Badge>
          ) : (
            <Badge className="text-[10px] bg-slate-800/60 text-slate-400 border-slate-700/40 px-2">
              Disabled
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Feature list */}
        <div className="space-y-2">
          {[
            { text: "Touch ID / Face ID / Windows Hello", active: isEnabled },
            { text: "Gate app on every launch", active: isEnabled },
            { text: "No data stored on servers", active: isSupported },
          ].map(({ text, active }) => (
            <div key={text} className="flex items-center gap-2.5 text-xs">
              {active ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
              )}
              <span className={active ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"}>{text}</span>
            </div>
          ))}
        </div>

        {/* Registration feedback */}
        {lastResult === "failure" && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
            Registration cancelled or your device doesn&apos;t have biometrics enrolled. Please set up
            fingerprint/Face ID in your OS settings first.
          </p>
        )}
        {lastResult === "success" && (
          <p className="text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20">
            Biometric lock enabled! The app will require authentication on next launch.
          </p>
        )}

        {/* Actions */}
        {!isSupported ? (
          <p className="text-xs text-slate-600">
            WebAuthn is not supported on this browser. Try Chrome or Safari on a device with biometrics.
          </p>
        ) : isEnabled ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-slate-800 text-slate-400 hover:text-white cursor-pointer"
              onClick={handleLockNow}
              disabled={isLocked}
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Lock Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-red-500/20 text-red-400 hover:text-red-300 hover:border-red-500/40 cursor-pointer"
              onClick={handleDisable}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <ShieldOff className="w-3.5 h-3.5 mr-1.5" />
              )}
              Disable
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 cursor-pointer"
            onClick={handleEnable}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            )}
            Enable Biometric Lock
          </Button>
        )}

        {/* Current state indicator */}
        {isEnabled && (
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            {isLocked ? (
              <>
                <Lock className="w-3 h-3 shrink-0 text-amber-500" />
                <span className="text-amber-500/70">App is currently locked</span>
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3 shrink-0" />
                <span>Session unlocked via biometrics</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
