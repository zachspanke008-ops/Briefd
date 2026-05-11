import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BALANCE = 10_000;

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("transactions")
      .select("amount, name, category")
      .gte("date", cutoff);

    if (error) throw error;

    const transactions = (data ?? []).filter((t) => t.amount > 0);

    const total_spending = transactions.reduce((sum, t) => sum + t.amount, 0);
    const burn_rate = total_spending / 30;
    const runway_months = burn_rate > 0 ? BALANCE / burn_rate : null;

    // Top 5 categories by total spend
    const byCategory: Record<string, number> = {};
    for (const t of transactions) {
      const cat = t.category ?? "Uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amount;
    }
    const top5 = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amount]) => ({ category: cat, amount: Math.round(amount * 100) / 100 }));

    const prompt = `You are a concise financial analyst writing a daily briefing for a startup founder.

Here is the founder's financial data for the last 30 days:
- Total spending: $${total_spending.toFixed(2)}
- Daily burn rate: $${burn_rate.toFixed(2)}/day
- Runway: ${runway_months !== null ? `${runway_months.toFixed(1)} months` : "unknown"} (based on $${BALANCE.toLocaleString()} balance)
- Top 5 spending categories:
${top5.map((c, i) => `  ${i + 1}. ${c.category}: $${c.amount}`).join("\n")}

Write a short, plain-English daily briefing (3-4 sentences max). Include: burn rate, runway, top expense area, and one actionable insight. Be direct — no fluff, no headers, no bullet points. Write it as a single paragraph addressed to the founder.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const briefing = message.content[0].type === "text" ? message.content[0].text : "";

    return Response.json({ briefing, total_spending, burn_rate, runway_months, top5 });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("briefing error:", err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
