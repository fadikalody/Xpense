"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog } from "@/components/ui/dialog";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Wallet, 
  Flame, 
  Sparkles, 
  Plus, 
  Calendar, 
  ArrowUpRight, 
  AlertCircle, 
  Loader2, 
  Percent, 
  Tag, 
  ShoppingBag,
  ListFilter
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from "recharts";
import confetti from "canvas-confetti";
import { useOfflineSync } from "@/components/offline-sync-provider";

// Constant Category Palette for Pie Chart
const CATEGORY_COLORS: { [key: string]: string } = {
  Food: "#a78bfa",        // Purple
  Transport: "#60a5fa",   // Blue
  Medical: "#f87171",     // Red
  Education: "#34d399",   // Green
  Shopping: "#f472b6",    // Pink
  Entertainment: "#fbbf24",// Yellow
  Utilities: "#22d3ee",   // Cyan
  Other: "#94a3b8",       // Slate
};

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

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isOnline, queueOfflineTransaction } = useOfflineSync();

  // Core App States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Dialog States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Manual Entry Form State
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txMerchant, setTxMerchant] = useState("");
  const [txCategory, setTxCategory] = useState("Other");
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSavingTx, setIsSavingTx] = useState(false);

  // Budget Form State
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Fetch Data from Supabase
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

      // Calculate streak
      calculateStreak(formattedTx);

    } catch (err: any) {
      console.error("Error loading dashboard data:", err);
      setError(err.message || "Failed to retrieve transaction data.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Streak calculation logic: consecutive calendar days with at least one transaction
  const calculateStreak = (txList: Transaction[]) => {
    if (txList.length === 0) {
      setStreak(0);
      return;
    }

    const uniqueDates = new Set(
      txList
        .filter((tx) => tx.type === "expense")
        .map((tx) => tx.date.split("T")[0])
    );

    if (uniqueDates.size === 0) {
      setStreak(0);
      return;
    }

    let currentStreak = 0;
    const checkDate = new Date(); // Start from today

    while (true) {
      const dateString = checkDate.toISOString().split("T")[0];
      if (uniqueDates.has(dateString)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1); // Check previous day
      } else {
        // If today has no expense, check if yesterday had one to maintain streak
        if (currentStreak === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayString = checkDate.toISOString().split("T")[0];
          if (uniqueDates.has(yesterdayString)) {
            checkDate.setDate(checkDate.getDate() - 1);
            currentStreak = 1;
            continue;
          }
        }
        break;
      }
    }

    setStreak(currentStreak);
  };

  // 1. Calculate Stats
  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const balance = totalIncome - totalExpense;

  // 2. Budget tracking helper
  const currentMonthYear = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  
  const getCategorySpendThisMonth = (category: string) => {
    return transactions
      .filter((tx) => 
        tx.type === "expense" && 
        tx.category === category &&
        tx.date.substring(0, 7) === currentMonthYear
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  // 3. Category distribution for Recharts Pie Chart
  const pieChartData = Object.keys(CATEGORY_COLORS).map((cat) => {
    const value = transactions
      .filter((tx) => tx.type === "expense" && tx.category === cat)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { name: cat, value };
  }).filter((item) => item.value > 0);

  // 4. Monthly Bar Chart Trend (Last 6 Months)
  const getMonthlyTrendData = () => {
    const monthlyMap: { [key: string]: { income: number; expense: number } } = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { income: 0, expense: 0 };
    }

    // Populate
    transactions.forEach((tx) => {
      const txMonth = tx.date.substring(0, 7); // "YYYY-MM"
      if (monthlyMap[txMonth]) {
        if (tx.type === "income") {
          monthlyMap[txMonth].income += tx.amount;
        } else {
          monthlyMap[txMonth].expense += tx.amount;
        }
      }
    });

    return Object.entries(monthlyMap).map(([key, value]) => {
      const [year, monthNum] = key.split("-");
      const monthLabel = months[parseInt(monthNum) - 1];
      return {
        month: `${monthLabel} ${year.slice(-2)}`,
        Income: value.income,
        Expense: value.expense,
      };
    });
  };

  const barChartData = getMonthlyTrendData();

  // 5. Smart Financial Insights
  const getInsights = () => {
    const insights: string[] = [];

    // Week-over-week Food expense check
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const foodThisWeek = transactions
      .filter((tx) => 
        tx.type === "expense" && 
        tx.category === "Food" && 
        new Date(tx.date) >= oneWeekAgo &&
        new Date(tx.date) <= today
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const foodLastWeek = transactions
      .filter((tx) => 
        tx.type === "expense" && 
        tx.category === "Food" && 
        new Date(tx.date) >= twoWeeksAgo &&
        new Date(tx.date) < oneWeekAgo
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (foodThisWeek > 0 && foodLastWeek > 0) {
      const pctIncrease = ((foodThisWeek - foodLastWeek) / foodLastWeek) * 100;
      if (pctIncrease > 0) {
        insights.push(`You spent ${pctIncrease.toFixed(0)}% more on Food this week vs last week. Consider eating in more!`);
      } else {
        insights.push(`Awesome! You reduced your Food spending by ${Math.abs(pctIncrease).toFixed(0)}% this week vs last week.`);
      }
    }

    // Top spending category overall
    if (pieChartData.length > 0) {
      const topCat = [...pieChartData].sort((a, b) => b.value - a.value)[0];
      insights.push(`Your highest spending category is ${topCat.name} at $${topCat.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
    }

    // Budget warnings
    budgets.forEach((b) => {
      const spend = getCategorySpendThisMonth(b.category);
      if (spend > b.monthly_limit) {
        insights.push(`Budget Alert: You exceeded your monthly limit for ${b.category} by $${(spend - b.monthly_limit).toFixed(2)}!`);
      } else if (spend > b.monthly_limit * 0.85) {
        insights.push(`Budget Warning: You have used ${((spend / b.monthly_limit) * 100).toFixed(0)}% of your ${b.category} budget.`);
      }
    });

    if (insights.length === 0) {
      insights.push("No spend data yet. Start scanning your receipts or add manual entries to see smart insights!");
    }

    return insights;
  };

  const insightsList = getInsights();

  // Handle manual transaction submission
  const handleSaveManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txMerchant || !txDate) return;

    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsSavingTx(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Auth session expired.");

      if (!isOnline) {
        queueOfflineTransaction({
          type: txType,
          amount: amountNum,
          merchant_name: txMerchant,
          category: txCategory,
          date: new Date(txDate).toISOString(),
        });

        const offlineTx: Transaction = {
          id: `offline_${Date.now()}`,
          type: txType,
          amount: amountNum,
          merchant_name: txMerchant,
          category: txCategory,
          date: new Date(txDate).toISOString(),
        };

        setTransactions([offlineTx, ...transactions]);
        calculateStreak([offlineTx, ...transactions]);

        setIsManualModalOpen(false);
        setTxAmount("");
        setTxMerchant("");
        setTxCategory("Other");
        setTxDate(new Date().toISOString().split("T")[0]);
        setIsSavingTx(false);
        return;
      }

      // Check current budget if expense to trigger confetti later
      let triggerSuccessConfetti = false;
      if (txType === "expense") {
        const transactionMonth = txDate.substring(0, 7); // "YYYY-MM"
        const categoryBudget = budgets.find(
          (b) => b.category === txCategory && b.month_year === `${transactionMonth}-01`
        );
        if (categoryBudget) {
          const spend = getCategorySpendThisMonth(txCategory);
          if (spend + amountNum <= categoryBudget.monthly_limit) {
            triggerSuccessConfetti = true;
          }
        } else {
          triggerSuccessConfetti = true; // Confetti for standard logging
        }
      } else {
        triggerSuccessConfetti = true; // Confetti for logged income
      }

      const { error: insertErr } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: txType,
          amount: amountNum,
          merchant_name: txMerchant,
          category: txCategory,
          date: new Date(txDate).toISOString(),
        });

      if (insertErr) throw insertErr;

      if (triggerSuccessConfetti) {
        confetti({
          particleCount: 80,
          spread: 50,
          origin: { y: 0.6 }
        });
      }

      // Reset
      setIsManualModalOpen(false);
      setTxAmount("");
      setTxMerchant("");
      setTxCategory("Other");
      setTxDate(new Date().toISOString().split("T")[0]);
      
      // Refresh
      fetchData();

    } catch (err: any) {
      console.error(err);
      alert(`Error saving transaction: ${err.message}`);
    } finally {
      setIsSavingTx(false);
    }
  };

  // Handle budget configuration submission
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

      // Upsert budget to ensure single constraint
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
        particleCount: 30,
        spread: 30,
        colors: ["#a78bfa", "#818cf8"],
      });

      setIsBudgetModalOpen(false);
      setBudgetLimit("");
      fetchData();

    } catch (err: any) {
      console.error(err);
      alert(`Error setting budget: ${err.message}`);
    } finally {
      setIsSavingBudget(false);
    }
  };

  // Loading View
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
        <p className="text-slate-400 text-sm">Synchronizing your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Profile / Streak */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            Overview <Sparkles className="h-5 w-5 text-violet-400" />
          </h1>
          <p className="text-slate-400 text-sm">Analyze your spending, insights, and budget limits</p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {streak > 0 && (
            <Badge variant="success" className="bg-amber-500/15 text-amber-400 border-amber-500/20 px-3 py-1 text-sm font-bold flex items-center gap-1.5 animate-pulse-ring shrink-0">
              <Flame className="h-4.5 w-4.5 fill-amber-500 text-amber-500 animate-bounce" />
              <span>{streak} Day Streak!</span>
            </Badge>
          )}

          <Button variant="outline" className="w-full sm:w-auto border-slate-800 text-slate-300 hover:text-white cursor-pointer shrink-0" onClick={() => setIsBudgetModalOpen(true)}>
            <Wallet className="mr-2 h-4 w-4" />
            Set Budget
          </Button>

          <Button variant="gradient" className="w-full sm:w-auto font-semibold text-white cursor-pointer shrink-0" onClick={() => setIsManualModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Quick Entry
          </Button>
        </div>
      </div>

      {error && (
        <Badge variant="destructive" className="w-full py-2.5 px-3 rounded-lg flex items-center justify-start gap-2 border-red-500/20 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </Badge>
      )}

      {/* 3 Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Card */}
        <Card className="glass border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Total Income</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Combined total income logged</p>
          </CardContent>
        </Card>

        {/* Expenses Card */}
        <Card className="glass border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-red-500/5 blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Total Expenses</CardTitle>
            <div className="h-8 w-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              ${totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Combined expenses scan & manual</p>
          </CardContent>
        </Card>

        {/* Net Balance Card */}
        <Card className="glass border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-violet-500/5 blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-400">Net Balance</CardTitle>
            <div className="h-8 w-8 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-violet-300" : "text-red-400"}`}>
              {balance < 0 && "-"}${Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Disposable funds remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Trend Chart */}
        <Card className="glass border-white/5 lg:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-400" />
              Monthly Comparison
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Income versus expenses logged over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pl-0">
            {transactions.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                <ListFilter className="h-8 w-8 opacity-40" />
                <span>No statistical history to plot yet.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}
                    itemStyle={{ fontSize: "12px", color: "#fff" }}
                    labelStyle={{ fontSize: "11px", color: "#94a3b8", fontWeight: "bold" }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Income" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="Expense" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown (Pie) */}
        <Card className="glass border-white/5 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-violet-400" />
              Category Spend
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Expense allocation across categories
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 flex flex-col justify-between p-4">
            {pieChartData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                <Percent className="h-8 w-8 opacity-40" />
                <span>No expense distribution.</span>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [`$${value}`, "Amount"]}
                        contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}
                        itemStyle={{ fontSize: "11px", color: "#fff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-2 border-t border-border/20">
                  {pieChartData.slice(0, 4).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 truncate">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: CATEGORY_COLORS[entry.name] }}
                      />
                      <span className="truncate">{entry.name}: ${entry.value.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Smart Insights & Budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Budgets Tracker Card */}
        <Card className="glass border-white/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-violet-400" />
                Monthly Budgets
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Budget limits vs actual spent this month
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-violet-400 hover:text-violet-300 font-medium cursor-pointer" onClick={() => setIsBudgetModalOpen(true)}>
              Manage
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 max-h-72 overflow-y-auto pr-1">
            {budgets.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs space-y-3">
                <p>You haven&apos;t set any category budgets for this month.</p>
                <Button variant="outline" size="sm" className="border-slate-800 text-slate-400 hover:text-white" onClick={() => setIsBudgetModalOpen(true)}>
                  Create Your First Budget Limit
                </Button>
              </div>
            ) : (
              budgets.map((b) => {
                const spent = getCategorySpendThisMonth(b.category);
                const limit = b.monthly_limit;
                const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                const isOverBudget = spent > limit;

                return (
                  <div key={b.id} className="space-y-1 bg-slate-950/20 p-2.5 rounded-lg border border-white/2">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: CATEGORY_COLORS[b.category] || "#fff" }}
                        />
                        {b.category}
                      </span>
                      <span className={isOverBudget ? "text-red-400" : "text-slate-400"}>
                        ${spent.toFixed(0)} <span className="text-slate-500 font-normal">/ ${limit.toFixed(0)}</span>
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
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Smart Financial Insights Card */}
        <Card className="glass border-white/5 flex flex-col justify-between">
          <div>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400 animate-pulse" />
                AI Smart Insights
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Automatically calculated suggestions from logs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2 text-xs leading-relaxed max-h-72 overflow-y-auto">
              {insightsList.map((insight, idx) => (
                <div key={idx} className="flex gap-2.5 p-3 rounded-lg bg-slate-900/40 border border-white/3">
                  <div className="h-5 w-5 shrink-0 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-slate-300 font-medium">{insight}</p>
                </div>
              ))}
            </CardContent>
          </div>
          <CardFooter className="pt-2 border-t border-border/10 bg-slate-900/10">
            <p className="text-[9px] text-slate-500 text-center w-full">
              Insights are calculated based on your historical database uploads.
            </p>
          </CardFooter>
        </Card>
      </div>

      {/* Manual Entry Dialog Modal */}
      <Dialog isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Log Transaction Manual" description="Add income or expense transactions directly without scanning a receipt image.">
        <form onSubmit={handleSaveManualTx} className="space-y-4 mt-2">
          {/* Type Select */}
          <div className="space-y-1">
            <Label htmlFor="tx-type">Transaction Type</Label>
            <Select id="tx-type" value={txType} onChange={(e) => setTxType(e.target.value as any)}>
              <option value="expense">Expense (-)</option>
              <option value="income">Income (+)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Merchant / Source */}
            <div className="space-y-1">
              <Label htmlFor="tx-merchant">{txType === "expense" ? "Merchant Name" : "Source"}</Label>
              <Input
                id="tx-merchant"
                value={txMerchant}
                onChange={(e) => setTxMerchant(e.target.value)}
                placeholder={txType === "expense" ? "e.g. Starbucks" : "e.g. Freelance"}
                className="bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-600"
                required
              />
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <Label htmlFor="tx-amount">Total Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-semibold">$</span>
                <Input
                  id="tx-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="pl-7 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-600"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-1">
              <Label htmlFor="tx-date">Transaction Date</Label>
              <Input
                id="tx-date"
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="bg-slate-950/40 border-slate-800 text-white"
                required
              />
            </div>

            {/* Category (Expense only) */}
            <div className="space-y-1">
              <Label htmlFor="tx-category">Category</Label>
              <Select
                id="tx-category"
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
                className="bg-slate-950/40 border-slate-800 text-white"
                disabled={txType === "income"}
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
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
            <Button type="button" variant="outline" className="border-slate-800 text-slate-300 hover:text-white cursor-pointer" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" className="font-semibold text-white cursor-pointer" disabled={isSavingTx}>
              {isSavingTx ? "Saving..." : "Save Transaction"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Budget Set Dialog Modal */}
      <Dialog isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} title="Manage Category Budget" description="Establish monthly expenditure constraints for specific categories. Values are upserted for the current calendar month.">
        <form onSubmit={handleSaveBudget} className="space-y-4 mt-2">
          {/* Category Select */}
          <div className="space-y-1">
            <Label htmlFor="bg-category">Select Category</Label>
            <Select id="bg-category" value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)}>
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

          {/* Monthly Limit */}
          <div className="space-y-1">
            <Label htmlFor="bg-limit">Monthly Expense Limit</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-semibold">$</span>
              <Input
                id="bg-limit"
                type="number"
                step="1"
                placeholder="500"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                className="pl-7 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
            <Button type="button" variant="outline" className="border-slate-800 text-slate-300 hover:text-white cursor-pointer" onClick={() => setIsBudgetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" className="font-semibold text-white cursor-pointer" disabled={isSavingBudget}>
              {isSavingBudget ? "Updating..." : "Save Budget Limit"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
