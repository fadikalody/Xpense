"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bot,
  Brain,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Send,
  Loader2,
  RefreshCw,
  MessageSquare,
  Flame,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  merchant_name: string;
  category: string;
  date: string;
}

interface Message {
  id: string;
  role: "user" | "model";
  content: string;
}

interface Subscription {
  merchant: string;
  amount: number;
  category: string;
  cycle: "weekly" | "monthly" | "yearly";
  lastDate: string;
  nextDueDate: string;
  daysRemaining: number;
}

// ─── Custom Premium Markdown Parser ─────────────────────────────────────────
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  
  // Match **bold** or *italic*
  const pattern = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
  let match;
  let keyIdx = 0;
  
  while ((match = pattern.exec(text)) !== null) {
    const matchIndex = match.index;
    
    if (matchIndex > currentIndex) {
      parts.push(text.substring(currentIndex, matchIndex));
    }
    
    if (match[2]) {
      parts.push(<strong key={`b_${keyIdx++}`} className="font-extrabold text-white">{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<em key={`i_${keyIdx++}`} className="italic text-slate-300">{match[4]}</em>);
    }
    
    currentIndex = pattern.lastIndex;
  }
  
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

function parseMarkdown(content: string): React.ReactNode {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  
  let inList = false;
  let listItems: string[] = [];
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  
  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list_${key}`} className="list-disc pl-5 space-y-1 my-2 text-slate-200">
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };
  
  const flushTable = (key: string) => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table_wrap_${key}`} className="overflow-x-auto my-3 border border-white/10 rounded-xl bg-slate-950/40 shadow-inner">
          <table className="min-w-full divide-y divide-white/10 text-left text-xs">
            {tableHeaders.length > 0 && (
              <thead className="bg-white/5 text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  {tableHeaders.map((h, idx) => (
                    <th key={idx} className="px-4 py-2.5 border-b border-white/10">{parseInlineMarkdown(h)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-white/5 text-slate-200">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/2 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 border-b border-white/5">{parseInlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 1. Table Detection
    if (line.startsWith("|")) {
      flushList(`${i}`);
      
      const cells = line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      const isSeparator = cells.every(c => c.startsWith("-") || c.startsWith(":") || c.includes("---"));
      if (isSeparator) {
        inTable = true;
        continue;
      }
      
      if (!inTable) {
        tableHeaders = cells;
        inTable = true;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      if (inTable) {
        flushTable(`${i}`);
      }
    }
    
    // 2. Heading Detection
    if (line.startsWith("#")) {
      flushList(`${i}`);
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const headingClasses = 
          level === 1 ? "text-lg font-extrabold text-white mt-4 mb-2" :
          level === 2 ? "text-base font-bold text-white mt-3 mb-1.5" :
          "text-sm font-bold text-violet-300 mt-2.5 mb-1";
        
        elements.push(
          <div key={i} className={headingClasses}>
            {parseInlineMarkdown(text)}
          </div>
        );
        continue;
      }
    }
    
    // 3. Bullet List Detection
    if (line.startsWith("-") || line.startsWith("*") || line.startsWith("•")) {
      const text = line.replace(/^[-*•]\s+/, "");
      inList = true;
      listItems.push(text);
      continue;
    } else {
      if (inList) {
        flushList(`${i}`);
      }
    }
    
    // 4. Empty lines
    if (!line) {
      elements.push(<div key={i} className="h-1.5" />);
      continue;
    }
    
    // 5. Standard Paragraph
    elements.push(
      <p key={i} className="mb-0.5 text-slate-200">
        {parseInlineMarkdown(line)}
      </p>
    );
  }
  
  flushList("end");
  flushTable("end");
  
  return <div className="space-y-0.5">{elements}</div>;
}

export default function AssistantPage() {
  const supabase = createClient();

  // Core Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Chat States
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Analytics Mounted Guard
  const [mounted, setMounted] = useState(false);

  // Seeding Quick Questions
  const QUICK_QUESTIONS = [
    "What is my highest spending category?",
    "Find my laptops or electronics purchases",
    "Did I spend more in Food last week?",
    "Show me a summary of my net balance"
  ];

  // 1. Fetch Transactions on Mount
  const fetchTransactions = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;

      const formatted: Transaction[] = (data || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount.toString()),
        merchant_name: t.merchant_name,
        category: t.category,
        date: t.date,
      }));

      setTransactions(formatted);
    } catch (err) {
      console.error("Failed to load transactions for assistant:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTransactions();
    setMounted(true);
    // Add default greeting
    setMessages([
      {
        id: "greet",
        role: "model",
        content: "👋 Hello! I am your **Xpense AI Assistant**. I have secure, read-only access to your personal financial database.\n\nYou can ask me specific questions like *'How much did I spend at Starbucks?'*, request visual budget status, or analyze your monthly transactions. How can I help you today?"
      }
    ]);
  }, [fetchTransactions]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // 2. Chat Handler
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Compile preceding history (exclude current message, default model greeting, and errors)
      const chatHistory = messages
        .filter(m => m.id !== "greet" && !m.id.startsWith("err_"))
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({
          message: text,
          history: chatHistory
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to call RAG assistant API");

      const modelMsg: Message = {
        id: `model_${Date.now()}`,
        role: "model",
        content: data.reply
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "model",
          content: `⚠️ **System Error**: ${err.message || "Failed to retrieve an answer from the AI assistant. Please verify your connection."}`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // ── 3. Data Science: Smart Subscription Recurrence Detector ──────────────────
  const detectSubscriptions = (): Subscription[] => {
    const expenses = transactions.filter(t => t.type === "expense");
    
    // Group expenses by merchant name (simplified) and exact rounded amount
    const groups: Record<string, Transaction[]> = {};
    expenses.forEach(tx => {
      const cleanMerchant = tx.merchant_name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
      if (!cleanMerchant) return;
      
      const key = `${cleanMerchant}_${tx.amount.toFixed(0)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    
    const subs: Subscription[] = [];
    const now = new Date();
    
    Object.values(groups).forEach(txs => {
      if (txs.length < 2) return;
      
      // Sort chronologically (oldest to newest)
      txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Calculate date differences
      const diffs: number[] = [];
      for (let i = 1; i < txs.length; i++) {
        const d1 = new Date(txs[i-1].date);
        const d2 = new Date(txs[i].date);
        const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        diffs.push(days);
      }
      
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      
      let cycle: "weekly" | "monthly" | "yearly" | null = null;
      let daysToAdd = 30;
      
      if (avgDiff >= 6 && avgDiff <= 8) {
        cycle = "weekly";
        daysToAdd = 7;
      } else if (avgDiff >= 25 && avgDiff <= 35) {
        cycle = "monthly";
        daysToAdd = 30;
      } else if (avgDiff >= 350 && avgDiff <= 380) {
        cycle = "yearly";
        daysToAdd = 365;
      }
      
      if (cycle) {
        const lastTx = txs[txs.length - 1];
        const lastDate = new Date(lastTx.date);
        const nextDueDate = new Date(lastDate);
        nextDueDate.setDate(nextDueDate.getDate() + daysToAdd);
        
        const diffTime = nextDueDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        subs.push({
          merchant: lastTx.merchant_name,
          amount: lastTx.amount,
          category: lastTx.category,
          cycle,
          lastDate: lastTx.date,
          nextDueDate: nextDueDate.toISOString(),
          daysRemaining,
        });
      }
    });
    
    return subs.sort((a, b) => a.daysRemaining - b.daysRemaining);
  };

  // Memoized: only re-runs O(n²) subscription scan when transactions array changes,
  // NOT on every chat input keystroke or message state update
  const activeSubscriptions = useMemo(() => detectSubscriptions(), [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. Data Science: Linear Regression Expense Predictor ──────────────────
  const calculateSpendingForecast = () => {
    const monthlyExpensesMap: Record<string, number> = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Initialise last 6 months keys
    const last6MonthsKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      last6MonthsKeys.push(key);
      monthlyExpensesMap[key] = 0;
    }
    
    // Fill expenses
    const expenses = transactions.filter(t => t.type === "expense");
    expenses.forEach(t => {
      const monthKey = t.date.substring(0, 7); // "YYYY-MM"
      if (monthlyExpensesMap[monthKey] !== undefined) {
        monthlyExpensesMap[monthKey] += t.amount;
      }
    });
    
    const regressionData = last6MonthsKeys.map((key, index) => {
      const [year, monthNum] = key.split("-");
      const monthLabel = months[parseInt(monthNum) - 1];
      return {
        index, // independent variable x
        month: `${monthLabel} ${year.slice(-2)}`,
        expenses: monthlyExpensesMap[key]
      };
    });
    
    // Linear Regression Formula: y = mx + c
    const N = regressionData.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    regressionData.forEach(pt => {
      sumX += pt.index;
      sumY += pt.expenses;
      sumXY += pt.index * pt.expenses;
      sumXX += pt.index * pt.index;
    });
    
    const slopeDenominator = N * sumXX - sumX * sumX;
    const m = slopeDenominator !== 0 ? (N * sumXY - sumX * sumY) / slopeDenominator : 0;
    const c = (sumY - m * sumX) / N;
    
    // Project next month's spending (index = 6)
    const rawForecast = m * 6 + c;
    const forecastedAmount = rawForecast > 0 ? rawForecast : 0;
    
    // Find average run rate (average of last 6 months)
    const total6MonthSpent = regressionData.reduce((sum, pt) => sum + pt.expenses, 0);
    const averageRunRate = total6MonthSpent / N;
    
    // Current Month Spending Track Run-Rate calculation
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const currentMonthSpent = monthlyExpensesMap[currentMonthKey] || 0;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentMonthProjected = currentMonthSpent * (daysInMonth / dayOfMonth);
    
    // Forecast data array for Recharts plotting
    const chartData = regressionData.map(pt => ({
      month: pt.month,
      Actual: pt.expenses,
      Projected: parseFloat((m * pt.index + c).toFixed(1))
    }));
    
    // Append forecasted month (index = 6)
    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const forecastMonthLabel = `${months[nextMonthDate.getMonth()]} ${nextMonthDate.getFullYear().toString().slice(-2)}`;
    
    chartData.push({
      month: `${forecastMonthLabel} (AI Forecast)`,
      Actual: null as any,
      Projected: parseFloat(forecastedAmount.toFixed(1))
    });
    
    return {
      chartData,
      forecastedAmount,
      averageRunRate,
      currentMonthSpent,
      currentMonthProjected,
      isExceedingRunRate: currentMonthProjected > averageRunRate && averageRunRate > 0
    };
  };

  // Memoized: linear regression + chart data only recomputed when transactions changes
  const forecastStats = useMemo(() => calculateSpendingForecast(), [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            AI Assistant & Predictive Hub <Brain className="h-6 w-6 text-violet-400" />
          </h1>
          <p className="text-slate-400 text-sm">
            Interactive RAG chat, regression spending forecasts, and recurring payments calendar
          </p>
        </div>
        <Button variant="outline" size="sm" className="border-slate-800 text-slate-300 hover:text-white" onClick={fetchTransactions} disabled={isLoadingData}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingData ? "animate-spin" : ""}`} />
          Sync Ledger
        </Button>
      </div>

      {/* Main Grid: Chatbot on the left, Analytics & Subscriptions on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: RAG Chatbot (lg:col-span-7) */}
        <Card className="glass border-white/5 lg:col-span-7 h-[600px] flex flex-col justify-between overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-violet-600/5 blur-3xl pointer-events-none" />
          
          {/* Chat Header */}
          <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center gap-3 shrink-0">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-bold flex items-center gap-1.5">
                Financial Chat Assistant
                <Badge className="bg-violet-500/20 text-violet-300 text-[9px] border-violet-500/30">Active RAG</Badge>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">Ask natural questions about your receipts &amp; spending</CardDescription>
            </div>
          </CardHeader>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-950/10">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white"
                    : "bg-slate-900 border border-white/10 text-violet-400"
                }`}>
                  {msg.role === "user" ? "U" : <Bot className="h-4 w-4" />}
                </div>

                <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-none font-medium shadow-lg shadow-violet-950/20"
                    : "bg-slate-900/60 border border-white/5 text-slate-200 rounded-tl-none glass"
                }`}>
                  {/* Premium dynamic markdown rendering */}
                  <div className="space-y-1">
                    {parseMarkdown(msg.content)}
                  </div>
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex gap-3 max-w-[85%] mr-auto items-center">
                <div className="h-8 w-8 rounded-full bg-slate-900 border border-white/10 text-violet-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <Badge className="bg-slate-900/50 border border-white/5 py-2 px-3 rounded-2xl flex items-center gap-1.5 text-slate-400 text-xs rounded-tl-none animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
                  Analyzing database context...
                </Badge>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Seeds & Input Section */}
          <div className="p-4 border-t border-white/5 shrink-0 bg-slate-950/20 space-y-4">
            {/* Quick Seeds */}
            {messages.length === 1 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                  <HelpCircle className="h-3 w-3 text-slate-500" /> Try clicking a quick sample query:
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSendMessage(q)}
                      disabled={isSending}
                      className="text-[10px] text-slate-400 hover:text-white bg-slate-900/50 hover:bg-violet-950/30 border border-white/5 hover:border-violet-500/30 px-2.5 py-1.5 rounded-full transition-all cursor-pointer truncate max-w-[250px]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex gap-2"
            >
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about Starbucks spending, budget totals, laptop invoices..."
                className="bg-slate-950/50 border-white/5 text-white placeholder:text-slate-600 text-xs h-10 rounded-xl"
                disabled={isSending}
                required
              />
              <Button type="submit" variant="gradient" size="icon" className="h-10 w-10 shrink-0 rounded-xl cursor-pointer" disabled={isSending}>
                <Send className="h-4.5 w-4.5 text-white" />
              </Button>
            </form>
          </div>
        </Card>

        {/* RIGHT COLUMN: PREDICTIVE CHARTS & RECURRING SUB CALENDAR (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section 1: Spending Linear Regression Predictive Model */}
          <Card className="glass border-white/5 relative overflow-hidden shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white font-bold flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-violet-400" />
                AI Spending Projections (Linear Regression)
              </CardTitle>
              <CardDescription className="text-slate-400 text-[10px]">
                Analyzes 6-month historical slope to forecast upcoming month spending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Forecast Alert Block */}
              {forecastStats.isExceedingRunRate ? (
                <div className="flex gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-amber-200 leading-normal">
                    <span className="font-bold">Run-Rate Alert!</span> Based on your current calendar progress, you are on track to spend <span className="font-extrabold text-amber-300">₹{forecastStats.currentMonthProjected.toFixed(0)}</span> this month, exceeding your historical average monthly spending of <span className="font-bold">₹{forecastStats.averageRunRate.toFixed(0)}</span>. Consider tightening expenses!
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-emerald-200 leading-normal">
                    <span className="font-bold">On track!</span> Your current projected monthly spending (<span className="font-extrabold text-emerald-300">₹{forecastStats.currentMonthProjected.toFixed(0)}</span>) is safely below your average monthly run-rate. Great budgeting discipline!
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="h-48 pl-0">
                {!mounted ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastStats.chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}
                        itemStyle={{ fontSize: "10px", color: "#fff" }}
                        labelStyle={{ fontSize: "9px", color: "#94a3b8", fontWeight: "bold" }}
                      />
                      <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: "9px" }} />
                      <Line type="monotone" dataKey="Actual" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="Projected" stroke="#818cf8" strokeDasharray="3 3" strokeWidth={1.5} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Forecast Numbers Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-center border-t border-white/5">
                <div className="bg-slate-950/20 p-2.5 rounded-lg border border-white/2">
                  <p className="text-[9px] text-slate-500 uppercase font-semibold">AI Next Month Projection</p>
                  <p className="text-base font-extrabold text-violet-400 mt-0.5">₹{forecastStats.forecastedAmount.toFixed(0)}</p>
                </div>
                <div className="bg-slate-950/20 p-2.5 rounded-lg border border-white/2">
                  <p className="text-[9px] text-slate-500 uppercase font-semibold">Average monthly run-rate</p>
                  <p className="text-base font-extrabold text-slate-300 mt-0.5">₹{forecastStats.averageRunRate.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Smart Subscription Detector & Calendar */}
          <Card className="glass border-white/5 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white font-bold flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-violet-400" />
                Upcoming Subscriptions (AI Scan)
              </CardTitle>
              <CardDescription className="text-slate-400 text-[10px]">
                Scans transaction gaps and dates for recurring monthly/weekly cycles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {activeSubscriptions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No recurring payments detected yet. The AI scans for identical amounts billed at fixed cycles (weekly/monthly).
                </div>
              ) : (
                activeSubscriptions.map((sub, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-950/20 p-3 rounded-xl border border-white/3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold shrink-0">
                        {sub.merchant.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{sub.merchant}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge className="bg-violet-500/20 text-violet-300 text-[8px] py-0 px-1 border-violet-500/20">
                            {sub.cycle}
                          </Badge>
                          <span className="text-[9px] text-slate-500">
                            Next due: {new Date(sub.nextDueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-extrabold text-white">₹{sub.amount.toFixed(0)}</p>
                      <span className={`text-[9px] block mt-0.5 ${
                        sub.daysRemaining <= 3 
                          ? "text-red-400 font-bold animate-pulse" 
                          : sub.daysRemaining <= 7 
                            ? "text-amber-400" 
                            : "text-slate-500"
                      }`}>
                        {sub.daysRemaining <= 0 
                          ? "Due today" 
                          : sub.daysRemaining === 1 
                            ? "Due tomorrow" 
                            : `Due in ${sub.daysRemaining} days`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
