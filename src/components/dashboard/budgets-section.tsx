"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Wallet } from "lucide-react";

interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  month_year: string;
}

interface BudgetsSectionProps {
  budgets: Budget[];
  getCategorySpendThisMonth: (category: string) => number;
  setIsBudgetModalOpen: (open: boolean) => void;
  CATEGORY_COLORS: Record<string, string>;
}

export function BudgetsSection({
  budgets,
  getCategorySpendThisMonth,
  setIsBudgetModalOpen,
  CATEGORY_COLORS,
}: BudgetsSectionProps) {
  return (
    <Card className="glass border-white/5">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg text-slate-900 dark:text-white font-bold flex items-center gap-2">
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
      <CardContent className="space-y-4 max-h-[320px] overflow-hidden pr-1">
        {budgets.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs space-y-3">
            <p>You haven&apos;t set any category budgets for this month.</p>
            <Button variant="outline" size="sm" className="border-slate-800 text-slate-400 hover:text-white" onClick={() => setIsBudgetModalOpen(true)}>
              Create Your First Budget Limit
            </Button>
          </div>
        ) : (
          <>
            {/* Aggregate Total Budget Card */}
            {(() => {
              const totalLimit = budgets.reduce((sum, b) => sum + b.monthly_limit, 0);
              const totalSpent = budgets.reduce((sum, b) => sum + getCategorySpendThisMonth(b.category), 0);
              const totalPercentage = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
              const isTotalOver = totalSpent > totalLimit;

              return (
                <div className="space-y-1 bg-gradient-to-r from-violet-950/20 to-indigo-950/20 p-3 rounded-lg border border-violet-500/10 shadow-lg shadow-violet-950/5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0 shadow-sm animate-pulse" />
                      Total Budget
                    </span>
                    <span className={isTotalOver ? "text-red-600 dark:text-red-400 font-extrabold" : "text-violet-700 dark:text-violet-200"}>
                      ₹{totalSpent.toFixed(0)} <span className="text-slate-500 font-normal">/ ₹{totalLimit.toFixed(0)}</span>
                    </span>
                  </div>
                  <Progress
                    value={totalSpent}
                    max={totalLimit}
                    className="h-2"
                    indicatorClassName={
                      isTotalOver
                        ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        : totalPercentage > 85
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                          : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
                    }
                  />
                </div>
              );
            })()}

            {/* Scrollable list of categories */}
            <div className="space-y-3 max-h-[170px] overflow-y-auto pr-1">
              {budgets.map((b) => {
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
                        ₹{spent.toFixed(0)} <span className="text-slate-500 font-normal">/ ₹{limit.toFixed(0)}</span>
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
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
