import { supabase } from "@/lib/supabase";

function cleanName(raw: string): string {
  return (
    raw
      .replace(/\s+\d{6,}.*$/i, "")
      .replace(/[*/]+.*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim() || raw.trim()
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mrr = Math.max(0, parseFloat(url.searchParams.get("mrr") ?? "0") || 0);
    const total_capital = Math.max(0, parseFloat(url.searchParams.get("total_capital") ?? "0") || 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("transactions")
      .select("amount, category, name")
      .gte("date", cutoff);

    if (error) throw error;

    const positive = (data ?? []).filter((t) => t.amount > 0);

    const total_spending = positive.reduce((sum, t) => sum + t.amount, 0);

    // Monthly figures — gross is raw spending, net subtracts MRR
    const gross_burn_rate = total_spending;
    const net_burn_rate = Math.max(0, gross_burn_rate - mrr);

    // Runway uses net burn; fall back to 10 000 if no capital provided
    const balance = total_capital > 0 ? total_capital : 10_000;
    const runway_months = net_burn_rate > 0 ? balance / net_burn_rate : null;

    const transaction_count = positive.length;
    const avg_transaction = transaction_count > 0 ? total_spending / transaction_count : 0;

    // Group by merchant name (category is null in Plaid sandbox)
    const byLabel: Record<string, number> = {};
    for (const t of positive) {
      const label = t.category ?? cleanName(t.name);
      byLabel[label] = (byLabel[label] ?? 0) + t.amount;
    }
    const top_categories = Object.entries(byLabel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    return Response.json({
      gross_burn_rate,
      net_burn_rate,
      mrr,
      total_capital: balance,
      runway_months,
      total_spending,
      transaction_count,
      avg_transaction,
      top_categories,
      // daily figure kept for backward compat
      burn_rate: total_spending / 30,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("burn-rate error:", err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
