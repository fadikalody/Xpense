import React from "react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 md:p-6 overflow-hidden">
      {/* Background ambient glowing circles */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
      
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 animate-in slide-in-from-top-4 duration-500">
          <div className="relative w-16 h-16 mb-3 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shadow-indigo-500/20">
            <Image
              src="/icons/icon-512.png"
              alt="Xpense Logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-gradient-to-r from-violet-400 via-indigo-300 to-indigo-100 bg-clip-text text-transparent">
            Xpense
          </h1>
          <p className="text-sm text-slate-400 mt-1">Smart AI Expense & Budget PWA</p>
        </div>
        
        {children}
      </div>
    </div>
  );
}
