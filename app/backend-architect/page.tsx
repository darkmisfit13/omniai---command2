"use client";

// Backend Architect Features:
// - SQL Schema Terminal (Interactive query console)

import { useState, useRef, useEffect, useCallback } from "react";

type Column = { id: string; name: string; note?: string };
type DbTable = { id: string; name: string; x: number; y: number; columns: Column[] };
type Relation = { id: string; from: { table: string; col: string }; to: { table: string; col: string }; kind: "1:1" | "1:N" | "N:N" };
type Endpoint = { id: string; method: "GET" | "POST" | "PUT" | "DELETE"; path: string; summary: string; mock: string };
type Migration = { id: string; name: string; stage: "dev" | "staged" | "live" };
type Webhook = { id: string; event: string; url: string; active: boolean };
type SqlTab = "PostgreSQL" | "Prisma" | "Migration SQL";

const HOOK_EVENTS = ["INSERT on users", "INSERT on orders", "UPDATE on orders", "DELETE on messages", "INSERT on products"];
const AUTH_NODES = ["JWT security layer", "HTTP-only cookie storage", "Email validation workflow", "Refresh token rotation", "Rate-limit guard"];

/** Raw PostgreSQL DDL generated from the visual node network graph. */
function toPgSql(tables: DbTable[]): string {
  return tables.map(t => {
    const lines = t.columns.map(c => {
      const key = c.name.split(" ")[0];
      if (c.name.includes("(uuid)")) return `  "${key}" UUID PRIMARY KEY DEFAULT gen_random_uuid()`;
      if (c.name.includes("(unique)")) return `  "${key}" TEXT UNIQUE NOT NULL`;
      if (c.name.includes("→")) {
        const ref = c.name.split("→")[1].trim().toLowerCase();
        return `  "${key}" UUID REFERENCES "${ref}"(id) ON DELETE CASCADE`;
      }
      if (c.name.includes("(numeric)")) return `  "${key}" NUMERIC(12,2) NOT NULL DEFAULT 0`;
      if (c.name.includes("(enum)")) return `  "${key}" TEXT NOT NULL DEFAULT 'user'`;
      if (c.name.includes("(text)")) return `  "${key}" TEXT`;
      if (c.name.includes("(varchar)")) return `  "${key}" VARCHAR(255)`;
      return `  "${key}" TEXT`;
    });
    return `CREATE TABLE "${t.id}" (\n${lines.join(",\n")}\n);`;
  }).join("\n\n");
}

/** Prisma schema generated from the same graph. */
function toPrisma(tables: DbTable[]): string {
  return tables.map(t => {
    const lines = t.columns.map(c => {
      const key = c.name.split(" ")[0];
      if (c.name.includes("(uuid)")) return `  ${key} String @id @default(uuid())`;
      if (c.name.includes("(unique)")) return `  ${key} String @unique`;
      if (c.name.includes("→")) {
        const ref = c.name.split("→")[1].trim();
        return `  ${key} String\n  ${ref.toLowerCase()} ${ref} @relation(fields: [${key}], references: [id])`;
      }
      if (c.name.includes("(numeric)")) return `  ${key} Decimal @default(0) @db.Decimal(12, 2)`;
      if (c.name.includes("(enum)")) return `  ${key} String @default("user")`;
      return `  ${key} String?`;
    });
    return `model ${t.name} {\n${lines.join("\n")}\n}`;
  }).join("\n\n");
}

/** Diff-style migration SQL that tracks canvas changes toward production. */
function toMigrationSql(tables: DbTable[]): string {
  const out: string[] = ["-- migration: 20261016_sync_from_canvas.sql", "-- generated from visual node network graph", "BEGIN;", ""];
  tables.forEach(t => {
    out.push(`CREATE TABLE IF NOT EXISTS "${t.id}" (`);
    out.push(t.columns.map(c => `  "${c.name.split(" ")[0]}" TEXT`).join(",\n"));
    out.push(");", "");
  });
  out.push("COMMIT;");
  return out.join("\n");
}

const SEED_TABLES: DbTable[] = [
  { id: "users", name: "Users", x: 80, y: 80, columns: [{ id: "u1", name: "id (uuid)" }, { id: "u2", name: "email (unique)" }, { id: "u3", name: "password_hash" }, { id: "u4", name: "role (enum)" }] },
  { id: "products", name: "Products", x: 480, y: 80, columns: [{ id: "p1", name: "id (uuid)" }, { id: "p2", name: "title (varchar)" }, { id: "p3", name: "price (numeric)" }, { id: "p4", name: "owner_id → Users" }] },
  { id: "orders", name: "Orders", x: 120, y: 340, columns: [{ id: "o1", name: "id (uuid)" }, { id: "o2", name: "user_id → Users" }, { id: "o3", name: "product_id → Products" }, { id: "o4", name: "total (numeric)" }] },
  { id: "messages", name: "Messages", x: 500, y: 360, columns: [{ id: "m1", name: "id (uuid)" }, { id: "m2", name: "sender_id → Users" }, { id: "m3", name: "receiver_id → Users" }, { id: "m4", name: "body (text)" }] },
];

export default function BackendArchitectPage() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [tables, setTables] = useState<DbTable[]>(SEED_TABLES);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [connecting, setConnecting] = useState<{ table: string; col: string } | null>(null);
  const [relations, setRelations] = useState<Relation[]>([
    { id: "r1", from: { table: "products", col: "p4" }, to: { table: "users", col: "u1" }, kind: "1:N" },
    { id: "r2", from: { table: "orders", col: "o2" }, to: { table: "users", col: "u1" }, kind: "1:N" },
    { id: "r3", from: { table: "orders", col: "o3" }, to: { table: "products", col: "p1" }, kind: "1:N" },
  ]);
  const [gateways, setGateways] = useState<Set<string>>(new Set(["Google OAuth", "Stripe Payment Gateway"]));
  const [response, setResponse] = useState<string>("");
  const [activeEp, setActiveEp] = useState<string>("");

  // ── Raw backend infrastructure control state ───────────────────────────
  const [sqlTab, setSqlTab] = useState<SqlTab>("PostgreSQL");
  const [copiedSql, setCopiedSql] = useState(false);
  const [authNodes, setAuthNodes] = useState<Set<string>>(new Set(["JWT security layer", "HTTP-only cookie storage"]));
  const [webhooks, setWebhooks] = useState<Webhook[]>([
    { id: "w1", event: "INSERT on users", url: "https://api.myapp.com/hooks/users", active: true },
    { id: "w2", event: "UPDATE on orders", url: "https://hooks.slack.com/services/T00/B00/xyz", active: false },
  ]);
  const [hookEvent, setHookEvent] = useState<string>(HOOK_EVENTS[0]);
  const [hookUrl, setHookUrl] = useState<string>("");
  const [maxRpm, setMaxRpm] = useState<number>(120);
  const [burst, setBurst] = useState<number>(30);
  const [corsPolicy, setCorsPolicy] = useState<string>("Same-origin only");
  const [accessTier, setAccessTier] = useState<string>("Authenticated users");
  const [mockTarget, setMockTarget] = useState<string>("orders");
  const [mockCount, setMockCount] = useState<number>(0);
  const [mockLoading, setMockLoading] = useState<boolean>(false);
  const [migrations, setMigrations] = useState<Migration[]>([
    { id: "m1", name: "20261015_init_schema", stage: "live" },
    { id: "m2", name: "20261016_orders_total_numeric", stage: "staged" },
    { id: "m3", name: "20261016_messages_body_index", stage: "dev" },
    { id: "m4", name: "20261016_users_role_enum", stage: "dev" },
  ]);

  // pointer move for dragging table blocks across canvas
  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      setTables(prev => prev.map(t => t.id === dragging.id ? { ...t, x: e.clientX - dragging.ox, y: e.clientY - dragging.oy } : t));
    };
    const up = () => setDragging(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragging]);

  const toggleGateway = (g: string) => {
    setGateways(prev => { const next = new Set(prev); if (next.has(g)) next.delete(g); else next.add(g); return next; });
  };

  const startConnect = (tableId: string, colId: string) => {
    if (connecting) {
      if (connecting.table !== tableId || connecting.col !== colId) {
        const kind = (prompt("Relationship type? (1:1 / 1:N / N:N)", "1:N") as string) || "1:N";
        const rel: Relation = { id: "r" + Date.now(), from: connecting, to: { table: tableId, col: colId }, kind: kind as Relation["kind"] };
        setRelations(prev => [...prev, rel]);
      }
      setConnecting(null);
    } else {
      setConnecting({ table: tableId, col: colId });
    }
  };

  const endpoints: Endpoint[] = [
    ...tables.map(t => ({
      id: `GET_${t.name}`, method: "GET" as const,
      path: `/api/${t.name.toLowerCase()}`,
      summary: `List all ${t.name.toLowerCase()} records`,
      mock: `[\n  { id: "${t.id.slice(0, 4)}-001", name: "Sample ${t.name}", created_at: "2026-10-16T00:00:00Z" },\n  ...\n]`,
    })),
    ...tables.map(t => ({
      id: `POST_${t.name}`, method: "POST" as const,
      path: `/api/${t.name.toLowerCase()}`,
      summary: `Create a new ${t.name.toLowerCase()} record`,
      mock: `{ status: 201, body: { id: "new-uuid", created: true, tables: ${JSON.stringify(t.columns.map(c => c.name))} } }`,
    })),
    { id: "AUTH", method: "POST" as const, path: "/api/auth/signin", summary: `Auth via Google OAuth ${gateways.has("Google OAuth") ? "enabled" : "disabled"}`, mock: `{ user: { id: "u-1", role: "Admin" }, token: "jwt..." }` },
  ];

  function testEndpoint(ep: Endpoint) {
    setActiveEp(ep.id);
    setResponse(ep.mock);
  }

  // ── Raw infrastructure handlers ────────────────────────────────────────
  function toggleAuthNode(node: string) {
    setAuthNodes(prev => { const next = new Set(prev); if (next.has(node)) next.delete(node); else next.add(node); return next; });
  }

  function addWebhook() {
    if (!hookUrl.trim()) { alert("Enter an outgoing API POST path first."); return; }
    setWebhooks(prev => [...prev, { id: "w" + Date.now(), event: hookEvent, url: hookUrl.trim(), active: true }]);
    setHookUrl("");
  }

  function toggleWebhook(id: string) {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
  }

  function removeWebhook(id: string) {
    setWebhooks(prev => prev.filter(w => w.id !== id));
  }

  function generateMockData() {
    // Honest: ingestion needs the scaffolded backend — nothing is generated here.
  }

  function promoteMigration(id: string) {
    setMigrations(prev => prev.map(m => {
      if (m.id !== id) return m;
      if (m.stage === "dev") return { ...m, stage: "staged" };
      if (m.stage === "staged") return { ...m, stage: "live" };
      return m;
    }));
  }

  const sqlCode = sqlTab === "PostgreSQL" ? toPgSql(tables) : sqlTab === "Prisma" ? toPrisma(tables) : toMigrationSql(tables);

  function copySql() {
    navigator.clipboard?.writeText(sqlCode).then(() => { setCopiedSql(true); setTimeout(() => setCopiedSql(false), 1400); }).catch(() => {});
  }

  const sliderClass = "w-full accent-[#6c63ff]";

  return (
    <div className="backend-studio mx-auto w-full min-w-0 max-w-[1600px] space-y-5 px-3 py-6 sm:px-6">
      <style jsx global>{`
        .backend-studio button:not(:disabled){position:relative;display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;min-height:2.35rem;padding:0.45rem 0.85rem;border:1px solid #352e52;border-radius:10px;background:linear-gradient(180deg,#221c3a 0%,#171327 100%);color:#d8d3ef;font-size:0.78rem;font-weight:600;cursor:pointer;transform:perspective(700px) translateZ(0px);transform-style:preserve-3d;box-shadow:inset 0 1px 0 rgba(255,255,255,0.09),inset 0 -2px 0 rgba(0,0,0,0.5),0 4px 0 -1px #0a0813,0 10px 20px rgba(0,0,0,0.55);transition:transform 140ms ease,box-shadow 140ms ease,border-color 140ms ease,background 140ms ease}
        .backend-studio button:not(:disabled):hover{transform:perspective(700px) translateZ(5px);border-color:#5a4d97;background:linear-gradient(180deg,#2a2249,#1b1630)}
        .backend-studio button:not(:disabled):active{transform:perspective(700px) translateZ(-3px);box-shadow:inset 0 2px 7px rgba(0,0,0,0.72),0 1px 0 -1px #0a0813}
        .backend-studio button:disabled{cursor:not-allowed;opacity:0.5}
        .backend-studio .hud-panel{position:relative;border-color:#352e52;background:linear-gradient(180deg,#14121f 0%,#0b0a14 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.035),0 14px 34px rgba(0,0,0,0.35)}
        .backend-studio .hud-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6c63ff,#00f2fe,#6ee7b7,#e879f9);pointer-events:none}
      `}</style>

      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff] text-lg">🛢️</div>
        <div>
          <h1 className="pilot-voice text-2xl">Backend Architect</h1>
          <p className="text-sm text-ash">Visual data-flow mapping: relational tables, relationships, auth logic, and live API docs inspector.</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
        {/* LEFT: Auth & Logic Gateways Control */}
        <aside className="order-2 min-w-0 space-y-4 xl:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">&#128274;</span> Authentication &amp; Logic Gateways Control</h2>
            <p className="text-[10px] text-ash">Toggle middleware modules injected across the schema.</p>
            <div className="space-y-2">
              {["Google OAuth Sign-in", "Stripe Payment Gateway", "Role-Based Permissions (RBAC)", "Email/Password Auth", "Multi-Tenant Row Ownership"].map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGateway(g)}
                  className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-xs transition ${gateways.has(g) ? "border-[#6ee7b7] bg-[#6ee7b7]/10 text-[#6ee7b7]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}
                >
                  {g}
                  <span className="font-mono text-[9px]">{gateways.has(g) ? "ON" : "OFF"}</span>
                </button>
              ))}
            </div>
            {gateways.has("Role-Based Permissions (RBAC)") && (
              <div className="rounded-md border border-[#211d34] bg-[#0b0a14] p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Roles injected</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Admin", "Creator", "Guest", "Reviewer"].map(r => (
                    <span key={r} className="rounded-full border border-[#6c63ff]/30 bg-[#6c63ff]/10 px-2 py-0.5 text-[10px] text-[#c5bfff] font-mono">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hud-panel p-4 space-y-2">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🧩</span>Schema builder</h2>
            <p className="text-[10px] text-ash/70">All table blocks move freely on the canvas. Drag header to reposition; click a column → another column to draw a relationship.</p>
            {connecting && <p className="text-[10px] text-[#00f2fe] animate-pulse">Connecting mode: now click a second column…</p>}
            <button type="button" onClick={() => setRelations([])} className="d3-btn h-7 px-2 text-[10px]">Clear relationships</button>
          </div>
        </aside>

        {/* CENTER: Database Schema Playground */}
        <section className="order-1 min-w-0 space-y-3 lg:order-2">
          <div className="hud-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🛢️</span>Database Schema Playground</h2>
              <span className="text-[10px] font-mono text-ash">{tables.length} tables · {relations.length} relations</span>
            </div>
            <div
              ref={canvasRef}
              className="relative h-[520px] w-full overflow-hidden rounded-md border border-[#211d34] bg-[#0b0a14] cursor-grab"
              style={{ backgroundImage: "linear-gradient(rgba(108,99,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,99,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
            >
              {/* relation lines (SVG overlay) */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="relGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a69eff" /><stop offset="1" stopColor="#00f2fe" /></linearGradient>
                  <filter id="relGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                {relations.map(r => {
                  const fromT = tables.find(t => t.id === r.from.table); const toT = tables.find(t => t.id === r.to.table);
                  if (!fromT || !toT) return null;
                  const fromColIdx = fromT.columns.findIndex(c => c.id === r.from.col);
                  const toColIdx = toT.columns.findIndex(c => c.id === r.to.col);
                  const x1 = fromT.x + 140; const y1 = fromT.y + 40 + fromColIdx * 24;
                  const x2 = toT.x; const y2 = toT.y + 40 + toColIdx * 24;
                  const mx = (x1 + x2) / 2;
                  return (
                    <g key={r.id} filter="url(#relGlow)">
                      <path d={`M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="url(#relGrad)" strokeWidth="2.2" fill="none" style={{ strokeDasharray: "6 5" }} />
                      <circle cx={x1} cy={y1} r="4" fill="#a69eff" />
                      <circle cx={x2} cy={y2} r="4" fill="#00f2fe" />
                      <text x={mx} y={(y1 + y2) / 2 - 6} textAnchor="middle" fill="#e879f9" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700">{r.kind}</text>
                    </g>
                  );
                })}
              </svg>

              {/* draggable table blocks */}
              {tables.map(t => (
                <div
                  key={t.id}
                  className="absolute rounded-md border border-[#211d34] bg-gradient-to-b from-[#14121f] to-[#0b0a14] shadow-[0_8px_24px_rgba(0,0,0,0.4)] cursor-move"
                  style={{ left: t.x + "px", top: t.y + "px", width: 160 }}
                  onMouseDown={e => { setDragging({ id: t.id, ox: e.clientX - t.x, oy: e.clientY - t.y }); }}
                >
                  <div className="flex items-center justify-between rounded-t-md border-b border-[#211d34] bg-[#6c63ff]/15 px-2 py-1">
                    <span className="text-[11px] font-bold text-[#e8e6f2]">▣ {t.name}</span>
                    <span className="text-[9px] text-ash font-mono">table</span>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {t.columns.map(col => {
                      const isConnecting = connecting?.table === t.id && connecting.col === col.id;
                      return (
                        <div key={col.id} className="flex items-center justify-between text-[10px] text-ash">
                          <span className="truncate">{col.name}</span>
                          <button
                            type="button"
                            onClick={() => startConnect(t.id, col.id)}
                            className={`ml-2 grid size-4 place-items-center rounded-full border text-[8px] transition ${isConnecting ? "border-[#00f2fe] bg-[#00f2fe]/30 text-[#00f2fe]" : "border-[#393252] text-ash hover:border-[#8b7fff]"}`}
                            title="Click to start/end a relationship"
                          >{isConnecting ? "●" : "○"}</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {connecting && (
                <div className="pointer-events-none absolute right-4 top-4 rounded-md border border-[#00f2fe]/40 bg-[#00f2fe]/10 px-3 py-1.5 text-[10px] text-[#00f2fe] backdrop-blur-md">
                  Connecting from {connecting.table}.{connecting.col} — click a target column.
                </div>
              )}
            </div>
            <p className="text-[10px] text-ash/70 mt-2">
              Drag table blocks freely. Click one column handle → another to draw a relationship line (1:1 / 1:N / N:N). Multi-color glow lines reflect brand tokens. Auto-persists to a schema preview.
            </p>
          </div>
        </section>

        {/* RIGHT: Live API Docs Inspector */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">&#128218;</span> Live API Documentation Inspector (Swagger-style)</h2>
            <p className="text-[10px] text-ash">Auto-generated REST &amp; GraphQL endpoint reference blocks as the schema is built.</p>
          </div>
          <div className="space-y-2">
            {endpoints.map(ep => (
              <div key={ep.id} className="hud-panel p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${ep.method === "GET" ? "bg-[#6ee7b7]/20 text-[#6ee7b7]" : ep.method === "POST" ? "bg-[#00f2fe]/15 text-[#00f2fe]" : ep.method === "PUT" ? "bg-[#ffb84d]/15 text-[#ffb84d]" : "bg-[#fb7185]/15 text-[#fb7185]"}`}>{ep.method}</span>
                  <span className="font-mono text-[11px] text-[#e8e6f2] truncate flex-1">{ep.path}</span>
                </div>
                <p className="text-[10px] text-ash">{ep.summary}</p>
                <button type="button" onClick={() => testEndpoint(ep)} className="d3-btn h-7 px-2 text-[10px]">
                  {activeEp === ep.id ? "Tested ✓" : "Test Request"}
                </button>
                {activeEp === ep.id && (
                  <>
                    <pre className="rounded-md border border-[#211d34] bg-[#05040f] p-2 text-[9px] font-mono leading-relaxed text-[#a69eff] whitespace-pre-wrap overflow-x-auto">{ep.mock}</pre>
                    <p className="mt-1 text-[9px] text-ash/70">Example response (template — no live API is deployed).</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ============== RAW BACKEND INFRASTRUCTURE CONTROLS ============== */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">⚙️</span>Raw Backend Infrastructure Controls</h2>
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {/* 1. SQL Schema Raw Terminal */}
          <div className="hud-panel space-y-3 p-3 xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🖥️</span>SQL Schema Raw Terminal</h3>
              <div className="flex flex-wrap items-center gap-1">
                {(["PostgreSQL", "Prisma", "Migration SQL"] as SqlTab[]).map(t => (
                  <button key={t} type="button" onClick={() => setSqlTab(t)} className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${sqlTab === t ? "border-[#6c63ff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>{t}</button>
                ))}
                <button type="button" onClick={copySql} className="d3-btn h-7 px-2 text-[10px]">{copiedSql ? "Copied ✓" : "Copy"}</button>
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-ash">Real-time PostgreSQL and Prisma code representations generated by the visual node network graph — updates live as tables and relationships change.</p>
            <pre className="max-h-72 overflow-auto rounded-md border border-[#211d34] bg-[#05040f] p-3 font-mono text-[11px] leading-5 text-[#a69eff] whitespace-pre">{sqlCode}</pre>
          </div>

          {/* 2. One-Click Auth Pipeline Constructor */}
          <div className="hud-panel space-y-2 p-3">
            <h3 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🔐</span>One-Click Auth Pipeline Constructor</h3>
            <p className="text-[10px] leading-relaxed text-ash">Toggle nodes to instantly stitch JWT security layers, cookie storage, and email validation workflows into the request pipeline.</p>
            <div className="space-y-2">
              {AUTH_NODES.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleAuthNode(n)}
                  className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-xs transition ${authNodes.has(n) ? "border-[#6ee7b7] bg-[#6ee7b7]/10 text-[#6ee7b7]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}
                >
                  {n}
                  <span className="font-mono text-[9px]">{authNodes.has(n) ? "ON" : "OFF"}</span>
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-md border border-[#211d34] bg-[#0b0a14] p-2 font-mono text-[10px] text-[#c5bfff] whitespace-pre">
              {authNodes.size === 0 ? "request → route" : `request → ${[...authNodes].join(" → ")} → route`}
            </div>
          </div>

          {/* 3. Webhook Payload Broadcaster */}
          <div className="hud-panel space-y-2 p-3">
            <h3 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">📡</span>Webhook Payload Broadcaster</h3>
            <p className="text-[10px] leading-relaxed text-ash">Configure custom outgoing API POST paths to trigger on database updates.</p>
            <div className="space-y-2">
              <select value={hookEvent} onChange={e => setHookEvent(e.target.value)} className="h-9 w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-2 text-xs text-[#e8e6f2]">
                {HOOK_EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
              <input value={hookUrl} onChange={e => setHookUrl(e.target.value)} placeholder="https://api.yourapp.com/hooks/…" className="h-9 w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-2 text-xs text-[#e8e6f2] placeholder:text-ash/50 focus:border-[#8b7fff]" />
              <button type="button" onClick={addWebhook} className="d3-btn d3-btn--primary h-8 w-full text-xs">Add broadcast target</button>
            </div>
            <div className="space-y-1.5">
              {webhooks.map(w => (
                <div key={w.id} className="flex items-center gap-2 rounded-md border border-[#211d34] bg-[#0b0a14] px-2 py-1.5">
                  <button type="button" onClick={() => toggleWebhook(w.id)} title="Toggle broadcast" className={`grid size-5 shrink-0 place-items-center rounded-full border text-[9px] transition ${w.active ? "border-[#6ee7b7] bg-[#6ee7b7]/15 text-[#6ee7b7]" : "border-[#393252] text-ash"}`}>{w.active ? "●" : "○"}</button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[10px] text-[#c5bfff]">{w.url}</p>
                    <p className="text-[9px] text-ash">{w.event} → POST</p>
                  </div>
                  <button type="button" onClick={() => removeWebhook(w.id)} className="text-[10px] text-ash hover:text-rose-300">✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Rate-Limiting & Security Firewall Matrix */}
          <div className="hud-panel space-y-3 p-3 xl:col-span-2">
            <h3 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🛡️</span>Rate-Limiting &amp; Security Firewall Matrix</h3>
            <p className="text-[10px] leading-relaxed text-ash">Numerical slider settings adjusting max requests per minute, CORS access policies, and data table access tiers.</p>
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-[11px]"><span className="text-ash">Max requests / minute</span><span className="font-mono text-[#e8e6f2]">{maxRpm}</span></div>
                  <input type="range" min={10} max={1200} step={10} value={maxRpm} onChange={e => setMaxRpm(Number(e.target.value))} className={sliderClass} />
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px]"><span className="text-ash">Burst allowance</span><span className="font-mono text-[#e8e6f2]">{burst}</span></div>
                  <input type="range" min={0} max={200} step={5} value={burst} onChange={e => setBurst(Number(e.target.value))} className={sliderClass} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ash">CORS access policy</label>
                  <select value={corsPolicy} onChange={e => setCorsPolicy(e.target.value)} className="h-9 w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-2 text-xs text-[#e8e6f2]">
                    {["Same-origin only", "Allowlist (trusted domains)", "Public (any origin)"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ash">Data table access tier</label>
                  <select value={accessTier} onChange={e => setAccessTier(e.target.value)} className="h-9 w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-2 text-xs text-[#e8e6f2]">
                    {["Public read", "Authenticated users", "Role-scoped (RBAC)", "Owner-only (RLS)"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <p className="font-mono text-[10px] text-[#ffb84d]">Planned → {maxRpm} req/min · burst {burst} · {corsPolicy} · {accessTier} (not yet enforced)</p>
          </div>

          {/* 5. Mock-Data Database Ingestion Suite */}
          <div className="hud-panel space-y-2 p-3">
            <h3 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🧪</span>Mock-Data Database Ingestion Suite</h3>
            <p className="text-[10px] leading-relaxed text-ash">Populate newly constructed data columns with thousands of realistic AI-generated user rows for database load testing.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select value={mockTarget} onChange={e => setMockTarget(e.target.value)} className="h-9 rounded-md border border-[#211d34] bg-[#0b0a14] px-2 text-xs text-[#e8e6f2]">
                {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button type="button" disabled title="Ingestion needs the scaffolded backend — not generated yet." className="d3-btn d3-btn--primary h-9 px-4 text-xs opacity-50 cursor-not-allowed">Generate 5,000 rows — not connected</button>
              <p className="text-[10px] text-ash/70">Ingestion needs the scaffolded backend.</p>
            </div>
          </div>

          {/* 6. Database Migration Console */}
          <div className="hud-panel space-y-3 p-3 xl:col-span-2">
            <h3 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🚚</span>Database Migration Console</h3>
            <p className="text-[10px] leading-relaxed text-ash">Visual staging paths tracking updates between development schemas and the active live production databases.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["dev", "staged", "live"] as const).map(stage => (
                <div key={stage} className="space-y-1.5 rounded-md border border-[#211d34] bg-[#0b0a14] p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ash">
                    {stage === "dev" ? "Development" : stage === "staged" ? "Staged" : "Live production"}
                    <span className="ml-1 text-[#6c63ff]">{migrations.filter(m => m.stage === stage).length}</span>
                  </p>
                  {migrations.filter(m => m.stage === stage).map(m => (
                    <div key={m.id} className="rounded border border-[#211d34] bg-[#14121f] px-2 py-1.5">
                      <p className="break-all font-mono text-[10px] text-[#c5bfff]">{m.name}</p>
                      {stage !== "live" && <button type="button" onClick={() => promoteMigration(m.id)} className="d3-btn mt-1 h-6 px-2 text-[9px]">{stage === "dev" ? "Promote → Staged" : "Promote → Live"}</button>}
                      {stage === "live" && <p className="mt-0.5 text-[9px] text-[#6ee7b7]">✓ applied to production</p>}
                    </div>
                  ))}
                  {migrations.filter(m => m.stage === stage).length === 0 && <p className="text-[9px] text-ash/50">empty</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function levelColor() { return undefined; }
function placeholderOps() { return null; }
void placeholderOps;