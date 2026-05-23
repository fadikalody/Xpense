"use client";

import React, { useState } from "react";
import { useBiometricLock } from "./biometric-lock-provider";
import { Button } from "./ui/button";
import { Fingerprint, Shield, ShieldAlert, Loader2 } from "lucide-react";

export function BiometricLockScreen() {
  const { lockState, unlock, isSupported } = useBiometricLock();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [failCount, setFailCount] = useState(0);

  if (lockState !== "locked") return null;

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setAuthFailed(false);
    try {
      const success = await unlock();
      if (!success) {
        setAuthFailed(true);
        setFailCount((c) => c + 1);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.18) 0%, transparent 70%), #030712",
      }}
    >
      {/* Atmospheric glows */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "rgba(139,92,246,0.12)" }}
      />
      <div
        className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full blur-[100px] pointer-events-none"
        style={{ background: "rgba(99,102,241,0.08)" }}
      />

      {/* Main Lock Card */}
      <div
        className="relative flex flex-col items-center gap-8 px-8 py-12 rounded-3xl max-w-sm w-full mx-4"
        style={{
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(139,92,246,0.2)",
          boxShadow: "0 0 60px rgba(139,92,246,0.08), 0 30px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="6" fill="url(#lock-logo-grad)" />
              <path
                d="M7 6L17 18M17 6L7 18"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient
                  id="lock-logo-grad"
                  x1="0"
                  y1="0"
                  x2="24"
                  y2="24"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <span
              className="text-2xl font-bold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #a78bfa, #818cf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Xpense
            </span>
          </div>
          <p className="text-slate-500 text-xs font-medium tracking-widest uppercase">
            Protected by Biometrics
          </p>
        </div>

        {/* Animated Fingerprint / Shield Icon */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing ring */}
          <div
            className="absolute w-32 h-32 rounded-full"
            style={{
              background: authFailed
                ? "radial-gradient(circle, rgba(239,68,68,0.15), transparent)"
                : "radial-gradient(circle, rgba(139,92,246,0.15), transparent)",
              animation: isAuthenticating ? "none" : "pulse-lock 3s ease-in-out infinite",
            }}
          />
          {/* Second ring */}
          <div
            className="absolute w-24 h-24 rounded-full border"
            style={{
              borderColor: authFailed
                ? "rgba(239,68,68,0.3)"
                : "rgba(139,92,246,0.3)",
              animation: isAuthenticating
                ? "spin 1s linear infinite"
                : "pulse-lock 3s ease-in-out infinite 0.5s",
            }}
          />

          {/* Icon */}
          <div
            className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: authFailed
                ? "rgba(239,68,68,0.15)"
                : "rgba(139,92,246,0.15)",
              border: `2px solid ${authFailed ? "rgba(239,68,68,0.4)" : "rgba(139,92,246,0.4)"}`,
              transition: "all 0.3s ease",
            }}
          >
            {isAuthenticating ? (
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: "#a78bfa" }}
              />
            ) : authFailed ? (
              <ShieldAlert className="w-8 h-8" style={{ color: "#f87171" }} />
            ) : (
              <Fingerprint className="w-8 h-8" style={{ color: "#a78bfa" }} />
            )}
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center space-y-1">
          <h2 className="text-white font-semibold text-lg">
            {isAuthenticating
              ? "Verifying..."
              : authFailed
              ? "Authentication Failed"
              : "Unlock Xpense"}
          </h2>
          <p className="text-slate-400 text-sm max-w-[220px] leading-relaxed">
            {isAuthenticating
              ? "Complete the biometric prompt on your device."
              : authFailed
              ? failCount >= 3
                ? "Multiple failed attempts. Please try again."
                : "Biometric not recognized. Try again."
              : isSupported
              ? "Use your fingerprint, Face ID, or Windows Hello to access your financial data."
              : "Biometric authentication is not supported on this device."}
          </p>
        </div>

        {/* CTA Button */}
        {isSupported && (
          <Button
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            className="w-full h-12 font-semibold text-base rounded-xl relative overflow-hidden group"
            style={{
              background: authFailed
                ? "linear-gradient(135deg, #dc2626, #b91c1c)"
                : "linear-gradient(135deg, #7c3aed, #4f46e5)",
              border: "none",
              boxShadow: authFailed
                ? "0 4px 24px rgba(239,68,68,0.3)"
                : "0 4px 24px rgba(139,92,246,0.35)",
              transition: "all 0.3s ease",
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : authFailed ? (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  Try Again
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  Authenticate
                </>
              )}
            </span>
          </Button>
        )}

        {!isSupported && (
          <p className="text-xs text-slate-600 text-center">
            Disable biometric lock in settings to access your data.
          </p>
        )}

        {/* Security Note */}
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Shield className="w-3 h-3 shrink-0" />
          <span>Your data never leaves this device</span>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse-lock {
          0%, 100% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
