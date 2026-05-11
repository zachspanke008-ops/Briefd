import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const KEYWORDS = [
  "startup", "founder", "venture", "funding", "seed", "series",
  "vc ", " vc", "raise", "valuation", "acquisition", "merger",
  "ai ", "saas", "fintech", "layoff", "ipo", "unicorn",
  "interest rate", "inflation", "federal reserve", "economic",
];

function isRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return KEYWORDS.some((kw) => lower.includes(kw));
}

type HNItem = {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  type?: string;
};

const cache: { ts: number; data: unknown } = { ts: 0, data: null };
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  try {
    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
      return Response.json(cache.data);
    }

    // Fetch HackerNews top stories
    const idsRes = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { next: { revalidate: 1800 } }
    );
    const ids: number[] = await idsRes.json();

    const items = await Promise.all(
      ids.slice(0, 40).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then((r) => r.json() as Promise<HNItem>)
          .catch(() => null)
      )
    );

    const stories = items
      .filter((item): item is HNItem =>
        item !== null &&
        item.type === "story" &&
        !!item.title &&
        !!item.url &&
        isRelevant(item.title)
      )
      .slice(0, 5)
      .map((item) => ({
        title: item.title!,
        url: item.url!,
        score: item.score ?? 0,
        time: item.time ?? 0,
      }));

    // Market context from Claude
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: `You are a financial news analyst briefing a startup founder. Write exactly 2 sentences summarising the current macro environment relevant to burn rate decisions — covering VC funding climate and interest rate environment. Be specific and factual based on your training data. Do not say "as of my knowledge cutoff" or add caveats. Today is ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
        },
      ],
    });

    const market_context =
      msg.content[0].type === "text" ? msg.content[0].text : "";

    const result = { stories, market_context };
    cache.ts = Date.now();
    cache.data = result;

    return Response.json(result);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("news error:", err?.message);
    return Response.json({ error: err?.message }, { status: 500 });
  }
}
