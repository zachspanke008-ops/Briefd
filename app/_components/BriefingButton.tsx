"use client";

import { useState } from "react";

type BriefingData = {
  briefing: string;
  total_spending: number;
  burn_rate: number;
  runway_months: number | null;
};

export default function BriefingButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [data, setData] = useState<BriefingData | null>(null);

  async function handleBriefing() {
    setStatus("loading");
    setData(null);
    try {
      const res = await fetch("/api/briefing");
      if (!res.ok) throw new Error("request failed");
      const json = await res.json();
      setData(json);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 max-w-sm w-full">
      <button
        onClick={handleBriefing}
        disabled={status === "loading"}
        className="px-6 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Generating…" : "Get My Briefing"}
      </button>

      {status === "done" && data && (
        <div className="mt-2 px-5 py-4 border border-zinc-800 rounded-2xl bg-zinc-950 text-left w-full">
          <p className="text-zinc-300 text-sm leading-relaxed">{data.briefing}</p>
          <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-4 text-xs text-zinc-600">
            <span>${data.burn_rate.toFixed(0)}/day burn</span>
            <span>
              {data.runway_months !== null
                ? `${data.runway_months.toFixed(1)} mo runway`
                : "runway unknown"}
            </span>
          </div>
        </div>
      )}

      {status === "error" && (
        <span className="text-xs text-red-500">Failed to generate briefing — try again</span>
      )}
    </div>
  );
}
