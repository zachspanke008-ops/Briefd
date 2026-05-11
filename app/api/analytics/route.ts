import { supabase } from "@/lib/supabase";

function cleanName(raw: string): string {
  return raw
    .replace(/\s+\d{6,}.*$/i, "")   // strip trailing date codes (Uber 072515 SF**)
    .replace(/[*/]+.*$/, "")          // strip after * or /
    .replace(/\s{2,}/g, " ")
    .trim()
    || raw.trim();
}

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("transactions")
      .select("name, amount, date")
      .gte("date", cutoff);

    if (error) throw error;

    const all = data ?? [];
    const positive = all.filter((t) => t.amount > 0);

    // ── daily spending (30 days, oldest→newest) ──────────────────────────────
    const byDate: Record<string, number> = {};
    for (const t of positive) {
      byDate[t.date] = (byDate[t.date] ?? 0) + t.amount;
    }
    const daily_spending = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const date = d.toISOString().split("T")[0];
      return { date, amount: byDate[date] ?? 0 };
    });

    // ── recurring (merchants appearing 2+ times) ─────────────────────────────
    const byMerchant: Record<string, { raw: string; amount: number; date: string }[]> = {};
    for (const t of positive) {
      const key = cleanName(t.name).toLowerCase();
      if (!byMerchant[key]) byMerchant[key] = [];
      byMerchant[key].push({ raw: cleanName(t.name), amount: t.amount, date: t.date });
    }
    const recurring = Object.values(byMerchant)
      .filter((txns) => txns.length >= 2)
      .map((txns) => {
        const avg_amount = txns.reduce((s, t) => s + t.amount, 0) / txns.length;
        const last = txns.sort((a, b) => b.date.localeCompare(a.date))[0];
        const next = new Date(last.date);
        next.setDate(next.getDate() + 30);
        return {
          name: last.raw,
          avg_amount,
          next_date: next.toISOString().split("T")[0],
          occurrences: txns.length,
        };
      })
      .sort((a, b) => b.avg_amount - a.avg_amount)
      .slice(0, 6);

    // ── anomalies (last 7d vs prior 23d normalised to 7d) ────────────────────
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenCutoff = sevenDaysAgo.toISOString().split("T")[0];

    const recent: Record<string, number> = {};
    const prior: Record<string, number> = {};
    for (const t of positive) {
      const key = cleanName(t.name);
      if (t.date >= sevenCutoff) {
        recent[key] = (recent[key] ?? 0) + t.amount;
      } else {
        prior[key] = (prior[key] ?? 0) + t.amount;
      }
    }
    const anomalies = Object.entries(recent)
      .map(([name, recentAmt]) => {
        const priorAmt = prior[name] ?? 0;
        const priorPer7 = (priorAmt / 23) * 7;
        const multiplier = priorPer7 > 1 ? recentAmt / priorPer7 : 0;
        return { name, current: recentAmt, usual: priorPer7, multiplier };
      })
      .filter((a) => a.multiplier >= 2.5)
      .sort((a, b) => b.multiplier - a.multiplier);

    return Response.json({ daily_spending, recurring, anomalies, today, cutoff });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("analytics error:", err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
