"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { OfflineSyncProvider } from "./offline-sync-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <OfflineSyncProvider>
        {children}
      </OfflineSyncProvider>
    </NextThemesProvider>
  );
}
