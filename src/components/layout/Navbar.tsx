"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationSettingsCard } from "@/components/notification-settings-card";
import { SecuritySettingsCard } from "@/components/security-settings-card";
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
  User,
  Settings,
  Camera,
  ChevronRight,
  Shield,
  Pencil,
  Check,
  Bot,
} from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "User");
        setUserId(user.id);
        // Load stored avatar
        const storedAvatar = localStorage.getItem(`xpense_avatar_${user.id}`);
        if (storedAvatar) setAvatarUrl(storedAvatar);
        // Load stored username — fallback to email prefix
        const storedName = localStorage.getItem(`xpense_username_${user.id}`);
        const defaultName = (user.email || "User").split("@")[0];
        const resolvedName = storedName || defaultName;
        setUsername(resolvedName);
        setNameInput(resolvedName);
      }
    };
    getUser();
  }, [supabase]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close profile dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setProfileOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          localStorage.setItem(`xpense_avatar_${user.id}`, dataUrl);
          setAvatarUrl(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  // ── Username edit handlers ───────────────────────────────────────────────
  const handleStartEdit = () => {
    setNameInput(username);
    setIsEditingName(true);
    // Focus the input on the next render tick
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== username) {
      setUsername(trimmed);
      if (userId) {
        localStorage.setItem(`xpense_username_${userId}`, trimmed);
      }
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setNameInput(username);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSaveName();
    if (e.key === "Escape") handleCancelEdit();
  };

  // Derive initials from username (or email fallback)
  const initials = username
    ? username.charAt(0).toUpperCase()
    : userEmail
    ? userEmail.charAt(0).toUpperCase()
    : "U";

  interface NavLink {
    href: string;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }

  const navLinks: NavLink[] = [
    { href: "/", label: "Dashboard", icon: Compass },
    { href: "/scan", label: "AI Scanner", icon: Sparkles },
    { href: "/history", label: "History", icon: History },
    { href: "/budgets", label: "Budgets", icon: Wallet },
    { href: "/assistant", label: "AI Assistant", icon: Bot, badge: "New" },
  ];

  return (
    <>
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
                    <stop offset="1" stopColor="#6366f1" />
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
            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-amber-400" />
                ) : (
                  <Moon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                )}
              </Button>
            )}

            {/* Profile Avatar + Dropdown */}
            <div className="hidden md:block relative" ref={profileRef}>
              <button
                id="profile-menu-button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
                aria-label="Open profile menu"
                aria-haspopup="true"
                aria-expanded={profileOpen}
              >
                {/* Avatar */}
                <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-violet-500/40 hover:border-violet-400/70 transition-colors shadow-md shadow-violet-500/10">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-sm font-bold select-none">
                      {initials}
                    </div>
                  )}
                </div>
              </button>

              {/* Dropdown Panel */}
              {profileOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+8px)] w-72 rounded-2xl overflow-hidden shadow-2xl shadow-black/40 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                  style={{
                    background: "rgba(15,23,42,0.95)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                  role="menu"
                  aria-labelledby="profile-menu-button"
                >
                  {/* Profile Header */}
                  <div className="px-4 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      {/* Larger avatar with upload */}
                      <div className="relative group">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-violet-500/40 shadow-lg shadow-violet-500/10">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-xl font-bold select-none">
                              {initials}
                            </div>
                          )}
                        </div>
                        {/* Upload overlay */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Change photo"
                        >
                          <Camera className="w-4 h-4 text-white" />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Editable username row */}
                        {isEditingName ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              ref={nameInputRef}
                              id="username-input"
                              type="text"
                              value={nameInput}
                              onChange={(e) => setNameInput(e.target.value)}
                              onKeyDown={handleNameKeyDown}
                              onBlur={handleSaveName}
                              maxLength={32}
                              placeholder="Your name"
                              className="flex-1 min-w-0 bg-white/5 border border-violet-500/40 rounded-md px-2 py-1 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-500/50 transition-all"
                            />
                            <button
                              onMouseDown={(e) => { e.preventDefault(); handleSaveName(); }}
                              className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer shrink-0"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onMouseDown={(e) => { e.preventDefault(); handleCancelEdit(); }}
                              className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/30 transition-colors cursor-pointer shrink-0"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/name">
                            <p className="text-white font-semibold text-sm truncate">{username || "User"}</p>
                            <button
                              onClick={handleStartEdit}
                              className="opacity-0 group-hover/name:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-violet-400 cursor-pointer"
                              title="Edit name"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-slate-400 text-xs truncate mt-0.5">{userEmail}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] text-emerald-400 font-medium">Active session</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    {/* App Settings */}
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setSettingsOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer group"
                      role="menuitem"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                          <Settings className="w-4 h-4 text-violet-400" />
                        </span>
                        <span>App Settings</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </button>

                    {/* Sign Out */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer group"
                      role="menuitem"
                    >
                      <span className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                        <LogOut className="w-4 h-4 text-red-400" />
                      </span>
                      <span>Sign Out</span>
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-slate-600" />
                    <span className="text-[10px] text-slate-600">Data encrypted and secure</span>
                  </div>
                </div>
              )}
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
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between text-base font-medium p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors ${
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

              {/* Mobile Profile Section */}
              <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
                {/* User Info */}
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-violet-500/40 shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white font-bold">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{username || "User"}</p>
                    <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                  </div>
                </div>

                {/* Mobile Settings Button */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer"
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-base font-medium">App Settings</span>
                  <ChevronRight className="h-4 w-4 ml-auto text-slate-600" />
                </button>

                {/* Mobile Sign Out */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-base font-medium">Sign Out</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ── App Settings Slide-over Panel ────────────────────────────────────── */}
      {settingsOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSettingsOpen(false)}
          />

          {/* Slide-over panel */}
          <div
            className="fixed right-0 top-0 h-full z-50 w-full max-w-sm flex flex-col animate-in slide-in-from-right duration-300"
            style={{
              background: "rgba(7,10,24,0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderLeft: "1px solid rgba(139,92,246,0.2)",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <h2 className="text-white font-bold text-lg">App Settings</h2>
                <p className="text-slate-500 text-xs mt-0.5">Notifications &amp; Security</p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <NotificationSettingsCard />
              <SecuritySettingsCard />
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-[11px] text-slate-600">Settings are stored locally on this device</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
