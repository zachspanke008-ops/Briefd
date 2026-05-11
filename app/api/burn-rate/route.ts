import { supabase } from "@/lib/supabase";

const BALANCE = 10_000;

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("transactions")
      .select("amount")
      .gte("date", cutoff);

    if (error) throw error;

    const total_spending = (data ?? [])
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const burn_rate = total_spending / 30;
    const runway_months = burn_rate > 0 ? BALANCE / burn_rate : null;

    return Response.json({ total_spending, burn_rate, runway_months });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("burn-rate error:", err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
