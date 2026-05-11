import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

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

export async function GET() {
  try {
    const plaid = makePlaidClient();
    const accessToken = process.env.PLAID_ACCESS_TOKEN!;

    // Fetch accounts
    const accountsRes = await plaid.accountsGet({ access_token: accessToken });
    const accounts = accountsRes.data.accounts.map((a) => ({
      account_id: a.account_id,
      name: a.official_name ?? a.name,
      type: a.type,
      subtype: a.subtype ?? null,
      balance_current: a.balances.current ?? null,
      balance_available: a.balances.available ?? null,
      currency: a.balances.iso_currency_code ?? "USD",
    }));

    // Fetch liabilities — gracefully falls back if the token lacks the product
    let liabilities: {
      account_id: string;
      minimum_payment: number | null;
      next_payment_due_date: string | null;
      last_statement_balance: number | null;
      is_overdue: boolean | null;
    }[] = [];

    try {
      const liabRes = await plaid.liabilitiesGet({ access_token: accessToken });
      const credit = liabRes.data.liabilities.credit ?? [];
      liabilities = credit.map((c) => ({
        account_id: c.account_id ?? "",
        minimum_payment: c.minimum_payment_amount ?? null,
        next_payment_due_date: c.next_payment_due_date ?? null,
        last_statement_balance: c.last_statement_issue_date ? null : null,
        is_overdue: c.is_overdue ?? null,
      }));
    } catch {
      // liabilities product not available for this token — skip silently
    }

    // Merge liabilities onto credit accounts
    const liabByAccount = Object.fromEntries(liabilities.map((l) => [l.account_id, l]));
    const enriched = accounts.map((a) => ({
      ...a,
      liability: liabByAccount[a.account_id] ?? null,
    }));

    return Response.json({ accounts: enriched });
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { data?: unknown } };
    console.error("accounts error:", err?.message, err?.response?.data);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
