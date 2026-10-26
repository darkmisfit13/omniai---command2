# OMNIAI HUB — Master Product Specification

Version 1.0 · 3 Oct 2026 · Seller: Benjamin Cody James t/a DarkMisfitStudios
Scope: product source of truth. Part 1 (A–Q) describes the product and is not tied to any build platform. Part 2 describes the current Lovable implementation and how portable it is.

### Status definitions (used everywhere below)
| Status | Meaning |
|---|---|
| LIVE | Works end to end in production and has been verified at least once with a real result |
| BETA | Works end to end in code, but not verified recently, or has known gaps |
| CONNECTED | Code is wired to an outside provider, but results depend on that provider's account or plan |
| PLANNED | Designed or partly scaffolded; not usable |
| COMING_SOON | Shown to users as unavailable |
| DISABLED | Exists but is switched off |

**Verification caveat (Phase 10):** on 1–3 Oct 2026 the shared AI service balance (the workspace balance that pays for AI calls) was nearly empty, so new AI generations fail with a "temporarily unavailable on our side" message. Items marked LIVE were verified **before** that date: owner live purchase 30 Sep, generated images/videos in Sep, Director runs. Until the balance is topped up, **every AI capability is effectively unavailable in production.** Re-verify after top-up.

---

# PART 1 — PRODUCT SPECIFICATION

## A. Product vision
OMNIAI HUB is an all-in-one AI workspace. It combines conversational AI, a planning/orchestration layer (AI DIRECTOR), creative studios (image, video, music, music video), business intelligence (website/social), building tools (App Builder, Website Builder), automation and agents. Projects, Assets and Jobs are shared across all of these. A single credit wallet meters all usage. The product is honest by design: features that are unavailable are shown as unavailable, never simulated.

## B. Core capabilities
1. Converse and reason (AI Chat, Omni and Council modes)
2. Plan and run multi-step goals (AI DIRECTOR)
3. Create media: image, video, music, voice, music video
4. Edit media: image editor, timeline video editor
5. Create and improve written content (Content, PROMPT LAB)
6. Analyse businesses (Website Intelligence; Social Intelligence planned)
7. Build software (APP BUILDER, Website Builder)
8. Automate (Automations; Agents planned)
9. Organise work (PROJECTS, ASSETS, JOBS/History)
10. Commercialise (plans, credit packs, credit wallet, billing portal)

## C/D. Current feature inventory and status

Routes are listed for reference only. "Tables" means data entities.

### 1. AI CHAT — BETA
- Route: /chat. Multi-conversation chat, a side panel for chats/tone/instructions/reset, image references, and Chat / Omni / Council mode switch. Omni hands multi-step goals to the Director.
- Limits: one model call per reply (no streaming). Omni and Council were never verified live.
- Server: chat.functions (sendChatMessage etc.), omni.functions. Tables: conversations, messages. AI: built-in gateway (text + vision).

### 2. AI DIRECTOR — LIVE (planning, text and image steps) / BETA (video, music and app steps)
- Routes: /director, /director/$id. Turns a goal into a planned task list with clarifying questions and image/video references, runs tasks one by one, retries failures, collects async video, and lets you download outputs.
- Limits: tasks run while the page is open (scheduled runs only partly wired). Music steps need a paid ElevenLabs plan.
- Server: director.functions (createPlan, runNextTask/runNextTaskFor). Tables: workflows, workflow_tasks, generations, assets.

### 3. AI RESEARCH — PLANNED
- A web search tool is defined in the catalog, but no search provider is connected. Website crawling exists (see 13).

### 4. PROMPT ENGINEERING (PROMPT LAB) — BETA
- Route: /prompts (labelled "Prompt Studio"). Lets you save and version prompts, optimise a prompt with AI, test a prompt, and use goal shortcuts. Tables: prompts, prompt_versions.

### 5. IMAGE GENERATION — LIVE
- Route: /studio/image. Text-to-image and image-to-image with multiple references and a single result per run. Results are saved to Assets and downloadable. AI: built-in gateway image models. Cost keys: image:standard, image:hd.

### 6. PHOTO STUDIO (image editing) — BETA
- Inside /studio/image. Manual adjustments, eraser, undo/redo and before/after work. AI edits by instruction work. Erase-object, background removal, watermark removal and enhance are attempted through general image editing, so the results are not guaranteed (no dedicated tool exists). Gated by plan.

### 7. VIDEO EDITING (VIDEO EDITOR) — BETA
- /studio/video draft timeline (split, duplicate, speed, mirror, mute, looks) previews in the browser but **does not render a file**. The Music Video timeline (10) does render, in the browser, to WebM (max 60 s / 8 MB).
- Tool-belt items with no backing capability (lip sync, relight, eye contact, stabilise, etc.) are shown as unavailable.

### 8. VIDEO GENERATION — LIVE (text-to-video) / BETA (image-to-video)
- /studio/video. Async jobs with polling and progress, a Video Library with thumbnails, and downloads. Image-to-video was never verified end to end (it failed due to the AI balance, not wiring). AI: built-in gateway video model. Cost key: video:short.

### 9. MUSIC CREATION (MUSIC STUDIO)
- Lyrics writing with genre and AI enhancement — BETA (built-in gateway).
- Song/instrumental generation — CONNECTED (ElevenLabs). **Fails on the current free ElevenLabs plan**, which shows a friendly error and returns the credits.
- Voiceover (text-to-speech) — BETA, gated by plan.
- Voice cloning — PLANNED. Stem separation — PLANNED.
- Uploading audio — LIVE.

### 10. MUSIC VIDEO CREATION — BETA
- /studio/music-video. Timeline editor with clip split/duplicate/trim/crop/zoom, beat sync, effects, captions, AI scene planning, @image story references, per-scene AI generation with stop, project autosave to your account, and in-browser WebM export saved to Assets.
- Limits: no lip-sync. Each scene starts from one image. Export is limited to 60 s / 8 MB. Rendering happens in the browser.

### 11. CONTENT CREATION — BETA
- /content. 11+ content types and 34 tones (custom tone allowed). Results are saved to Assets.

### 12. BUSINESS AI — PLANNED
- There is no dedicated module. Business-type outputs come from Content, Director and Website Intelligence.

### 13. WEBSITE INTELLIGENCE — LIVE
- /website. Multi-page crawl safe against private-network access, a technical SEO audit, and an AI strategy report saved as an Asset. Cost key: website_analysis:standard.

### 14. SOCIAL INTELLIGENCE — COMING_SOON
- /social. Shows "connect" prompts only. No social platform APIs are connected (needs OAuth apps per platform).

### 15. AI APP BUILDER — BETA
- /app-builder. AI blueprint, starter source files (up to 12), an interactive HTML preview and a zip download. The generated code is not deployed or run.
- Website Builder (/site-builder) — BETA: generates, edits by instruction, previews and downloads a single-file website.

### 16. PROJECTS — LIVE
- /projects, /projects/$id. Create projects and group assets and workflows. Table: projects.

### 17. ASSETS (labelled "Library") — LIVE
- /assets. Upload, filter, play, download, delete, favourite, and 7-day share links. Storage: private "assets" bucket. Library links are refreshed whenever the Library loads (6 h). Asset URLs saved in other places use 1-year signed links that can expire.

### 18. JOBS (labelled "History") — BETA
- /history plus progress meters in each studio. Every billable job holds credits, then is charged or refunded. Stuck-job recovery is not yet automatic. Table: generations.

### 19. AUTOMATIONS — BETA
- /automations. Multi-step automations (action steps plus AI condition steps) with manual runs and run history. Scheduling is stored in the database but not yet triggered. Webhook triggers are PLANNED.

### 20. AGENTS — PLANNED
- /agents only lists the built-in agent definitions. You cannot run, create or edit agents. (Its label was corrected from "live" to "foundation" during this audit.) Tables: agents, agent_runs (unused).

### 21. WORKFLOWS — BETA
- Same engine as the AI DIRECTOR (workflows/workflow_tasks). Shown on the Dashboard under "Active workflows".

### 22. ANALYTICS — PLANNED
- Only credit usage history and the dashboard overview exist. There are no product or usage analytics for customers.

### 23. INTEGRATIONS — BETA
- Settings provider list with connection status. BYOK Google Gemini adapter written (text, vision, image) with a "Test key" button. **Not verified, because no key is saved.**
- OpenAI, Anthropic, local and video/music/speech BYOK entries are catalog-only (PLANNED).
- Email: auth emails exist. Custom sending domain is pending DNS. No email marketing/inbox integrations exist (PLANNED).

### 24. ACCOUNT/BILLING — LIVE
- /billing, /pricing (public), /settings, /admin, legal pages. Stripe checkout for plans and credit packs, a credit wallet that spends plan credits first, then bonus, then purchased, holds/capture/refund, renewals, prorated upgrades, refunds/disputes remove credits, and a billing portal.
- Live purchase verified 30 Sep 2026. Live plan renewal, cancel/reactivate and refund are not yet verified live.
- Account: change email/password, password reset, delete account. Admin can edit credit costs, plan labels/credits, packs, feature flags and provider on/off.

## E. Planned capabilities
AI Research (web search), Business AI module, Social Intelligence integrations, runnable/custom Agents, scheduled and webhook automations, voice cloning, stem separation, lip-sync, true video-to-video, dedicated object/background removal, server-side video rendering, customer analytics, OpenAI/Anthropic BYOK, an email integration, a public API.

## F. Product terminology

Official terms: OMNIAI HUB, AI DIRECTOR, CREATIVE STUDIO, PHOTO STUDIO, VIDEO EDITOR, MUSIC STUDIO, MUSIC VIDEO, PROMPT LAB, BUSINESS AI, APP BUILDER, PROJECTS, ASSETS, JOBS, SETTINGS, INTEGRATIONS.

Inconsistencies found (not yet renamed):
| Current label | Official term | Notes |
|---|---|---|
| Image Studio | PHOTO STUDIO (editing) / CREATIVE STUDIO (generation) | Generation and editing share one page |
| Video Studio | VIDEO EDITOR + video generation | One page mixes generation and a draft editor that can't render |
| Music Video Studio | MUSIC VIDEO | "Studio" suffix |
| Prompt Studio | PROMPT LAB | |
| Library (29 uses) | ASSETS | The route is /assets but the label says Library |
| History, Generation Jobs, Video Library | JOBS | Three names for job lists |
| Content Studio | CREATIVE STUDIO or BUSINESS AI | Needs a decision |
| Website Builder vs App Builder | APP BUILDER | Two overlapping builders |
| Omni / Omni Core / Council | AI DIRECTOR family | Chat modes overlap with the Director |
| Integrations | Lives inside Settings ("Providers") | No standalone page |
| Billing | Not in the official list | Suggest adding ACCOUNT/BILLING |

Duplicates and overlaps:
- Two timeline editors: the Video Studio draft and the Music Video editor (only the second renders).
- Two builders: App Builder and Website Builder.
- Two job views: History and per-studio libraries.
- Chat Omni mode and the AI Director both plan multi-step work.
- Backend terms differ from the UI: "generations" = Jobs, "workflows" = Director runs, `paddle_*` columns hold Stripe IDs.

## G. Architecture overview
Client (React app) → typed server functions → services (credits, jobs, workspace, AI) → database + file storage + AI providers. Payment-service webhooks and scheduled callbacks go through public HTTP endpoints that each verify the caller.

## H. AI provider architecture
Layers: contracts (result types) → router (quality/speed/cost model selection with fallbacks) → adapters (one per provider) → executor (validate, route, hold credits, run, normalise). Pricing never lives in adapters; it comes from the editable credit-cost table. Providers: platform AI gateway (default), Google Gemini BYOK (written), ElevenLabs (music). Unconnected providers report "not connected" and never return invented results.

## I. Storage architecture
A single private bucket, one folder per user. Assets are reached only through signed links. The Library refreshes its links each time it loads. Uploads go straight from the browser into storage.

## J. Project/Asset architecture
Projects contain Assets, Workflows and Jobs (all optional). An Asset is any file or text output (image, video, audio, document, report, lyrics, app source, website) with metadata linking it to the Job or Workflow that produced it.

## K. Job architecture
Every paid action holds credits first. On success it records a completed Job and takes the credits. On failure it marks the Job failed and returns the credits, unless the cost is set to charge on provider failure. Async video uses provider job IDs plus polling, and only the poll that actually completes the job charges. Retries reuse the same hold, so they are never charged twice.

## L. Security requirements
- Row-level security on every user table.
- Roles live in a separate table, and admin checks happen on the server.
- Secrets stay on the server only.
- Webhooks are verified by signature, deduplicated, and protected against out-of-order delivery.
- Website fetching is protected against private-network access.
- Plan entitlement checks happen on the server.
- Credits and plan can only be changed by billing (enforced by a database trigger).
- User instructions to the AI can't override system rules.

## M. Commercialization requirements
- Legal pages (Terms, Privacy, Refund with a 30-day policy) name DarkMisfitStudios.
- Public pricing page.
- Card payments through Stripe, which handles tax and compliance. Paddle declined generative AI products.
- Test and live modes are kept separate.
- Credits are granted exactly once per payment.
- Customers are told plainly when a failure is on the platform's side.

## N. Customer plan architecture (dimensions only — no prices decided)
| Capability | Possible usage dimensions |
|---|---|
| AI Chat | messages, model tier, Council mode access |
| AI Director | runs, steps per run, scheduled runs |
| Image | generations, HD quality, advanced AI edits |
| Video | generations, seconds, resolution, image-to-video |
| Music | songs, seconds, voice generations, lyrics |
| Music Video | renders, export length/quality, AI scenes |
| Content / Prompt Lab | generations, optimisations |
| Website / Social | analyses, pages crawled, connected accounts |
| App/Website Builder | blueprints, scaffolds, previews |
| Automations / Agents | runs, schedules, steps |
| Storage / Projects | GB stored, project count, share links |
| Platform | API access, BYOK, commercial-use rights, priority processing, available models/providers |

Current state: prices and credits are set in the payment service and the editable cost/plan tables. Feature flags control which plans include which features. These are unchanged by this audit.

## O. Known limitations
- AI service balance is depleted, so production AI is blocked until topped up.
- ElevenLabs is on the free plan, so song generation fails.
- Video editor drafts don't render a file. Music video export happens in the browser and is capped at 60 s / 8 MB.
- No lip-sync, voice cloning, stems, or dedicated background/object removal.
- Director tasks advance only while the page is open.
- Agents and social are non-functional.

## P. Technical debt
- Some held credits on failed jobs aren't refunded until automatic recovery is built.
- 1-year signed links are stored on some records.
- `paddle_*` column names hold Stripe data.
- Two timeline editors.
- Large page files (60k+ characters).
- The legacy recordUsage path is still used by video polling.
- Status labels in the module registry only have "live"/"foundation" (doesn't match this spec's 6 statuses).

## Q. Future roadmap
1. Top up the AI balance and re-verify every LIVE/BETA item.
2. Automatic stuck-job recovery and hold refunds.
3. Scheduled automations.
4. Media link refresh and cleanup.
5. Terminology pass.
6. Plan/pricing structure, aligned with the Base44 implementation.
7. Planned capabilities in section E.

---

# PART 2 — LOVABLE IMPLEMENTATION MAP

| Area | Implementation |
|---|---|
| Frontend | React 19, TanStack Router/Start (file routes in src/routes), Tailwind v4 tokens, shadcn UI |
| Server | TanStack server functions (`*.functions.ts`), server-only helpers (`*.server.ts`), public HTTP routes under /api/public (payments webhook) |
| Hosting | Edge worker runtime (Cloudflare-style) via Lovable publish; custom domain hub.darkmisfitstudios.com |
| Database | Postgres (Lovable Cloud / Supabase), SQL migrations in drizzle/migrations (source of truth), RLS + security-definer RPCs for credits |
| Auth | Supabase Auth (email/password, reset), bearer token attached to server calls |
| Storage | Supabase Storage private bucket "assets", signed URLs |
| AI | Lovable AI Gateway (LOVABLE_API_KEY): text, vision, image, video, TTS; Google Gemini direct (GOOGLE_API_KEY, not set); ElevenLabs (connector) |
| Billing | Stripe via Lovable payments connector (sandbox + live keys, webhook secrets), credit wallet in Postgres |
| Env/secrets | LOVABLE_API_KEY, STRIPE_*_API_KEY, PAYMENTS_*_WEBHOOK_SECRET, ELEVENLABS_API_KEY, LOVABLE_CRON_SECRET, SUPABASE_* |
| Abstractions | AI contracts/router/adapters/executor; jobs.server (runJob, holdCredits); credits.server (costs, flags, error classes); workspace.server (assets) |

### PORTABLE OMNIAI HUB LOGIC (preserve)
- AI contracts, router, tool registry, model catalog
- Credit wallet SQL functions (reserve/capture/release/grant/revoke)
- Job lifecycle (runJob, holdCredits)
- Cost/feature-flag model
- Director planning/execution logic
- Music-video timeline engine (mv-engine)
- Website crawler with private-network protection
- Webhook dedupe/ordering rules
- Legal copy, all UI components and design tokens
- SQL migrations (standard Postgres)

### LOVABLE-SPECIFIC IMPLEMENTATION
- Lovable AI Gateway calls (gateway.server)
- Lovable Cloud project provisioning and generated client files (src/integrations/supabase/*)
- Lovable payments connector key naming and webhook setup
- Lovable publish/hosting and cron secret helper
- Lovable email auth templates route

## Phase 8 — Portability classification
| Dependency | Class | Notes |
|---|---|---|
| Authentication (Supabase Auth) | PORTABLE WITH REFACTORING | Works with any Supabase project; another auth provider needs middleware rewrite |
| Database (Postgres + RLS) | PORTABLE | Standard SQL migrations; RLS relies on Supabase auth.uid() |
| Storage | PORTABLE WITH REFACTORING | Supabase Storage API; swap for S3-compatible needs workspace.server changes |
| AI APIs | LOVABLE-DEPENDENT | Gateway-only for most capabilities; adapter layer allows swap to direct provider keys |
| Server functions | PORTABLE WITH REFACTORING | TanStack Start is open source; edge-runtime constraints apply |
| Environment variables | PORTABLE | Re-create secrets on the new host |
| Billing (Stripe) | PORTABLE WITH REFACTORING | Stripe account is yours; connector key names and webhook URL change |
| Scheduled tasks | NOT YET IMPLEMENTED | Lease table exists; no scheduler wired |
| Background processing | NOT YET IMPLEMENTED | Work runs in request or via client polling |
| Routing | PORTABLE | File-based TanStack Router |
| Deployment | LOVABLE-DEPENDENT | Lovable publish; standard Vite build can target other edge hosts |
| User management / roles | PORTABLE | user_roles table + has_role function |
| Email (auth emails) | LOVABLE-DEPENDENT | Lovable email templates/webhook; sending domain pending DNS |

## Phase 10 — Verification record
| Capability | Evidence | Date |
|---|---|---|
| Live Stripe purchase + exactly-once credit grant | Database + payment events | 30 Sep 2026 |
| Image generation, text-to-video, Director image/video outputs | Owner reports + saved assets | Sep 2026 |
| Website Intelligence report | Owner report (in-depth) | Sep 2026 |
| Timeline persistence, layouts | Browser checks | Sep 2026 |
| Any AI call | **Blocked** by depleted AI service balance | 1–3 Oct 2026 |
| Gemini BYOK, Omni/Council, image-to-video, songs | Never verified | — |
