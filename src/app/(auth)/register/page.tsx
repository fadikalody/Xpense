"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, UserPlus, Loader2, Info } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError("Password must contain at least one number or special character.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // Check if email confirmation is required
      if (data?.user && data.session === null) {
        setInfo("Registration successful! Please check your email to verify your account before logging in.");
        setIsLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full glass bg-opacity-40 backdrop-blur-md border-white/10 animate-in fade-in zoom-in-95 duration-300">
      <CardHeader>
        <CardTitle className="text-2xl text-white font-bold text-center">Create Account</CardTitle>
        <CardDescription className="text-slate-400 text-center">
          Get started with Xpense today and take control of your money
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          {error && (
            <Badge variant="destructive" className="w-full py-2.5 px-3 rounded-lg flex items-center justify-start gap-2 border-red-500/20 font-medium text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </Badge>
          )}

          {info && (
            <Badge variant="warning" className="w-full py-2.5 px-3 rounded-lg flex items-center justify-start gap-2 border-amber-500/20 font-medium text-xs text-white">
              <Info className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-slate-200">{info}</span>
            </Badge>
          )}

          <div className="space-y-1">
            <Label htmlFor="email" className="text-white">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-500"
              disabled={isLoading || !!info}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-white">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-500"
              disabled={isLoading || !!info}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-500"
              disabled={isLoading || !!info}
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            variant="gradient"
            className="w-full font-semibold shadow-lg text-white"
            disabled={isLoading || !!info}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Sign Up
              </>
            )}
          </Button>

          <div className="text-center text-xs text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Sign in here
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
