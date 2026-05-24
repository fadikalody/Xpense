"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface InsightsSectionProps {
  insightsList: string[];
}

export function InsightsSection({ insightsList }: InsightsSectionProps) {
  return (
    <Card className="glass border-white/5 flex flex-col justify-between">
      <div>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-slate-900 dark:text-white font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-400 animate-pulse" />
            AI Smart Insights
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
            Automatically calculated suggestions from logs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2 text-xs leading-relaxed max-h-72 overflow-y-auto">
          {insightsList.map((insight, idx) => (
            <div key={idx} className="flex gap-2.5 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-white/5">
              <div className="h-5 w-5 shrink-0 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
                {idx + 1}
              </div>
              <p className="text-slate-700 dark:text-slate-300 font-medium">{insight}</p>
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
  );
}
