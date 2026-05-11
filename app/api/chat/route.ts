import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const { messages }: { messages: Message[] } = await request.json();

    // Fetch financial context from Supabase
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

    const { data } = await supabase
      .from("transactions")
      .select("name, amount, date")
      .gte("date", cutoff)
      .order("date", { ascending: false });

    const txns = (data ?? []).filter((t) => t.amount > 0);
    const total = txns.reduce((s, t) => s + t.amount, 0);
    const burn = total / 30;
    const runway = burn > 0 ? (10_000 / burn).toFixed(1) : "unknown";

    // Build merchant summary
    const byMerchant: Record<string, number> = {};
    for (const t of txns) {
      byMerchant[t.name] = (byMerchant[t.name] ?? 0) + t.amount;
    }
    const topMerchants = Object.entries(byMerchant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, amt]) => `  - ${name}: $${amt.toFixed(2)}`)
      .join("\n");

    const recentTxns = (data ?? [])
      .slice(0, 10)
      .map((t) => `  ${t.date}  ${t.name.padEnd(30)} $${t.amount.toFixed(2)}`)
      .join("\n");

    const systemPrompt = `You are a sharp financial advisor embedded in Briefd, a founder operating system. You have full access to the founder's financial data. Answer questions directly and concisely — no fluff, no disclaimers. If asked something outside the data, say so briefly.

FINANCIAL SUMMARY (last 30 days):
- Total spending: $${total.toFixed(2)}
- Daily burn rate: $${burn.toFixed(2)}/day
- Monthly burn rate: $${(burn * 30).toFixed(2)}/mo
- Runway: ${runway} months (based on $10,000 balance)
- Transactions: ${txns.length}

TOP MERCHANTS:
${topMerchants || "  No data"}

RECENT TRANSACTIONS:
${recentTxns || "  No data"}

Be direct. Use numbers. Max 3 sentences unless a detailed breakdown is needed.`;

    const reply = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: systemPrompt,
      messages,
    });

    const text = reply.content[0].type === "text" ? reply.content[0].text : "";
    return Response.json({ reply: text });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("chat error:", err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
