"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Camera, 
  UploadCloud, 
  Sparkles, 
  Check, 
  RefreshCw, 
  ChevronRight, 
  ArrowLeft, 
  FileText, 
  Loader2, 
  AlertTriangle 
} from "lucide-react";
import Image from "next/image";
import confetti from "canvas-confetti";

interface ParsedReceipt {
  merchant_name: string;
  total_amount: number;
  date: string;
  category: string;
}

export default function ScanPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [step, setStep] = useState<"upload" | "scanning" | "review">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [publicReceiptUrl, setPublicReceiptUrl] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Parsed data to edit
  const [merchantName, setMerchantName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Other");
  const [isSaving, setIsSaving] = useState(false);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Open native camera/file picker
  const triggerFileSelect = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  // Handle selected image
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validations
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Image size exceeds 8MB. Please choose a smaller file.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Proceed to upload & scan
    await startUploadAndScanning(file);
  };

  // Core Flow: Upload image -> Gemini API -> Pre-fill Review Form
  const startUploadAndScanning = async (file: File) => {
    setStep("scanning");
    setError(null);
    setScanProgress(10);
    setScanStatusText("Uploading receipt image...");

    try {
      // 1. Get current logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to upload receipts.");
      }

      // 2. Upload file to Supabase Storage bucket 'receipts'
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/${Date.now()}_receipt.${fileExt}`;
      
      setScanProgress(25);

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        throw new Error(`Failed to upload to storage: ${uploadErr.message}`);
      }

      setScanProgress(45);
      setScanStatusText("Retrieving secure receipt URL...");

      // 3. Obtain public URL of the uploaded image
      const { data: { publicUrl } } = supabase.storage
        .from("receipts")
        .getPublicUrl(filePath);

      setPublicReceiptUrl(publicUrl);
      setScanProgress(60);
      setScanStatusText("Running AI receipt processor (Gemini)...");

      // 4. Send image URL to Gemini API Route
      const apiResponse = await fetch("/api/process-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });

      setScanProgress(85);

      const responseData = await apiResponse.json();

      if (!apiResponse.ok) {
        throw new Error(responseData.error || "AI Receipt processor failed.");
      }

      // 5. Pre-fill states with parsed data
      const parsed: ParsedReceipt = responseData;
      setMerchantName(parsed.merchant_name);
      setTotalAmount(parsed.total_amount.toString());
      
      // Standardize date to YYYY-MM-DD
      try {
        const parsedDate = new Date(parsed.date);
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate.toISOString().split("T")[0]);
        } else {
          setDate(new Date().toISOString().split("T")[0]);
        }
      } catch {
        setDate(new Date().toISOString().split("T")[0]);
      }
      
      setCategory(parsed.category);

      setScanProgress(100);
      setScanStatusText("Scan complete!");
      
      // Delay slightly for smooth transition
      setTimeout(() => {
        setStep("review");
      }, 500);

    } catch (err: any) {
      console.error("Scanning Error:", err);
      setError(err.message || "An error occurred during AI scanning.");
      setStep("upload");
    }
  };

  // Confirm and Save transaction to database
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName || !totalAmount || !date) {
      setError("Please fill out all fields.");
      return;
    }

    const amountNum = parseFloat(totalAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid expense amount.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session expired. Please log in again.");

      // Check current budget if any to trigger confetti later
      const transactionMonth = date.substring(0, 7); // "YYYY-MM"
      
      // Fetch budget for this category
      const { data: budgetData } = await supabase
        .from("budgets")
        .select("monthly_limit")
        .eq("user_id", user.id)
        .eq("category", category)
        .eq("month_year", `${transactionMonth}-01`)
        .single();

      // Fetch existing spending in this category for this month
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("category", category)
        .gte("date", `${transactionMonth}-01`)
        .lte("date", `${transactionMonth}-31`); // simplistically boundary check

      const currentSpend = (transactionsData || []).reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

      // Save new transaction
      const { error: insertErr } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "expense",
          amount: amountNum,
          merchant_name: merchantName,
          category: category,
          date: new Date(date).toISOString(),
          receipt_image_url: publicReceiptUrl,
        });

      if (insertErr) throw insertErr;

      // Celebrate with confetti if under budget limit!
      if (budgetData) {
        const limit = parseFloat(budgetData.monthly_limit.toString());
        if (currentSpend + amountNum <= limit) {
          // Trigger confetti burst
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ["#a78bfa", "#818cf8", "#34d399", "#fbbf24"],
          });
        }
      } else {
        // Generous confetti for normal logs
        confetti({
          particleCount: 50,
          spread: 45,
          origin: { y: 0.7 },
        });
      }

      // Success redirect
      router.push("/");
      router.refresh();

    } catch (err: any) {
      console.error("Save Error:", err);
      setError(`Failed to save transaction: ${err.message}`);
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setSelectedFile(null);
    setPreviewUrl(null);
    setPublicReceiptUrl(null);
    setScanProgress(0);
    setScanStatusText("");
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        {step !== "upload" && (
          <Button variant="ghost" size="icon" className="rounded-full cursor-pointer text-slate-400 hover:text-white" onClick={handleReset}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            AI Receipt Scanner <Sparkles className="h-6 w-6 text-violet-400 animate-pulse" />
          </h1>
          <p className="text-slate-400 text-sm">
            Scan your physical receipts and let AI extract details instantly
          </p>
        </div>
      </div>

      {/* Upload State */}
      {step === "upload" && (
        <Card className="glass border-white/10 overflow-hidden shadow-2xl relative">
          <div className="absolute inset-0 bg-radial-gradient from-violet-600/10 via-transparent to-transparent pointer-events-none" />
          <CardContent className="flex flex-col items-center justify-center p-12 text-center relative z-10 space-y-6">
            {error && (
              <Badge variant="destructive" className="py-2.5 px-4 rounded-xl flex items-center justify-start gap-2 border-red-500/20 max-w-md">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span className="text-left font-medium text-xs leading-relaxed text-red-200">{error}</span>
              </Badge>
            )}

            <div className="h-20 w-20 rounded-full bg-violet-600/10 flex items-center justify-center border border-violet-500/20 text-violet-400 shadow-inner">
              <Camera className="h-10 w-10 animate-bounce" />
            </div>

            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-bold text-white">Capture or Upload Receipt</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Take a quick photo using your mobile camera or upload an existing receipt image. We accept JPG, PNG up to 8MB.
              </p>
            </div>

            {/* Hidden Input for Camera/File Upload */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md pt-2">
              <Button
                variant="gradient"
                size="lg"
                onClick={triggerFileSelect}
                className="font-semibold text-white cursor-pointer"
              >
                <Camera className="mr-2 h-5 w-5" />
                Open Mobile Camera
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={triggerFileSelect}
                className="border-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <UploadCloud className="mr-2 h-5 w-5" />
                Upload from Gallery
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanning State */}
      {step === "scanning" && (
        <Card className="glass border-white/10 overflow-hidden relative p-8">
          <CardContent className="flex flex-col items-center justify-center space-y-6 pt-6">
            {previewUrl && (
              <div className="relative w-48 h-64 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <Image
                  src={previewUrl}
                  alt="Receipt Preview"
                  fill
                  className="object-cover opacity-80"
                />
                {/* Neon scan lines animation */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-indigo-500 shadow-md shadow-violet-500 animate-[bounce_2s_infinite]" />
              </div>
            )}

            <div className="w-full max-w-sm text-center space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2 text-violet-400 font-semibold text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{scanStatusText}</span>
                </div>
                <p className="text-xs text-slate-500">Do not close this page or navigate away.</p>
              </div>

              <Progress value={scanProgress} className="h-2" indicatorClassName="bg-gradient-to-r from-violet-500 to-indigo-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review & Edit State */}
      {step === "review" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left panel: Receipt preview */}
          <Card className="glass border-white/10 md:col-span-4 overflow-hidden h-full flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-300">
                <FileText className="h-4 w-4" />
                Scanned Receipt Document
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex items-center justify-center bg-slate-950/40">
              {previewUrl && (
                <div className="relative w-full aspect-3/4 rounded-lg overflow-hidden border border-white/5 shadow-inner">
                  <Image
                    src={previewUrl}
                    alt="Scanned receipt preview"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="p-4 bg-slate-900/30 flex justify-center border-t border-border/20">
              <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white cursor-pointer" onClick={handleReset}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Rescan Receipt
              </Button>
            </CardFooter>
          </Card>

          {/* Right panel: Pre-filled interactive Form */}
          <Card className="glass border-white/10 md:col-span-8 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg text-white font-bold flex items-center justify-between">
                <span>Confirm Receipt Details</span>
                <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  AI Extracted
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                We have parsed the receipt contents. Verify the details below and correct any inaccuracies before saving.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSaveTransaction}>
              <CardContent className="space-y-4">
                {error && (
                  <Badge variant="destructive" className="w-full py-2 px-3 rounded-lg flex items-center gap-2 border-red-500/20">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    <span className="font-medium text-xs leading-relaxed text-red-200">{error}</span>
                  </Badge>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Merchant Name */}
                  <div className="space-y-1">
                    <Label htmlFor="merchant" className="text-slate-300">Merchant Name</Label>
                    <Input
                      id="merchant"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      className="bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-500"
                      required
                    />
                  </div>

                  {/* Total Amount */}
                  <div className="space-y-1">
                    <Label htmlFor="amount" className="text-slate-300">Total Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500 text-sm font-semibold">₹</span>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        className="pl-7 bg-slate-900/60 border-slate-800 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Transaction Date */}
                  <div className="space-y-1">
                    <Label htmlFor="date" className="text-slate-300">Transaction Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="bg-slate-900/60 border-slate-800 text-white"
                      required
                    />
                  </div>

                  {/* Category Select */}
                  <div className="space-y-1">
                    <Label htmlFor="category" className="text-slate-300">Category</Label>
                    <Select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="bg-slate-900/60 border-slate-800 text-white"
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
              </CardContent>

              <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full sm:flex-1 font-semibold text-white cursor-pointer"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Expense...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Confirm & Save Expense
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="w-full sm:w-auto border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
