"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sun, 
  Moon, 
  LogOut, 
  Menu, 
  X, 
  Compass, 
  History, 
  Wallet, 
  Sparkles,
  Zap
} from "lucide-react";
import Image from "next/image";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "User");
      }
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Compass },
    { href: "/scan", label: "AI Scanner", icon: Sparkles },
    { href: "/history", label: "History", icon: History },
    { href: "/budgets", label: "Budgets", icon: Wallet },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="6" fill="url(#logo-grad)" />
              <path d="M7 6L17 18M17 6L7 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8b5cf6" />
                  <stop stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-200 bg-clip-text text-transparent">
            Xpense
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-slate-900 dark:hover:text-white ${
                  isActive ? "text-violet-600 dark:text-violet-400" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
                {link.badge && (
                  <Badge variant="success" className="px-1.5 py-0 text-[10px] bg-violet-500/20 text-violet-300 border-violet-500/30 animate-pulse-ring">
                    {link.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
            </Button>
          )}

          <div className="hidden md:flex items-center gap-3 pl-2 border-l border-border/40">
            <span className="text-xs font-medium text-slate-550 dark:text-slate-400 max-w-[120px] truncate">
              {userEmail}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-slate-500 dark:text-slate-400 hover:text-red-400 cursor-pointer"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border/40 bg-background/95 backdrop-blur-lg px-4 py-4 animate-in slide-in-from-top-4 duration-300">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between text-base font-medium p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors ${
                    isActive 
                      ? "text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-slate-900/40" 
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span>{link.label}</span>
                  </div>
                  {link.badge && (
                    <Badge variant="success" className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 border-violet-500/30">
                      {link.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}

            <div className="border-t border-border/40 pt-4 mt-2 flex items-center justify-between px-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                Logged in as: {userEmail}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
