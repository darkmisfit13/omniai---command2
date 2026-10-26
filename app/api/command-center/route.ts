import { authorizeUser, isUserSession, json } from "@/lib/generation/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const SYSTEMS = [
  { id: "chat", label: "Chat", to: "/", match: /chat|text|prompt|enhance/i },
  { id: "image", label: "Images", to: "/studio/assets", match: /image|photo/i },
  { id: "video", label: "Video", to: "/editor", match: /video|film|clip|render/i },
  { id: "music", label: "Music & Voice", to: "/music", match: /music|audio|voice|song/i },
  { id: "web", label: "Websites", to: "/website", match: /website|site/i },
  { id: "pulse", label: "Pulse", to: "/pulse", match: /pulse|music.?video/i },
] as const;

type QueryResult<T> = { data: T | null; error?: unknown; count?: number | null };
type Settled<T> = PromiseSettledResult<QueryResult<T>>;

function querySucceeded<T>(result: Settled<T>): result is PromiseFulfilledResult<QueryResult<T>> {
  return result.status === "fulfilled" && !result.value.error;
}

function queryData<T>(result: Settled<T>): T | null {
  return querySucceeded(result) ? result.value.data : null;
}

export async function GET(request: Request) {
  const session = await authorizeUser(request);
  if (!isUserSession(session)) return session;

  const now = Date.now();
  const dayAgo = new Date(now - DAY).toISOString();
  const hourAgo = new Date(now - HOUR).toISOString();

  const [assets, alerts, conversations, messages, balance, history, projects] =
    await Promise.allSettled([
      session.client.from("media_assets").select("kind, provider, created_at, size_bytes", { count: "exact" }).gte("created_at", dayAgo).limit(2000),
      session.client.from("provider_alerts").select("pipeline, provider, reason, created_at", { count: "exact" }).gte("created_at", dayAgo).limit(200),
      session.client.from("conversations").select("created_at", { count: "exact" }).gte("created_at", dayAgo).limit(500),
      session.client.from("messages").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
      session.client.rpc("omni_credit_balance"),
      session.client.rpc("omni_credit_history", { p_limit: 200 }),
      session.client.from("editor_projects").select("created_at", { count: "exact" }).gte("created_at", dayAgo).limit(500),
    ]);

  const assetRows = queryData<{ kind: string; provider: string | null; created_at: string }[]>(assets) ?? [];
  const alertRows = queryData<{ pipeline: string; provider: string; reason: string }[]>(alerts) ?? [];
  const conversationRows = queryData<{ created_at: string }[]>(conversations) ?? [];
  const projectRows = queryData<{ created_at: string }[]>(projects) ?? [];
  const historyRows = queryData<{ delta: number; reason: string; created_at: string }[]>(history);
  const assetCount = querySucceeded(assets) ? assets.value.count : null;
  const assetRowsComplete =
    assetCount !== null && assetCount <= assetRows.length;
  const balanceValue = querySucceeded(balance) && typeof balance.value.data === "number"
    ? balance.value.data
    : null;

  // The history RPC caps results at 200. If it filled that cap, the recent
  // spend total may be incomplete, so do not display it as an exact figure.
  const historyIsComplete = querySucceeded(history) && (history.value.data?.length ?? 0) < 200;
  const spent24h = historyIsComplete && historyRows
    ? historyRows
        .filter((row) => row.delta < 0 && row.reason === "charge" && new Date(row.created_at).getTime() >= now - DAY)
        .reduce((total, row) => total + Math.abs(row.delta), 0)
    : null;

  // These rows support the per-hour chart. If the query hit its row cap, the
  // total count remains exact but a partial hourly series would be misleading.
  const hourly = assetRowsComplete
    ? Array.from({ length: 24 }, (_, index) => {
        const hourStart = now - (24 - index) * HOUR;
        const hourEnd = hourStart + HOUR;
        return assetRows.filter((row) => {
          const createdAt = new Date(row.created_at).getTime();
          return createdAt >= hourStart && createdAt < hourEnd;
        }).length;
      })
    : null;

  const available = {
    media: querySucceeded(assets),
    alerts: querySucceeded(alerts),
    conversations: querySucceeded(conversations),
    messages: querySucceeded(messages),
    billing: balanceValue !== null,
    creditHistory: historyIsComplete,
    projects: querySucceeded(projects),
  };

  const byProvider = new Map<string, number>();
  for (const row of assetRows) {
    const key = row.provider ?? "unknown";
    byProvider.set(key, (byProvider.get(key) ?? 0) + 1);
  }

  return json({
    generatedAt: new Date(now).toISOString(),
    available,
    totals: {
      assets24h: querySucceeded(assets) ? assets.value.count ?? 0 : null,
      conversations24h: querySucceeded(conversations) ? conversations.value.count ?? 0 : null,
      messagesLastHour: querySucceeded(messages) ? messages.value.count ?? 0 : null,
      projects24h: querySucceeded(projects) ? projects.value.count ?? 0 : null,
      alerts24h: querySucceeded(alerts) ? alerts.value.count ?? 0 : null,
      spentCredits24h: spent24h,
      balance: balanceValue,
    },
    systems: SYSTEMS.map((system) => ({
      id: system.id,
      label: system.label,
      to: system.to,
      assets: system.id === "chat"
        ? (querySucceeded(conversations) ? conversations.value.count ?? 0 : null)
        : (querySucceeded(assets) && (assets.value.count ?? 0) <= assetRows.length ? assetRows.filter((row) => system.match.test(row.kind ?? "")).length : null),
      last24h: system.id === "chat"
        ? (querySucceeded(conversations) ? conversations.value.count ?? 0 : null)
        : (querySucceeded(assets) && (assets.value.count ?? 0) <= assetRows.length ? assetRows.filter((row) => system.match.test(row.kind ?? "")).length : null),
    })),
    hourly,
    providers: assetRowsComplete
      ? [...byProvider.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 8)
      : null,
    alerts: available.alerts ? alertRows.slice(0, 6) : null,
  });
}
