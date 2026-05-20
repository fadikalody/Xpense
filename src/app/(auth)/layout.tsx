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
          <div className="relative flex items-center justify-center mb-3">
            <svg className="w-16 h-16 shadow-2xl shadow-indigo-500/20 rounded-2xl" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="url(#logo-grad-auth)" />
              <path d="M7 6L17 18M17 6L7 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="logo-grad-auth" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8b5cf6" />
                  <stop stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:via-indigo-300 dark:to-indigo-100 bg-clip-text text-transparent">
            Xpense
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Smart AI Expense & Budget PWA</p>
        </div>
        
        {children}
      </div>
    </div>
  );
}
