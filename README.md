# OmniAI

OmniAI is a personal AI application for DarkMisfitStudios, built with
Next.js and Supabase. It combines a cloud AI workflow with an optional
laptop Ollama model, saved conversation history, answer-source labels,
and website edit drafts.

## Repository layout

The active application is in the `omniai/` directory relative to the
repository root. Vercel's Root Directory was checked by the project owner
on October 9, 2026 and reported as `omniai`.

The legacy `pilot-app2/` directory was removed during repository cleanup.
Its older source remains in Git history. Do not restore its authorization
or website execution implementation over the active application.
Paths below are relative to the active application directory:

```text
omniai/
  app/
    page.tsx                    -- chat, history, routing, and draft review
    login/page.tsx              -- sign-in
    settings/page.tsx           -- application settings
    approvals/page.tsx          -- pending-item review and rejection
    audit-log/page.tsx          -- audit history
    website/page.tsx            -- website maintenance notice
    local-diagnostics/page.tsx  -- laptop diagnostics
    api/
      local-ai/route.ts
      local-diagnostics/route.ts
  lib/
    AuthGate.tsx
    LocalAiRelayAgent.tsx
    localAiRelay.ts
    supabaseClient.ts
    types.ts
  supabase/
    functions/
      dispatch/index.ts
      synthesize/index.ts
      website/index.ts
    migrations/
    schema.sql
  docs/
    recovery-checkpoint-2026-10-09.md
  .env.example
  package.json
  package-lock.json
```

## Current website maintenance restriction

Website operations are temporarily disabled pending authorization and
approval security repairs.

- The Website page does not provide file-loading or edit-submission controls.
- The Approvals page disables approval and execution controls.
- Pending approval items can still be reviewed or rejected.
- Chat may return a website edit draft, but draft submission is disabled.
- Drafts can still be revised through chat or discarded.
- A historical "sent" or "approved" status does not prove that a website
  change was executed.

The local `website` Edge Function source returns HTTP 503 with
`WEBSITE_MAINTENANCE` for non-preflight requests. Its OPTIONS response is
HTTP 204.

Local source and frontend checks do not prove which Edge Function version
is deployed to hosted Supabase. Verify deployed backend behavior separately.

Do not restore the legacy `pilot-app2` website function to bypass
maintenance. Restoring website execution requires server-side authorization
and validation that the exact operation is approved.

## Local development

Run commands from the active application directory:

```bat
npm ci
```

If `.env.local` does not already exist, copy `.env.example` to `.env.local`
and fill in the required values. Do not overwrite an existing configured
environment file.

Required browser configuration:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Start the development server:

```bat
npm run dev
```

For a local production build:

```bat
npm run build
npm run start
```

The project also provides:

```bat
npm run lint
```

Do not commit `.env.local`, provider secrets, database data dumps, temporary
backup files, or Supabase CLI temporary state.

## Python sidecar (laptop only)

The FastAPI execution arm lives at the repository root in `backend-python/`.
It binds `127.0.0.1:8765` and never belongs on Vercel. See
`backend-python/README.md` for install steps.

Match `SIDECAR_SHARED_SECRET` in `backend-python/.env` with
`PYTHON_SIDECAR_SECRET` in `omniai/.env.local`. The Next.js owner-authenticated
proxy is `/api/system-sidecar`; the TypeScript client is `lib/pythonSidecar.ts`.

## Supabase configuration

The active source includes `dispatch`, `synthesize`, and `website` Edge
Functions, plus database schema and migration files.

The `dispatch` and `synthesize` implementations validate the authenticated
user against a designated owner ID. Confirm that the configured identity
matches the intended owner before using this source with another project.

Provider credentials belong in Supabase Edge Function secrets, not in
browser environment variables. Depending on the configured provider path,
the source reads:

```text
GROQ_API_KEY
GROQ_MODEL
ANTHROPIC_API_KEY
OPENAI_API_KEY
GOOGLE_API_KEY
TAVILY_API_KEY
```

`TAVILY_API_KEY` powers live web search (see "Live web search" below).

Website file-reading helpers in `synthesize` use `GITHUB_TOKEN` and
`GITHUB_REPO`. This is separate from the disabled `website` endpoint.

Do not blindly rerun `schema.sql`, apply migrations, or deploy functions
against an existing hosted project. Inspect its schema, migration history,
owner configuration, and deployed functions first.

The supplied recovery checkpoint documents a completed isolated recovery
exercise. It is not a script to rerun against the live database.

## Live web search

The `synthesize` Edge Function can look up current information on the web
using [Tavily](https://tavily.com) and return the answer with source links.

To enable it, set the `TAVILY_API_KEY` secret on the Supabase project:

```text
supabase secrets set TAVILY_API_KEY=tvly-your-key
```

Then redeploy the function so the new source runs:

```text
supabase functions deploy synthesize
```

Behavior:

- A search runs only when the request asks for something current (for
  example "latest", "today", "news", "price", "weather", a year) or
  explicitly asks OmniAI to search, look up, or browse.
- Live results are injected into the final synthesis prompt, which is
  instructed to prefer them for current or factual questions and to cite the
  sources it uses as inline markdown links.
- The function returns up to five sources. They are stored with the answer
  in `answer_metadata.sources` (a JSON field on the existing `messages`
  table, so no schema change or migration is required) and shown under the
  answer in chat.
- If `TAVILY_API_KEY` is not set, the function skips search and behavior is
  unchanged.

## Connect the laptop Ollama model

The laptop relay uses a private Supabase Realtime channel named
`local-ai:<user id>`. The laptop connects outbound to Supabase; the tested
relay workflow does not require a public Ollama tunnel.

Before using the relay:

1. Confirm the private-relay migration and relevant Realtime authorization
   policies are present in the connected Supabase project.
2. Confirm Supabase Realtime is configured to enforce private-channel access.
3. Keep Ollama running on the laptop with the configured model available.
4. Start the laptop app and sign in with the same account used by the hosted
   app.
5. Wait for the laptop link to report ready, and keep the laptop awake with
   the app open.

Laptop-only configuration in `.env.local`:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

Do not add these laptop settings to Vercel.

Quick requests can attempt laptop routing and a local answer. If the laptop
route is unavailable or selects escalation, the frontend uses the cloud
workflow and displays a routing notice.

The chat page includes bounded recent conversation context and stores
answer-source metadata with the generated answer. Prompts sent through the
relay pass through Supabase Realtime.

The cloud dispatch source also contains a separate legacy `OLLAMA_URL`
path. It is not the private laptop relay and should not be configured or
exposed merely to make the relay work.

## Validation recorded October 9, 2026

The frontend maintenance repair was committed as:

```text
f42c9de Disable website approval controls during security maintenance
```

Before this documentation update:

- The local production build completed successfully.
- Build-time linting and TypeScript checks passed.
- The project owner reported passing browser checks for Website,
  Approvals, chat history/input, and pending-draft controls.
- No browser errors were reported.

These checks validate the local frontend repair. They do not establish
hosted deployment status, comprehensive backend security, or recovery of
all Supabase services.

## Remaining work

- Server-side website authorization and approval-bound execution.
- Atomic or otherwise reliable approval/audit recording.
- Runtime owner and non-owner access checks, including write operations.
- Long-running laptop relay reliability and reconnect behavior.
- Independent verification of deployed source and backend configuration.
