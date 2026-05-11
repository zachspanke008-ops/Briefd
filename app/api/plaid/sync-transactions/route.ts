import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { supabase } from "@/lib/supabase";

function makePlaidClient() {
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    })
  );
}

export async function POST() {
  try {
    const plaid = makePlaidClient();

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);

    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const response = await plaid.transactionsGet({
      access_token: process.env.PLAID_ACCESS_TOKEN!,
      start_date: fmt(startDate),
      end_date: fmt(now),
    });

    const transactions = response.data.transactions;

    const rows = transactions.map((t) => ({
      user_id: "user-sandbox",
      transaction_id: t.transaction_id,
      amount: t.amount,
      date: t.date,
      name: t.name,
      category: t.category?.[0] ?? null,
    }));

    const { error } = await supabase
      .from("transactions")
      .upsert(rows, { onConflict: "transaction_id" });

    if (error) throw error;

    return Response.json({ transactions });
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { data?: unknown } };
    console.error("sync-transactions error:", err?.message, err?.response?.data);
    return Response.json(
      { error: err?.message, plaid: err?.response?.data },
      { status: 500 }
    );
  }
}
