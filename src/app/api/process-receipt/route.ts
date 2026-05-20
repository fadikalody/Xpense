import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured in the server environment variables." },
        { status: 500 }
      );
    }

    const { imageUrl } = await request.json();
    if (!imageUrl) {
      return NextResponse.json({ error: "Missing required parameter: imageUrl" }, { status: 400 });
    }

    // 1. Fetch image from Supabase public URL
    let imageBuffer: ArrayBuffer;
    let contentType = "image/jpeg"; // fallback

    try {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch image. Status: ${imgResponse.status}`);
      }
      contentType = imgResponse.headers.get("content-type") || "image/jpeg";
      imageBuffer = await imgResponse.arrayBuffer();
    } catch (fetchErr: any) {
      console.error("Error fetching receipt image from URL:", fetchErr);
      return NextResponse.json(
        { error: `Could not retrieve the uploaded receipt image from Supabase Storage: ${fetchErr.message}` },
        { status: 400 }
      );
    }

    // 2. Initialize Gemini API and model
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. Construct Gemini prompt — VALIDATE first, then extract
    const prompt = `You are an expert financial document validator and data extractor.

STEP 1 — VALIDATION:
First, determine if this image is a bill, receipt, invoice, or any financial transaction document (printed or digital). 
A valid document must show at least: a merchant/store name OR a monetary amount OR itemised purchases.
Selfies, screenshots of apps/code, photos of people/objects/places, memes, QR codes without context, or any non-financial images are INVALID.

STEP 2 — EXTRACTION (only if valid):
If it IS a valid financial document, extract: merchant_name (string), total_amount (number, no currency symbols), date (ISO 8601 format YYYY-MM-DD), and category (exactly one of: Food, Transport, Medical, Education, Shopping, Entertainment, Utilities, Other).

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

    // 4. Generate content
    let result;
    try {
      result = await model.generateContent([prompt, imagePart]);
    } catch (geminiErr: any) {
      console.error("Gemini API error:", geminiErr);
      // Check for overload/rate limit
      const msg: string = geminiErr?.message || "";
      if (msg.includes("503") || msg.toLowerCase().includes("unavailable") || msg.toLowerCase().includes("high demand")) {
        return NextResponse.json(
          { error: "The AI service is temporarily busy. Please wait a moment and try again." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "The AI service encountered an error. Please try again." },
        { status: 500 }
      );
    }
    const responseText = result.response.text().trim();

    // 5. Cleanse and parse Gemini response
    let jsonText = responseText;
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?/i, "");
      jsonText = jsonText.replace(/```$/i, "");
      jsonText = jsonText.trim();
    }

    try {
      const parsedData = JSON.parse(jsonText);

      // 6. Reject non-receipts
      if (!parsedData.is_receipt) {
        const reason = parsedData.rejection_reason || "This image does not appear to be a receipt or bill.";
        return NextResponse.json(
          { error: `Invalid image: ${reason} Please upload a photo of a receipt, bill, or invoice.` },
          { status: 422 }
        );
      }

      // 7. Ensure all standard fields exist
      const formattedResponse = {
        merchant_name: parsedData.merchant_name || "Unknown Merchant",
        total_amount: typeof parsedData.total_amount === "number" ? parsedData.total_amount : parseFloat(parsedData.total_amount) || 0,
        date: parsedData.date || new Date().toISOString().split("T")[0],
        category: parsedData.category || "Other"
      };

      return NextResponse.json(formattedResponse);
    } catch (parseErr) {
      console.error("Failed to parse Gemini output as JSON. Raw output was:", responseText);
      return NextResponse.json(
        {
          error: "Failed to extract structured data from receipt. The model response was not valid JSON.",
          rawOutput: responseText,
        },
        { status: 422 }
      );
    }
  } catch (globalErr: any) {
    console.error("API error in /api/process-receipt:", globalErr);
    return NextResponse.json(
      { error: `Internal Server Error: ${globalErr.message}` },
      { status: 500 }
    );
  }
}
