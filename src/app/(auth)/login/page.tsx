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
import { ShieldAlert, LogIn, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full glass bg-opacity-40 backdrop-blur-md border-white/10 animate-in fade-in zoom-in-95 duration-300">
      <CardHeader>
        <CardTitle className="text-2xl text-white font-bold text-center">Welcome Back</CardTitle>
        <CardDescription className="text-slate-400 text-center">
          Enter your credentials to access your financial dashboard
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {error && (
            <Badge variant="destructive" className="w-full py-2.5 px-3 rounded-lg flex items-center justify-start gap-2 border-red-500/20 font-medium text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
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
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-white">Password</Label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-500"
              disabled={isLoading}
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            variant="gradient"
            className="w-full font-semibold shadow-lg text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>

          <div className="text-center text-xs text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium transition-colors"
            >
              Sign up now
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
