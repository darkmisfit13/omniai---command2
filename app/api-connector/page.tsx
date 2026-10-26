"use client";

const CONNECTORS = [
  { name: "Discord Bot API", icon: "💬", detail: "Bot credentials and event delivery" },
  { name: "Telegram API", icon: "✈️", detail: "Bot token and webhook delivery" },
  { name: "Twitter / X Developer Portal", icon: "𝕏", detail: "OAuth and app permissions" },
  { name: "Shopify Storefront", icon: "🛍️", detail: "Store authorization and API access" },
  { name: "Slack Webhooks", icon: "🟣", detail: "Workspace authorization and webhook URL" },
  { name: "OpenAI / Claude Routes", icon: "🧠", detail: "Provider credentials and routing configuration" },
  { name: "Custom REST Webhook", icon: "🔗", detail: "Endpoint, signing secret, and event schema" },
];

export default function ApiConnectorPage() {
  return (
    <main className="api-connector mx-auto w-full min-w-0 max-w-[1600px] space-y-5 px-3 py-6 sm:px-6">
      <style jsx global>{`
        .api-connector .hud-panel{position:relative;border:1px solid #352e52;border-radius:14px;background:linear-gradient(180deg,#14121f 0%,#0b0a14 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.035),0 14px 34px rgba(0,0,0,0.35)}
        .api-connector .hud-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;border-radius:14px 14px 0 0;background:linear-gradient(90deg,#6c63ff,#00f2fe,#6ee7b7,#e879f9)}
      `}</style>

      <header className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-lg text-[#c5bfff]" aria-hidden="true">🔌</div>
        <div>
          <h1 className="pilot-voice text-2xl">API &amp; Webhook Lab</h1>
          <p className="text-sm text-ash">Connector setup and captured delivery events for external services.</p>
        </div>
      </header>

      <section className="hud-panel p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#e8e6f2]">Connector directory</h2>
          <p className="mt-1 text-xs text-ash">These providers are listed for planning. No credentials or live connections are configured in this workspace.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CONNECTORS.map((connector) => (
            <article key={connector.name} className="rounded-xl border border-[#28233c] bg-[#0b0a14]/70 p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl" aria-hidden="true">{connector.icon}</span>
                <h3 className="text-sm font-semibold text-[#e8e6f2]">{connector.name}</h3>
              </div>
              <p className="mt-3 text-xs text-ash">{connector.detail}</p>
              <p className="mt-3 inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Not configured</p>
            </article>
          ))}
        </div>
      </section>

      <section className="hud-panel p-5">
        <h2 className="text-sm font-semibold text-[#e8e6f2]">Delivery events</h2>
        <p className="mt-1 text-xs text-ash">Webhook capture is not connected, so there are no live delivery events to display.</p>
        <div className="mt-4 rounded-lg border border-dashed border-[#352e52] px-4 py-10 text-center text-sm text-ash">
          No live events recorded.
        </div>
      </section>
    </main>
  );
}
