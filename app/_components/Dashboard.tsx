"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { Cormorant_Garamond } from "next/font/google";
import ChatPanel from "./ChatPanel";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["700"], style: ["italic"] });

type View = "dashboard" | "briefing" | "settings";

type Metrics = {
  gross_burn_rate: number;
  net_burn_rate: number;
  mrr: number;
  total_capital: number;
  runway_months: number | null;
  total_spending: number;
  transaction_count: number;
  avg_transaction: number;
  top_categories: { category: string; amount: number }[];
  burn_rate: number; // daily, kept for dropdown
};

type Analytics = {
  daily_spending: { date: string; amount: number }[];
  recurring: { name: string; avg_amount: number; next_date: string; occurrences: number }[];
  anomalies: { name: string; current: number; usual: number; multiplier: number }[];
};

type News = {
  stories: { title: string; url: string; score: number; time: number }[];
  market_context: string;
};

type FinancialProfile = {
  total_capital: string;
  funding_type: string;
  mrr: string;
  outstanding_loans: string;
  runway_target: string;
};

const DEFAULT_PROFILE: FinancialProfile = {
  total_capital: "",
  funding_type: "Bootstrapped",
  mrr: "",
  outstanding_loans: "",
  runway_target: "18",
};

const PROFILE_KEY = "briefd_financial_profile";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDec(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function todayLong() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}
function relTime(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function timeAgo(unix: number) {
  const h = Math.floor((Date.now() / 1000 - unix) / 3600);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function parseProfile(p: FinancialProfile) {
  const capital = parseFloat(p.total_capital) || 0;
  const loans = parseFloat(p.outstanding_loans) || 0;
  return {
    mrr: parseFloat(p.mrr) || 0,
    total_capital: capital + loans,
  };
}

function Pulse({ w = "w-24", h = "h-4", className = "" }: { w?: string; h?: string; className?: string }) {
  return <div className={`${w} ${h} rounded bg-zinc-800 animate-pulse ${className}`} />;
}

// ─── spending chart (SVG) ─────────────────────────────────────────────────────

function SpendingChart({ data }: { data: { date: string; amount: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = 90;
  const PAD_Y = 8;
  const maxAmt = Math.max(...data.map((d) => d.amount), 1);

  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: PAD_Y + (1 - d.amount / maxAmt) * (H - PAD_Y * 2),
    ...d,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.12" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cg)" />
        <path d={line} fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <rect key={i} x={p.x - W / data.length / 2} y={0} width={W / data.length} height={H}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <>
            <line x1={pts[hover].x} y1={0} x2={pts[hover].x} y2={H}
              stroke="white" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r="3.5" fill="white" />
          </>
        )}
      </svg>
      <div className="flex justify-between px-0 mt-1">
        <span className="text-zinc-700 text-xs">{shortDate(data[0].date)}</span>
        <span className="text-zinc-700 text-xs">{shortDate(data[Math.floor(data.length / 2)].date)}</span>
        <span className="text-zinc-700 text-xs">{shortDate(data[data.length - 1].date)}</span>
      </div>
      {hover !== null && pts[hover].amount > 0 && (
        <div
          className="absolute -top-8 pointer-events-none px-2 py-1 rounded-md bg-zinc-800 text-white text-xs whitespace-nowrap"
          style={{ left: `${(pts[hover].x / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          {shortDate(pts[hover].date)} · {fmtDec(pts[hover].amount)}
        </div>
      )}
    </div>
  );
}

// ─── root component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useUser();
  const [view, setView] = useState<View>("dashboard");
  const [mounted, setMounted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [metricsOpen, setMetricsOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [bankConnected, setBankConnected] = useState(false);

  const [financialProfile, setFinancialProfile] = useState<FinancialProfile>(DEFAULT_PROFILE);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [news, setNews] = useState<News | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setMounted(true);
    setBankConnected(localStorage.getItem("bankConnected") === "true");

    // Load financial profile first so metrics call uses it
    let profile = DEFAULT_PROFILE;
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      try { profile = { ...DEFAULT_PROFILE, ...JSON.parse(saved) }; } catch { /* ignore */ }
    }
    setFinancialProfile(profile);

    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json()).then((d) => setLinkToken(d.link_token)).catch(() => {});

    loadMetrics(profile);
    loadAnalytics();
    fetch("/api/news").then((r) => r.json()).then(setNews).catch(() => {}).finally(() => setNewsLoading(false));

    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!metricsOpen) return;
    function onDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMetricsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [metricsOpen]);

  function loadMetrics(profile?: FinancialProfile) {
    const p = profile ?? financialProfile;
    const { mrr, total_capital } = parseProfile(p);
    const params = new URLSearchParams({
      mrr: String(mrr),
      total_capital: String(total_capital),
    });
    setMetricsLoading(true);
    fetch(`/api/burn-rate?${params}`)
      .then((r) => r.json())
      .then((d) => { setMetrics(d); setMetricsLoading(false); })
      .catch(() => setMetricsLoading(false));
  }

  function loadAnalytics() {
    setAnalyticsLoading(true);
    fetch("/api/analytics").then((r) => r.json())
      .then((d) => { setAnalytics(d); setAnalyticsLoading(false); })
      .catch(() => setAnalyticsLoading(false));
  }

  function loadBriefing() {
    setBriefingLoading(true);
    setBriefingError(false);
    fetch("/api/briefing").then((r) => r.json())
      .then((d) => { setBriefing(d.briefing ?? null); setBriefingLoading(false); })
      .catch(() => { setBriefingLoading(false); setBriefingError(true); });
  }

  function navTo(v: View) {
    setView(v);
    setMetricsOpen(false);
  }

  function handleProfileSave(profile: FinancialProfile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setFinancialProfile(profile);
    loadMetrics(profile);
  }

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    await fetch("/api/plaid/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken }),
    });
    localStorage.setItem("bankConnected", "true");
    setBankConnected(true);
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken ?? "", onSuccess: onPlaidSuccess });

  async function handleSync() {
    setSyncing(true);
    setSyncDone(false);
    try {
      const res = await fetch("/api/plaid/sync-transactions", { method: "POST" });
      if (!res.ok) throw new Error();
      setLastSynced(new Date());
      setSyncDone(true);
      loadMetrics();
      loadAnalytics();
    } catch { /* no-op */ }
    finally { setSyncing(false); }
  }

  const firstName = user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const hasProfile = !!(financialProfile.total_capital || financialProfile.mrr);

  return (
    <div className="relative z-10 flex flex-col min-h-screen">

      {/* ── navbar ── */}
      <header ref={headerRef} className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-900">
        <nav className="flex items-center gap-1 px-8 h-14">
          <span className={`text-white text-2xl leading-none mr-5 ${cormorant.className}`}>Briefd</span>

          {(["dashboard", "briefing", "settings"] as View[]).map((v) => (
            <button key={v} onClick={() => navTo(v)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                view === v ? "text-white bg-zinc-800/80" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}

          <button onClick={() => setMetricsOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              metricsOpen ? "text-white bg-zinc-800/80" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Metrics
            <svg className={`w-3 h-3 transition-transform duration-200 ${metricsOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className="flex-1" />

          <button onClick={() => setChatOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors mr-2 ${
              chatOpen ? "text-white bg-zinc-800/80" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Chat
          </button>

          {email && <span className="text-zinc-600 text-xs hidden md:block">{email}</span>}
          <SignOutButton redirectUrl="/sign-in">
            <button className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors ml-3">Sign out</button>
          </SignOutButton>
        </nav>

        {/* metrics dropdown */}
        <div className={`overflow-hidden transition-all duration-300 ease-out border-zinc-900 ${
          metricsOpen ? "max-h-48 opacity-100 border-t" : "max-h-0 opacity-0"
        }`}>
          <div className="px-8 py-5 grid grid-cols-2 sm:grid-cols-3 gap-x-16 gap-y-4">
            {metricsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5"><Pulse w="w-28" h="h-3" /><Pulse w="w-20" h="h-5" /></div>
              ))
            ) : metrics ? (
              [
                { label: "Gross Burn",     value: fmt(metrics.gross_burn_rate) + "/mo" },
                { label: "Net Burn",       value: fmt(metrics.net_burn_rate) + "/mo" },
                { label: "MRR",            value: metrics.mrr > 0 ? fmt(metrics.mrr) + "/mo" : "—" },
                { label: "Runway",         value: metrics.runway_months != null ? `${metrics.runway_months.toFixed(1)} months` : "—" },
                { label: "Total Capital",  value: metrics.total_capital > 0 ? fmt(metrics.total_capital) : "—" },
                { label: "Transactions",   value: String(metrics.transaction_count) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-zinc-600 text-xs mb-0.5">{label}</p>
                  <p className="text-white text-sm font-medium tabular-nums">{value}</p>
                </div>
              ))
            ) : (
              <p className="text-zinc-600 text-sm col-span-3">No data — sync transactions first.</p>
            )}
          </div>
        </div>
      </header>

      {/* ── views ── */}
      {view === "dashboard" && (
        <DashboardView
          mounted={mounted}
          firstName={firstName}
          metrics={metrics}
          metricsLoading={metricsLoading}
          analytics={analytics}
          analyticsLoading={analyticsLoading}
          news={news}
          newsLoading={newsLoading}
          syncing={syncing}
          syncDone={syncDone}
          lastSynced={lastSynced}
          bankConnected={bankConnected}
          hasProfile={hasProfile}
          onSync={handleSync}
          onOpenPlaid={() => open()}
          plaidReady={ready}
          onGoSettings={() => navTo("settings")}
        />
      )}
      {view === "briefing" && (
        <BriefingView
          briefing={briefing}
          loading={briefingLoading}
          error={briefingError}
          onGenerate={loadBriefing}
          onBack={() => setView("dashboard")}
        />
      )}
      {view === "settings" && (
        <SettingsView
          email={email}
          profile={financialProfile}
          onSave={handleProfileSave}
        />
      )}

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

// ─── metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, loading, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
  accent?: "green" | "amber";
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-5 py-4 flex flex-col gap-1.5">
      <p className="text-zinc-600 text-xs uppercase tracking-widest">{label}</p>
      {loading ? (
        <Pulse w="w-28" h="h-7" />
      ) : (
        <p className={`text-2xl font-semibold tabular-nums leading-none ${
          accent === "green" ? "text-green-400" : accent === "amber" ? "text-amber-400" : "text-white"
        }`}>
          {value}
        </p>
      )}
      {sub && <p className="text-zinc-700 text-xs">{sub}</p>}
    </div>
  );
}

// ─── dashboard view ───────────────────────────────────────────────────────────

function DashboardView({
  mounted, firstName, metrics, metricsLoading,
  analytics, analyticsLoading, news, newsLoading,
  syncing, syncDone, lastSynced, bankConnected, hasProfile,
  onSync, onOpenPlaid, plaidReady, onGoSettings,
}: {
  mounted: boolean;
  firstName: string;
  metrics: Metrics | null;
  metricsLoading: boolean;
  analytics: Analytics | null;
  analyticsLoading: boolean;
  news: News | null;
  newsLoading: boolean;
  syncing: boolean;
  syncDone: boolean;
  lastSynced: Date | null;
  bankConnected: boolean;
  hasProfile: boolean;
  onSync: () => void;
  onOpenPlaid: () => void;
  plaidReady: boolean;
  onGoSettings: () => void;
}) {
  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">

      {/* welcome */}
      <div>
        <h1 className="text-white text-3xl font-semibold tracking-tight">
          {mounted ? greeting() : "Welcome"}{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="text-zinc-500 text-sm mt-1">{mounted ? todayLong() : ""}</p>
      </div>

      {/* anomaly alerts */}
      {analytics && analytics.anomalies.length > 0 && (
        <div className="flex flex-col gap-2">
          {analytics.anomalies.map((a) => (
            <div key={a.name} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-900/60 bg-amber-950/30">
              <span className="text-amber-400 text-base">⚠</span>
              <p className="text-amber-200/80 text-sm">
                <span className="font-medium">{a.name}</span> is{" "}
                <span className="font-medium">{a.multiplier.toFixed(1)}×</span> above your usual spend this week
                {a.usual > 0 && ` (${fmtDec(a.current)} vs typical ${fmtDec(a.usual)})`}.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* metric cards */}
      {!hasProfile && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/50">
          <p className="text-zinc-500 text-sm flex-1">
            Add your capital raised and MRR in Settings for accurate net burn and runway.
          </p>
          <button onClick={onGoSettings}
            className="shrink-0 text-xs text-zinc-400 border border-zinc-700 px-3 py-1.5 rounded-full hover:border-zinc-500 hover:text-zinc-200 transition-colors">
            Set up →
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Net Burn"
          value={metrics ? fmt(metrics.net_burn_rate) + "/mo" : "—"}
          sub="spending minus revenue"
          loading={metricsLoading}
        />
        <MetricCard
          label="Gross Burn"
          value={metrics ? fmt(metrics.gross_burn_rate) + "/mo" : "—"}
          sub="raw spending"
          loading={metricsLoading}
        />
        <MetricCard
          label="MRR"
          value={metrics?.mrr ? fmt(metrics.mrr) + "/mo" : "—"}
          sub="monthly revenue"
          loading={metricsLoading}
          accent={metrics?.mrr ? "green" : undefined}
        />
        <MetricCard
          label="Runway"
          value={metrics?.runway_months != null ? `${metrics.runway_months.toFixed(1)} mo` : "—"}
          sub="at net burn rate"
          loading={metricsLoading}
          accent={
            metrics?.runway_months != null
              ? metrics.runway_months < 6 ? "amber" : undefined
              : undefined
          }
        />
        <MetricCard
          label="Capital"
          value={metrics?.total_capital ? fmt(metrics.total_capital) : "—"}
          sub="raised + credit"
          loading={metricsLoading}
        />
      </div>

      {/* cash flow chart */}
      <section>
        <h2 className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Cash Flow · 30 Days</h2>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-5 pt-5 pb-4">
          {analyticsLoading ? (
            <div className="h-28 flex items-center justify-center">
              <Pulse w="w-full" h="h-full" className="rounded-xl" />
            </div>
          ) : analytics?.daily_spending ? (
            <SpendingChart data={analytics.daily_spending} />
          ) : (
            <p className="text-zinc-600 text-sm py-8 text-center">No data — sync transactions to see cash flow.</p>
          )}
        </div>
      </section>

      {/* top expenses + bills predictor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Top Expenses</h2>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 overflow-hidden">
            {metricsLoading ? (
              <div className="divide-y divide-zinc-900">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3.5">
                    <Pulse w="w-32" /><Pulse w="w-14" />
                  </div>
                ))}
              </div>
            ) : metrics?.top_categories?.length ? (
              <div className="divide-y divide-zinc-900">
                {metrics.top_categories.map((cat, i) => (
                  <div key={cat.category} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-700 text-xs w-4 text-right tabular-nums">{i + 1}</span>
                      <span className="text-zinc-300 text-sm">{cat.category}</span>
                    </div>
                    <span className="text-white text-sm font-medium tabular-nums">{fmtDec(cat.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-5 text-zinc-600 text-sm">No transactions yet.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Upcoming Bills</h2>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 overflow-hidden">
            {analyticsLoading ? (
              <div className="divide-y divide-zinc-900">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex flex-col gap-1.5"><Pulse w="w-28" /><Pulse w="w-20" h="h-3" /></div>
                    <Pulse w="w-14" />
                  </div>
                ))}
              </div>
            ) : analytics?.recurring?.length ? (
              <div className="divide-y divide-zinc-900">
                {analytics.recurring.map((r) => (
                  <div key={r.name} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-zinc-300 text-sm">{r.name}</p>
                      <p className="text-zinc-600 text-xs mt-0.5">Next: {shortDate(r.next_date)}</p>
                    </div>
                    <span className="text-white text-sm font-medium tabular-nums">{fmtDec(r.avg_amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-5 text-zinc-600 text-sm">No recurring patterns detected.</p>
            )}
          </div>
        </section>
      </div>

      {/* news */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Founder News</h2>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 overflow-hidden divide-y divide-zinc-900">
            {newsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 flex flex-col gap-1.5"><Pulse w="w-full" /><Pulse w="w-3/4" h="h-3" /></div>
              ))
            ) : news?.stories?.length ? (
              news.stories.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-zinc-900/60 transition-colors group">
                  <div className="min-w-0">
                    <p className="text-zinc-300 text-sm leading-snug group-hover:text-white transition-colors line-clamp-2">{s.title}</p>
                    <p className="text-zinc-600 text-xs mt-1">{timeAgo(s.time)} · {s.score} pts</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))
            ) : (
              <p className="px-5 py-5 text-zinc-600 text-sm">Could not load news.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-zinc-500 text-xs uppercase tracking-widest mb-3">Market Context</h2>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-5 py-5 h-full">
            {newsLoading ? (
              <div className="flex flex-col gap-2.5"><Pulse w="w-full" /><Pulse w="w-11/12" /><Pulse w="w-3/4" /></div>
            ) : news?.market_context ? (
              <p className="text-zinc-300 text-sm leading-7">{news.market_context}</p>
            ) : (
              <p className="text-zinc-600 text-sm">Could not load market context.</p>
            )}
            <p className="text-zinc-700 text-xs mt-4">Based on Claude&apos;s training data · not real-time</p>
          </div>
        </section>
      </div>

      {/* actions */}
      <section className="flex items-center gap-4 flex-wrap pt-2">
        <div className="flex flex-col gap-1">
          <button onClick={onSync} disabled={syncing}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              syncDone ? "border-zinc-600 text-zinc-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {syncing ? "Syncing…" : syncDone
              ? <><span>Synced</span><span className="text-green-400">✓</span></>
              : "Sync Transactions"}
          </button>
          {mounted && lastSynced && <p className="text-zinc-600 text-xs pl-1">Last synced {relTime(lastSynced)}</p>}
        </div>

        {mounted && (bankConnected ? (
          <span className="flex items-center gap-1.5 text-sm text-zinc-500">
            <span className="text-green-400">✓</span> Bank Connected
          </span>
        ) : (
          <button onClick={onOpenPlaid} disabled={!plaidReady}
            className="px-5 py-2.5 border border-zinc-700 text-zinc-400 text-sm font-medium rounded-full hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Connect Bank
          </button>
        ))}
      </section>
    </main>
  );
}

// ─── briefing view ────────────────────────────────────────────────────────────

function BriefingView({
  briefing, loading, error, onGenerate, onBack,
}: {
  briefing: string | null;
  loading: boolean;
  error: boolean;
  onGenerate: () => void;
  onBack: () => void;
}) {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 text-sm hover:text-zinc-300 transition-colors w-fit">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-white text-3xl font-semibold tracking-tight">Your Daily Briefing</h1>
          <p className="text-zinc-500 text-sm mt-1">{todayLong()}</p>
        </div>
        <button onClick={onGenerate} disabled={loading}
          className="shrink-0 mt-1 px-4 py-2 border border-zinc-700 text-zinc-400 text-sm rounded-full hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
          {loading ? (
            <><span className="w-3 h-3 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin inline-block" />Generating…</>
          ) : briefing ? "Refresh Briefing" : "Generate Briefing"}
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-8 py-8 min-h-48">
        {loading ? (
          <div className="flex flex-col gap-3.5">
            {["100%", "92%", "84%", "60%"].map((w) => (
              <div key={w} className="h-4 rounded bg-zinc-800 animate-pulse" style={{ width: w }} />
            ))}
          </div>
        ) : error ? (
          <p className="text-zinc-600 text-sm">Could not generate briefing. Sync transactions first, then try again.</p>
        ) : briefing ? (
          <p className="text-zinc-200 text-base leading-8">{briefing}</p>
        ) : (
          <div className="flex flex-col items-center justify-center h-32">
            <p className="text-zinc-600 text-sm">Click &ldquo;Generate Briefing&rdquo; to get your daily AI summary.</p>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── settings view ────────────────────────────────────────────────────────────

function SettingsView({
  email, profile, onSave,
}: {
  email: string;
  profile: FinancialProfile;
  onSave: (p: FinancialProfile) => void;
}) {
  const [form, setForm] = useState<FinancialProfile>(profile);
  const [saved, setSaved] = useState(false);

  // Sync if parent profile changes (e.g. first load)
  useEffect(() => { setForm(profile); }, [profile]);

  function set(key: keyof FinancialProfile, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors";
  const labelCls = "text-zinc-500 text-xs uppercase tracking-widest mb-1.5 block";

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">
      <h1 className="text-white text-3xl font-semibold tracking-tight">Account Settings</h1>

      {/* Financial Profile */}
      <div className="flex flex-col gap-1">
        <h2 className="text-white text-base font-medium">Financial Profile</h2>
        <p className="text-zinc-500 text-sm">Used to calculate net burn and runway across the dashboard.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-6 py-6 flex flex-col gap-5">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Total Capital Raised ($)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 500000"
              value={form.total_capital}
              onChange={(e) => set("total_capital", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Funding Stage</label>
            <select
              value={form.funding_type}
              onChange={(e) => set("funding_type", e.target.value)}
              className={`${inputCls} appearance-none cursor-pointer`}
            >
              {["Bootstrapped", "Pre-seed", "Seed", "Series A+"].map((s) => (
                <option key={s} value={s} className="bg-zinc-900">{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Monthly Recurring Revenue / MRR ($)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 12000"
              value={form.mrr}
              onChange={(e) => set("mrr", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Outstanding Loans / Credit Lines ($)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 50000"
              value={form.outstanding_loans}
              onChange={(e) => set("outstanding_loans", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="sm:w-1/2">
          <label className={labelCls}>Runway Target (months)</label>
          <input
            type="number"
            min="1"
            max="60"
            placeholder="e.g. 18"
            value={form.runway_target}
            onChange={(e) => set("runway_target", e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-zinc-200 transition-colors"
          >
            Save Profile
          </button>
          {saved && <span className="text-green-400 text-sm">Saved ✓</span>}
        </div>
      </div>

      {/* Account info */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 divide-y divide-zinc-900">
        <div className="px-6 py-5">
          <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Email</p>
          <p className="text-zinc-200 text-sm">{email || "—"}</p>
        </div>

        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-zinc-200 text-sm font-medium">Disconnect Bank</p>
            <p className="text-zinc-600 text-xs mt-0.5">Remove your linked bank account</p>
          </div>
          <button className="px-4 py-2 text-sm border border-zinc-700 text-zinc-400 rounded-full hover:border-zinc-500 hover:text-zinc-200 transition-colors">
            Disconnect
          </button>
        </div>

        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-red-400 text-sm font-medium">Delete My Data</p>
            <p className="text-zinc-600 text-xs mt-0.5">Permanently delete all transactions and account data</p>
          </div>
          <button className="px-4 py-2 text-sm border border-red-900 text-red-500 rounded-full hover:border-red-700 hover:text-red-400 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </main>
  );
}
