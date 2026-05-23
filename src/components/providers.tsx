"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { OfflineSyncProvider } from "./offline-sync-provider";
import { PushNotificationProvider } from "./push-notification-provider";
import { BiometricLockProvider } from "./biometric-lock-provider";
import { BiometricLockScreen } from "./biometric-lock-screen";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {/* Biometric lock gates everything — rendered first (outermost) */}
      <BiometricLockProvider>
        <BiometricLockScreen />
        <PushNotificationProvider>
          <OfflineSyncProvider>
            {children}
          </OfflineSyncProvider>
        </PushNotificationProvider>
      </BiometricLockProvider>
    </NextThemesProvider>
  );
}
