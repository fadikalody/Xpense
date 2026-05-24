"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingBag, ListFilter, Percent, Loader2 } from "lucide-react";
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

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  merchant_name: string;
  category: string;
  date: string;
}

interface ChartsSectionProps {
  transactions: Transaction[];
  barChartData: any[];
  pieChartData: any[];
  CATEGORY_COLORS: Record<string, string>;
}

export function ChartsSection({
  transactions,
  barChartData,
  pieChartData,
  CATEGORY_COLORS,
}: ChartsSectionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Monthly Trend Chart */}
      <Card className="glass border-white/5 lg:col-span-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-slate-900 dark:text-white font-bold flex items-center gap-2">
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
          ) : !mounted ? (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
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
          <CardTitle className="text-lg text-slate-900 dark:text-white font-bold flex items-center gap-2">
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
          ) : !mounted ? (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
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
                      formatter={(value) => [`₹${value}`, "Amount"]}
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}
                      itemStyle={{ fontSize: "11px", color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Custom Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-border/20 max-h-16 overflow-y-auto pr-1">
                {pieChartData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 shrink-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[entry.name] }}
                    />
                    <span>{entry.name}: ₹{entry.value.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
