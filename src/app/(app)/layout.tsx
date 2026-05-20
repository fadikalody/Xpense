import React from "react";
import { Navbar } from "@/components/layout/Navbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Dynamic atmospheric radial glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-violet-600/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />

      {/* Shared sticky header */}
      <Navbar />

      {/* Content wrapper */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 md:py-8 z-10 animate-in fade-in duration-300">
        {children}
      </main>
    </div>
  );
}
