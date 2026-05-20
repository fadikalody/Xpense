"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Wallet, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Plus, 
  IndianRupee, 
  Sparkles,
  TrendingDown,
  Check
} from "lucide-react";
import confetti from "canvas-confetti";

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  merchant_name: string;
  category: string;
  date: string;
}

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  month_year: string;
}

const CATEGORY_COLORS: { [key: string]: string } = {
  Food: "#a78bfa",        // Purple
  Transport: "#60a5fa",   // Blue
  Medical: "#f87171",     // Red
  Education: "#facc15",   // Yellow
  Shopping: "#f472b6",    // Pink
  Entertainment: "#38bdf8", // Sky Blue
  Utilities: "#fb923c",   // Orange
  Other: "#94a3b8",       // Slate
};

export default function BudgetsPage() {
  const supabase = createClient();

  // Core Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Budget Form State
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Constants
  const currentMonthYear = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const currentMonthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  // Fetch Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (txError) throw txError;

      // 2. Fetch budgets
      const { data: bgData, error: bgError } = await supabase
        .from("budgets")
        .select("*")
        .eq("user_id", user.id);

      if (bgError) throw bgError;

      const formattedTx: Transaction[] = (txData || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount.toString()),
        merchant_name: t.merchant_name,
        category: t.category,
        date: t.date,
      }));

      const formattedBg: Budget[] = (bgData || []).map((b: any) => ({
        id: b.id,
        category: b.category,
        monthly_limit: parseFloat(b.monthly_limit.toString()),
        month_year: b.month_year,
      }));

      setTransactions(formattedTx);
      setBudgets(formattedBg);

    } catch (err: any) {
      console.error("Error loading budgets data:", err);
      setError(err.message || "Failed to retrieve budgets or expenditures data.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Spending Calculation Helper
  const getCategorySpendThisMonth = (category: string) => {
    return transactions
      .filter((tx) => 
        tx.type === "expense" && 
        tx.category === category &&
        tx.date.substring(0, 7) === currentMonthYear
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  // Handle saving/upserting a budget limit
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetLimit) return;

    const limitNum = parseFloat(budgetLimit);
    if (isNaN(limitNum) || limitNum < 0) return;

    setIsSavingBudget(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Auth session expired.");

      const monthYearStart = `${currentMonthYear}-01`;

      const { error: upsertErr } = await supabase
        .from("budgets")
        .upsert(
          {
            user_id: user.id,
            category: budgetCategory,
            monthly_limit: limitNum,
            month_year: monthYearStart,
          },
          { onConflict: "user_id,category,month_year" }
        );

      if (upsertErr) throw upsertErr;

      confetti({
        particleCount: 50,
        spread: 45,
        origin: { y: 0.6 },
        colors: ["#a78bfa", "#818cf8", "#10b981"],
      });

      setBudgetLimit("");
      fetchData();

    } catch (err: any) {
      console.error(err);
      alert(`Error setting budget: ${err.message}`);
    } finally {
      setIsSavingBudget(false);
    }
  };

  // Handle deleting a budget limit
  const handleDeleteBudget = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category budget limit?")) return;

    try {
      const { error: deleteErr } = await supabase
        .from("budgets")
        .delete()
        .eq("id", id);

      if (deleteErr) throw deleteErr;

      // Update state locally
      setBudgets(budgets.filter((b) => b.id !== id));
      
      confetti({
        particleCount: 15,
        spread: 20,
        colors: ["#ef4444", "#f87171"],
      });
    } catch (err: any) {
      console.error(err);
      alert(`Delete budget failed: ${err.message}`);
    }
  };

  // Calculations for aggregate Total Budget card
  const totalLimit = budgets.reduce((sum, b) => sum + b.monthly_limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + getCategorySpendThisMonth(b.category), 0);
  const totalPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const isTotalOver = totalSpent > totalLimit;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
          Category Budgets <Wallet className="h-6 w-6 text-violet-400" />
        </h1>
        <p className="text-slate-400 text-sm">
          Set, track, and manage your monthly spending constraints in Indian Rupees (₹)
        </p>
      </div>

      {error && (
        <Badge variant="destructive" className="w-full py-2.5 px-3 rounded-lg flex items-center justify-start gap-2 border-red-500/20 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </Badge>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section: Total Budget Summary & Budgets Grid (Col span 8) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Total Budget Card (Aggregated overview) */}
          {budgets.length > 0 && (
            <Card className="glass border-white/5 shadow-xl relative overflow-hidden bg-gradient-to-r from-slate-900/60 via-violet-950/10 to-slate-900/60">
              <div className="absolute inset-0 bg-radial-gradient from-violet-500/5 via-transparent to-transparent pointer-events-none" />
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-violet-400 animate-pulse" />
                    Overall Monthly Budget
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Consolidated limits for {currentMonthName}
                  </CardDescription>
                </div>
                <Badge variant={isTotalOver ? "destructive" : "success"} className="px-2.5 py-1 text-xs">
                  {isTotalOver ? "Limit Exceeded" : "On Track"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-semibold block">Total Spent (on budgeted areas)</span>
                    <span className={`text-3xl font-extrabold ${isTotalOver ? "text-red-400" : "text-violet-300"}`}>
                      ₹{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="text-xs text-slate-500 font-medium block">Total Monthly Limit</span>
                    <span className="text-lg font-bold text-slate-300">
                      ₹{totalLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Progress 
                    value={totalSpent} 
                    max={totalLimit} 
                    className="h-3" 
                    indicatorClassName={
                      isTotalOver 
                        ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_12px_rgba(239,68,68,0.6)]" 
                        : totalPercentage > 85 
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]" 
                        : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_12px_rgba(139,92,246,0.6)]"
                    }
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 font-semibold">
                    <span>0%</span>
                    <span>{totalPercentage.toFixed(0)}% Used</span>
                    <span>100% Limit</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* List Grid / Category budgets */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">Category Limits</h3>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 glass border-white/5 rounded-xl">
                <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
                <p className="text-slate-400 text-xs">Loading budgets...</p>
              </div>
            ) : budgets.length === 0 ? (
              <Card className="glass border-white/5 p-8 text-center text-slate-500 space-y-4">
                <Wallet className="h-12 w-12 mx-auto text-slate-600 opacity-30" />
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="font-bold text-slate-400 text-sm">No Budgets Defined</h4>
                  <p className="text-xs text-slate-500">
                    You haven&apos;t established any category budgets for this month yet. Use the manager on the right to start!
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {budgets.map((b) => {
                  const spent = getCategorySpendThisMonth(b.category);
                  const limit = b.monthly_limit;
                  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                  const isOverBudget = spent > limit;

                  return (
                    <Card key={b.id} className="glass border-white/5 relative overflow-hidden hover:border-white/10 transition-colors shadow-lg">
                      {/* Accent glow on top */}
                      <div 
                        className="absolute top-0 left-0 w-full h-1" 
                        style={{ backgroundColor: CATEGORY_COLORS[b.category] || "#fff" }}
                      />
                      
                      <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: CATEGORY_COLORS[b.category] || "#fff" }}
                          />
                          {b.category}
                        </CardTitle>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full text-slate-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          onClick={() => handleDeleteBudget(b.id)}
                          title="Delete Limit"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className={isOverBudget ? "text-red-400 font-extrabold" : "text-slate-400"}>
                            ₹{spent.toFixed(0)} <span className="text-slate-500 font-normal">spent</span>
                          </span>
                          <span className="text-slate-300 font-bold">
                            ₹{limit.toFixed(0)} <span className="text-slate-500 font-normal text-[10px]">limit</span>
                          </span>
                        </div>

                        <Progress 
                          value={spent} 
                          max={limit} 
                          className="h-1.5" 
                          indicatorClassName={
                            isOverBudget 
                              ? "bg-gradient-to-r from-red-500 to-rose-600" 
                              : percentage > 85 
                              ? "bg-gradient-to-r from-amber-500 to-orange-500" 
                              : "bg-gradient-to-r from-violet-500 to-indigo-500"
                          }
                        />

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] text-slate-500">
                            {percentage > 100 ? `₹${(spent - limit).toFixed(0)} over limit` : `${(100 - percentage).toFixed(0)}% remaining`}
                          </span>
                          <Badge 
                            variant="secondary" 
                            className={`px-1.5 py-0 text-[9px] font-semibold border-0 ${
                              isOverBudget 
                                ? "bg-red-500/10 text-red-400" 
                                : percentage > 85 
                                ? "bg-amber-500/10 text-amber-400" 
                                : "bg-violet-500/10 text-violet-300"
                            }`}
                          >
                            {percentage.toFixed(0)}% Used
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Manage Budgets Form (Col span 4) */}
        <Card className="glass border-white/5 lg:col-span-4 shadow-xl relative overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-violet-400" />
              Manage Limits
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Upsert a monthly budget constraint for a spending category in Indian Rupees (₹).
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSaveBudget}>
            <CardContent className="space-y-4">
              {/* Category Selection */}
              <div className="space-y-1">
                <Label htmlFor="category" className="text-xs text-slate-400">Select Category</Label>
                <Select
                  id="category"
                  value={budgetCategory}
                  onChange={(e) => setBudgetCategory(e.target.value)}
                  className="bg-slate-950/40 border-slate-800 text-white"
                >
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Medical">Medical</option>
                  <option value="Education">Education</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Other">Other</option>
                </Select>
              </div>

              {/* Monthly Expense Limit Input */}
              <div className="space-y-1">
                <Label htmlFor="limit" className="text-xs text-slate-400">Monthly Expense Limit</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-semibold">₹</span>
                  <Input
                    id="limit"
                    type="number"
                    step="1"
                    placeholder="5000"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    className="pl-7 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button 
                type="submit" 
                variant="gradient" 
                className="w-full font-semibold text-white cursor-pointer"
                disabled={isSavingBudget}
              >
                {isSavingBudget ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Budget Limit
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
