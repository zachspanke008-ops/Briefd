"use client";

import { useState } from "react";

export default function SyncButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSync() {
    setStatus("loading");
    try {
      const res = await fetch("/api/plaid/sync-transactions", { method: "POST" });
      if (!res.ok) throw new Error("sync failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="px-6 py-2.5 border border-zinc-700 text-zinc-400 text-sm font-medium rounded-full hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Syncing…" : "Sync Transactions"}
      </button>
      {status === "done" && (
        <span className="text-xs text-zinc-500">Transactions synced</span>
      )}
      {status === "error" && (
        <span className="text-xs text-red-500">Sync failed — try again</span>
      )}
    </div>
  );
}
