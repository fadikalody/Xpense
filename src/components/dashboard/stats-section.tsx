"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, IndianRupee } from "lucide-react";

interface StatsSectionProps {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export function StatsSection({ totalIncome, totalExpense, balance }: StatsSectionProps) {
  return (
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
            ₹{totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
            ₹{totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
            <IndianRupee className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? "text-violet-300" : "text-red-400"}`}>
            {balance < 0 && "-"}₹{Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Disposable funds remaining</p>
        </CardContent>
      </Card>
    </div>
  );
}
