import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Known-good prefix for Supabase receipt storage — prevents SSRF via arbitrary imageUrl
const ALLOWED_IMAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/receipts/`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    // ── 1. Authenticate the caller ───────────────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Parse and validate request body ──────────────────────────────────
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { imageUrl } = body;
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Missing required parameter: imageUrl" }, { status: 400 });
    }

    // ── 3. SSRF protection: only allow Supabase storage receipt URLs ─────────
    if (!imageUrl.startsWith(ALLOWED_IMAGE_PREFIX)) {
      return NextResponse.json(
        { error: "Invalid image URL. Only receipt storage URLs are accepted." },
        { status: 400 }
      );
    }

    // ── 4. Fetch image from Supabase storage ─────────────────────────────────
    let imageBuffer: ArrayBuffer;
    let contentType = "image/jpeg";

    try {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Storage fetch failed with status ${imgResponse.status}`);
      }
      // Enforce image MIME types
      const rawContentType = imgResponse.headers.get("content-type") || "";
      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
      contentType = allowedMimes.find((m) => rawContentType.startsWith(m)) ?? "image/jpeg";
      imageBuffer = await imgResponse.arrayBuffer();
    } catch (fetchErr: any) {
      console.error("Error fetching receipt image:", fetchErr);
      return NextResponse.json(
        { error: "Could not retrieve the receipt image. Please try re-uploading." },
        { status: 400 }
      );
    }

    // ── 5. Initialize Gemini and run extraction ──────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert financial document validator and data extractor.

STEP 1 — VALIDATION:
First, determine if this image is a bill, receipt, invoice, or any financial transaction document (printed or digital). 
A valid document must show at least: a merchant/store name OR a monetary amount OR itemised purchases.
Selfies, screenshots of apps/code, photos of people/objects/places, memes, QR codes without context, or any non-financial images are INVALID.

STEP 2 — EXTRACTION (only if valid):
If it IS a valid financial document, extract: merchant_name (string), total_amount (number, no currency symbols, no commas), date (ISO 8601 format YYYY-MM-DD), and category (exactly one of: Food, Transport, Medical, Education, Shopping, Entertainment, Utilities, Other).

Return ONLY a raw JSON object in this exact shape, no markdown, no code blocks:
{
  "is_receipt": true or false,
  "rejection_reason": "brief reason if is_receipt is false, else null",
  "merchant_name": "string or null",
  "total_amount": number or null,
  "date": "YYYY-MM-DD or null",
  "category": "string or null"
}`;

    const imagePart = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString("base64"),
        mimeType: contentType,
      },
    };

    let result;
    try {
      result = await model.generateContent([prompt, imagePart]);
    } catch (geminiErr: any) {
      console.error("Gemini API error:", geminiErr);
      const msg: string = geminiErr?.message || "";
      if (msg.includes("503") || msg.toLowerCase().includes("unavailable") || msg.toLowerCase().includes("high demand")) {
        return NextResponse.json(
          { error: "The AI service is temporarily busy. Please wait a moment and try again." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "AI processing failed. Please try again." }, { status: 500 });
    }

    const responseText = result.response.text().trim();

    // ── 6. Parse Gemini response ─────────────────────────────────────────────
    let jsonText = responseText;
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error("Failed to parse Gemini output. Raw output:", responseText);
      return NextResponse.json(
        { error: "Failed to extract data from receipt. Please try a clearer image." },
        { status: 422 }
      );
    }

    // ── 7. Reject non-receipts ───────────────────────────────────────────────
    if (!parsedData.is_receipt) {
      const reason = parsedData.rejection_reason || "This image does not appear to be a receipt or bill.";
      return NextResponse.json(
        { error: `Invalid image: ${reason} Please upload a photo of a receipt, bill, or invoice.` },
        { status: 422 }
      );
    }

    // ── 8. Validate and sanitize amount ─────────────────────────────────────
    let totalAmount = 0;
    const rawAmount = parsedData.total_amount;
    if (typeof rawAmount === "number" && !isNaN(rawAmount)) {
      totalAmount = rawAmount;
    } else if (typeof rawAmount === "string") {
      // Strip currency symbols, commas, spaces (handles ₹1,234.56 → 1234.56)
      const cleaned = rawAmount.replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        totalAmount = parsed;
      }
    }

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "Could not extract a valid amount from this receipt. Please enter it manually." },
        { status: 422 }
      );
    }

    // ── 9. Validate category is in the allowed list ──────────────────────────
    const ALLOWED_CATEGORIES = ["Food", "Transport", "Medical", "Education", "Shopping", "Entertainment", "Utilities", "Other"];
    const category = ALLOWED_CATEGORIES.includes(parsedData.category) ? parsedData.category : "Other";

    return NextResponse.json({
      merchant_name: (parsedData.merchant_name as string)?.trim() || "Unknown Merchant",
      total_amount: totalAmount,
      date: parsedData.date || new Date().toISOString().split("T")[0],
      category,
    });

  } catch (globalErr: any) {
    console.error("API error in /api/process-receipt:", globalErr);
    // Never leak internal error details to the client
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}

