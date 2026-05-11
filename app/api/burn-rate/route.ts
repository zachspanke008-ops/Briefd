import { supabase } from "@/lib/supabase";

const BALANCE = 10_000;

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("transactions")
      .select("amount, category")
      .gte("date", cutoff);

    if (error) throw error;

    const positive = (data ?? []).filter((t) => t.amount > 0);

    const total_spending = positive.reduce((sum, t) => sum + t.amount, 0);
    const burn_rate = total_spending / 30;
    const runway_months = burn_rate > 0 ? BALANCE / burn_rate : null;
    const transaction_count = positive.length;
    const avg_transaction = transaction_count > 0 ? total_spending / transaction_count : 0;

    const byCategory: Record<string, number> = {};
    for (const t of positive) {
      const cat = t.category ?? "Uncategorized";
      byCategory[cat] = (byCategory[cat] ?? 0) + t.amount;
    }
    const top_categories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    return Response.json({
      total_spending,
      burn_rate,
      runway_months,
      transaction_count,
      avg_transaction,
      top_categories,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("burn-rate error:", err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
