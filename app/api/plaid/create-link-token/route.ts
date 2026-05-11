import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

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

    const response = await plaid.linkTokenCreate({
      user: { client_user_id: "user-sandbox" },
      client_name: "Briefd",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return Response.json({ link_token: response.data.link_token });
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    console.error("Plaid create-link-token error:");
    console.error("  message:", axiosError?.message);
    console.error("  status:", axiosError?.response?.status);
    console.error("  data:", JSON.stringify(axiosError?.response?.data, null, 2));

    return Response.json(
      { error: axiosError?.message, plaid: axiosError?.response?.data },
      { status: 500 }
    );
  }
}
