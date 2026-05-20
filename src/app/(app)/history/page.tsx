"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  Search,
  Download,
  Calendar,
  Tag,
  Eye,
  Trash2,
  Loader2,
  ArrowUpDown,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import Image from "next/image";

interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  merchant_name: string;
  category: string;
  date: string;
  receipt_image_url?: string | null;
}

export default function HistoryPage() {
  const supabase = createClient();

  // Core Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Expandable Receipt Dialog State
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Fetch Transaction History
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: txErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: sortOrder === "asc" });

      if (txErr) throw txErr;

      const formatted: Transaction[] = (data || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount.toString()),
        merchant_name: t.merchant_name,
        category: t.category,
        date: t.date,
        receipt_image_url: t.receipt_image_url,
      }));

      setTransactions(formatted);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to retrieve transaction history.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, sortOrder]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle transaction deletion
  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction record?")) return;

    try {
      const { error: deleteErr } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (deleteErr) throw deleteErr;

      // Update state locally
      setTransactions(transactions.filter((tx) => tx.id !== id));
    } catch (err: any) {
      console.error(err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Filter Logic on Client Side for hyper-responsiveness
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = tx.merchant_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "All" || tx.category === categoryFilter;

    let matchesDate = true;
    const txTime = new Date(tx.date).getTime();
    if (startDate) {
      const start = new Date(startDate).getTime();
      matchesDate = matchesDate && txTime >= start;
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000; // include full day
      matchesDate = matchesDate && txTime <= end;
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Toggle sort order
  const toggleSort = () => {
    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
  };

  // Receipt modal visual click
  const openReceiptModal = (url: string, merchant: string) => {
    setSelectedReceiptUrl(url);
    setSelectedMerchant(merchant);
    setIsReceiptOpen(true);
  };

  // Bulletproof CSV Export using Blobs
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("No transaction records available to export.");
      return;
    }

    const headers = ["ID", "Transaction Type", "Merchant/Source", "Category", "Amount (₹)", "Logged Date", "Receipt Public Link"];

    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.type.toUpperCase(),
      `"${tx.merchant_name.replace(/"/g, '""')}"`,
      tx.category,
      tx.amount.toFixed(2),
      tx.date.split("T")[0],
      tx.receipt_image_url || "None"
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `xpense_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Category list for filters
  const categories = ["Food", "Transport", "Medical", "Education", "Shopping", "Entertainment", "Utilities", "Other"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            Transaction History <FileSpreadsheet className="h-6 w-6 text-violet-400" />
          </h1>
          <p className="text-slate-400 text-sm">
            Query, manage, filter, and export your logged income and expenses
          </p>
        </div>

        <Button
          variant="gradient"
          onClick={handleExportCSV}
          className="w-full sm:w-auto font-semibold text-white cursor-pointer"
        >
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      {error && (
        <Badge variant="destructive" className="w-full py-2.5 px-3 rounded-lg flex items-center justify-start gap-2 border-red-500/20 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </Badge>
      )}

      {/* Filter Card */}
      <Card className="glass border-white/5 shadow-xl">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold text-slate-300">Advanced Query Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {/* Search */}
            <div className="sm:col-span-6 space-y-1">
              <Label htmlFor="search" className="text-xs text-slate-400">Search Merchant/Source</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Starbucks..."
                  className="pl-9 bg-slate-950/40 border-slate-800 text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="sm:col-span-3 space-y-1">
              <Label htmlFor="category" className="text-xs text-slate-400">Category</Label>
              <Select
                id="category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950/40 border-slate-800 text-white"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            {/* Sorting Toggle */}
            <div className="sm:col-span-3 space-y-1 flex flex-col justify-end">
              <Button
                variant="outline"
                onClick={toggleSort}
                className="w-full border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort: Date ({sortOrder.toUpperCase()})
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/20">
            {/* Start Date */}
            <div className="space-y-1">
              <Label htmlFor="start-date" className="text-xs text-slate-400">From Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950/40 border-slate-800 text-white"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <Label htmlFor="end-date" className="text-xs text-slate-400">To Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950/40 border-slate-800 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List Card */}
      <Card className="glass border-white/5 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
              <p className="text-slate-400 text-xs">Querying database...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-16 text-slate-500 space-y-2">
              <AlertCircle className="h-10 w-10 mx-auto text-slate-600 opacity-40 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-400">No Transactions Located</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No history matches the current search or filters. Modify your query or scan some receipts to start!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-900/35 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    <div className={`h-10 w-10 rounded-full shrink-0 flex items-center justify-center border ${tx.type === "income"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                      }`}>
                      {tx.type === "income" ? <TrendingUp className="h-4.5 w-4.5" /> : <TrendingDown className="h-4.5 w-4.5" />}
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-sm sm:text-base">{tx.merchant_name}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {tx.date.split("T")[0]}
                        </span>
                        <span className="text-slate-600">•</span>
                        <Badge variant="secondary" className="px-2 py-0 text-[10px] bg-slate-900 text-slate-300 font-semibold border-slate-800">
                          {tx.category}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-0 border-border/10 pt-2 sm:pt-0">
                    <div className={`text-right font-bold text-sm sm:text-base ${tx.type === "income" ? "text-emerald-400" : "text-slate-100"
                      }`}>
                      {tx.type === "income" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Thumbnail expand */}
                      {tx.receipt_image_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full border border-white/5 hover:bg-violet-500/10 text-violet-400 cursor-pointer"
                          onClick={() => openReceiptModal(tx.receipt_image_url!, tx.merchant_name)}
                          title="View Receipt File"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Delete item */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full border border-white/5 hover:bg-red-500/10 text-red-400 cursor-pointer"
                        onClick={() => handleDeleteTransaction(tx.id)}
                        title="Delete record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expandable Image Modal */}
      <Dialog isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title={`${selectedMerchant} Receipt Document`} description="Click outside or click the close button to dismiss.">
        {selectedReceiptUrl && (
          <div className="relative w-full aspect-3/4 rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black">
            <Image
              src={selectedReceiptUrl}
              alt="Expanded receipt preview"
              fill
              className="object-contain"
              priority
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
