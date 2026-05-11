"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function PlaidLink() {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => setLinkToken(data.link_token));
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    await fetch("/api/plaid/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken }),
    });
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken ?? "", onSuccess });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="px-6 py-2.5 border border-zinc-700 text-zinc-400 text-sm font-medium rounded-full hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      Connect your bank
    </button>
  );
}
