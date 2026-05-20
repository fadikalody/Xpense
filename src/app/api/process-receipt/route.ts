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

    // 3. Construct Gemini system prompt and request payload
    const prompt =
      "You are an expert financial data extractor. Analyze this receipt image and extract the following information into a strict JSON object: merchant_name (string), total_amount (number, no currency symbols), date (ISO 8601 format), and category (Must be exactly one of: Food, Transport, Medical, Education, Shopping, Entertainment, Utilities, Other). Return ONLY the raw JSON object, without markdown formatting or code blocks.";

    const imagePart = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString("base64"),
        mimeType: contentType,
      },
    };

    // 4. Generate content
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text().trim();

    // 5. Cleanse and parse Gemini response
    // Sometimes models add ```json ... ``` formatting even when explicitly told not to.
    let jsonText = responseText;
    if (jsonText.startsWith("```")) {
      // Strip starting code fences
      jsonText = jsonText.replace(/^```(?:json)?/i, "");
      // Strip ending code fences
      jsonText = jsonText.replace(/```$/i, "");
      jsonText = jsonText.trim();
    }

    try {
      const parsedData = JSON.parse(jsonText);

      // Ensure all standard fields exist
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
