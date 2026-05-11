import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments ?? "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

export async function POST(request: Request) {
  const { public_token } = await request.json();

  const response = await plaid.itemPublicTokenExchange({ public_token });
  const accessToken = response.data.access_token;

  console.log("Plaid access token:", accessToken);

  return Response.json({ success: true });
}
