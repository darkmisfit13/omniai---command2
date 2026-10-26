"use client";

export default function AutomationsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a69eff]">Workflow runtime</p>
        <h1 className="pilot-voice mt-2 text-2xl">Automations</h1>
        <p className="mt-1 text-sm text-ash">
          Scheduled and event-driven workflows will appear here after their runtime is connected.
        </p>
      </header>

      <section className="rounded-xl border border-[#352e52] bg-[#14121f] p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-300" aria-hidden="true">!</span>
          <div>
            <h2 className="text-sm font-semibold text-[#e8e6f2]">No workflows configured</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ash">
              This workspace does not have workflow storage or an execution service connected yet.
              No schedules or automations are running. Once those services are implemented, this page
              can show saved workflows, their next run, and results from actual executions.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
