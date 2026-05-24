import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured in the server environment variables." },
        { status: 500 }
      );
    }

    // 1. Verify user session via hybrid token/cookie validation
    let user = null;
    let supabase = null;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const tokenSupabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await tokenSupabase.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
        supabase = tokenSupabase;
      }
    }

    if (!user) {
      const cookieSupabase = await createClient();
      const { data, error } = await cookieSupabase.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
        supabase = cookieSupabase;
      }
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await req.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing parameter: message" }, { status: 400 });
    }

    // 3 & 4. Fetch transactions + budgets in parallel — independent queries, no need to serialize
    const [
      { data: txData, error: txError },
      { data: bgData, error: bgError },
    ] = await Promise.all([
      supabase
        .from("transactions")
        .select("type, amount, merchant_name, category, date")
        .eq("user_id", user.id)
        .order("date", { ascending: false }),
      supabase
        .from("budgets")
        .select("category, monthly_limit, month_year")
        .eq("user_id", user.id),
    ]);

    if (txError) {
      console.error("Error fetching transactions for RAG:", txError);
      return NextResponse.json({ error: "Failed to retrieve ledger context" }, { status: 500 });
    }

    if (bgError) {
      console.error("Error fetching budgets for RAG:", bgError);
      return NextResponse.json({ error: "Failed to retrieve budget limits context" }, { status: 500 });
    }

    // 5. Compile ledger context JSON strings
    const transactionsContext = (txData || []).map((t) => ({
      type: t.type,
      amount: parseFloat(t.amount.toString()),
      merchant: t.merchant_name,
      category: t.category,
      date: t.date.split("T")[0],
    }));

    const budgetsContext = (bgData || []).map((b) => ({
      category: b.category,
      monthly_limit: parseFloat(b.monthly_limit.toString()),
      month_year: b.month_year.substring(0, 7),
    }));

    const currentDateString = new Date().toISOString().split("T")[0];

    // 6. Establish the system context instruction
    const systemInstruction = `You are Xpense AI Assistant, a professional financial planner and data science analysis tool integrated directly within the Xpense PWA.
You have secure, read-only access to the user's financial database to provide precise, mathematical answers to their ledger queries.

=== USER DATABASE CONTEXT ===

=== LEDGER TRANSACTIONS ===
${JSON.stringify(transactionsContext, null, 2)}

=== ACTIVE MONTHLY BUDGET LIMITS ===
${JSON.stringify(budgetsContext, null, 2)}

=== CURRENT TIME ===
Today is ${currentDateString} (UTC)

=== COMPLIANCE & BEHAVIOR GUIDELINES ===
- Base all calculations, averages, and lists strictly on the provided JSON transaction logs.
- If the user asks about a merchant, search case-insensitively (e.g. "Starbucks", "starbucks", or partial matches) in the transaction lists.
- If they ask "How much did I spend at Starbucks in May?", find all transactions of type "expense" where merchant contains "Starbucks" and the date is in "2026-05" (or matching year/month specified) and sum their amounts.
- **ENHANCED RESULT FORMATTING**:
  - Always reply with premium, high-fidelity financial insights.
  - When comparing spending across periods (e.g. week-over-week, month-over-month), present a clean Markdown table comparing the totals, merchant transaction count, and relative percentage changes.
  - If a period has ₹0 spend, note the increase or decrease analytically (e.g. "from ₹0 to ₹4,568, representing a new spending block this week").
  - Identify and list the top transaction or merchant that drove the expense (e.g. "Your largest Food transaction was ₹1,200 at Starbucks on May 20").
  - Provide actionable, customized financial coaching suggestions (e.g. "Since you spent ₹4,568 on Food this week, which is 90% of your ₹5,000 monthly budget limit, we recommend cooking at home for the remaining days of the month").
  - Use tables, highlights, clean bullet lists, and appropriate emoji decorators (e.g., ⚠️, 📈, 📉, 💳, 🛒) to create a visual masterpiece.
- Keep tone professional, supportive, and helpful.
- If asked about items that are not present in their ledger or completely unrelated general topics (like writing code, general knowledge trivia, etc.), politely guide them back to their personal finances.`;

    // 7. Initialise Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
    });

    // 8. Reconstruct history formatting for Gemini SDK
    // Gemini SDK requires history structure: { role: 'user'|'model', parts: [{ text: string }] }
    let formattedHistory = history.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Defensive check: Ensure history starts with 'user' message as required by Gemini SDK
    while (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
      formattedHistory.shift();
    }

    // 9. Process conversation response
    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });

  } catch (err: any) {
    console.error("API error in assistant chat:", err);
    return NextResponse.json(
      { error: `Internal Server Error: ${err.message}` },
      { status: 500 }
    );
  }
}
