# AI Provider Setup (Admin → AI Providers)

Every AI provider the platform routes to — chat models, image, video, music and
speech — is managed from one owner-only console:

**Sidebar → Settings → Admin → AI Providers tab**

(The old "AI API Connector" sidebar entry pointed at a mock page; it now lands
on this console.)

---

## 1. One-time setup

Do these once, in order:

| Step | What | Where |
| --- | --- | --- |
| 1 | Set `OMNIAI_OWNER_ID` to your Supabase auth user id | Vercel → Settings → Environment Variables (or `.env.local`). Find the id in Supabase → Table editor → `auth.users`. |
| 2 | Set `OMNIAI_KEY_SECRET` (long random string, e.g. `openssl rand -base64 48`) | Same place. Required so keys saved **in the app** are encrypted at rest (AES-256-GCM). |
| 3 | Run migration `supabase/migrations/20261017130000_add_provider_settings.sql` | Supabase → SQL editor. Adds the `provider_settings` table behind the enable/disable switches. The console still works without it — only the switches report unavailable. |
| 4 | Deploy / restart | The routes read env at runtime. |

Without `OMNIAI_OWNER_ID` the console (and key saving) returns **503/403 for
everyone** — that gate is deliberate.

Keys can be provided two ways, and **environment variables always win**:

- **Server env** (recommended for CI/Vercel): export the vars listed below.
- **In-app console**: paste a key in Admin → AI Providers. It is encrypted
  server-side and never sent back to the browser. Storing a new value replaces
  the old one; "Disconnect" deletes it.

---

## 2. Providers

Ids come from `config/generation.json` — the single provider registry. The
`chat` pipeline order is the failover order; free tiers run first and local
Ollama runs last.

### Chat & reasoning → `/api/ai/chat`

| Provider | Env var | Default model | Notes |
| --- | --- | --- | --- |
| `gemini` | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | `gemini-2.0-flash` | Google AI Studio, free tier — tried first. |
| `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | Free, very fast. Override with `GROQ_MODEL`. |
| `lovable` | `LOVABLE_API_KEY` | `openai/gpt-6-astra` | Lovable AI Gateway — one key for text/image/video/speech. |
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` | ChatGPT / OpenAI platform. |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | Claude (native Anthropic API). |
| `xai` | `XAI_API_KEY` | `grok-4` | Grok. |
| `perplexity` | `PERPLEXITY_API_KEY` | `sonar` | Search-grounded answers. |
| `moonshot` | `MOONSHOT_API_KEY` | `kimi-latest` | Kimi. |
| `copilot` | `COPILOT_API_KEY` | `gpt-4o` | GitHub Copilot (Chat) token — editor headers sent automatically. |
| `local_ollama` | — (`OLLAMA_BASE_URL`) | `qwen2.5:0.5b` | Laptop-only last resort, keyless. |

Consumers: AI Director chat fallback, OmniWave lyrics/enhance, Prompt Studio,
and any client that POSTs `/api/ai/chat` with `{ prompt }` or `{ messages }`.

### Voice & speech → `/api/generate` `pipeline: "voice"`

| Provider | Env var | Model | Notes |
| --- | --- | --- | --- |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `eleven_multilingual_v2` | Your ElevenLabs standard plan. Voice id: `ELEVENLABS_VOICE_ID` (defaults to Rachel `21m00Tcm4TlvDq8ikWAM`). Output MP3 44.1 kHz/128 kbps. |
| `lovable` | `LOVABLE_API_KEY` | `google/gemini-3.1-flash-tts-preview` | Fallback. Voice name via `LOVABLE_TTS_VOICE` (default `Kore`). |

Consumers: Voice Studio "Generate speech", OmniWave "Render voiceover".
No local fallback — voice is hard-disabled for it in config.

### Music → `/api/generate` `pipeline: "music"`

Order: `huggingface`, `pixazo`, `elevenlabs` (your plan — Music v2.5),
`pollinations_gen`, `apiframe`. OmniWave's "Generate full song" runs here.

### Image / video

Unchanged free-first chains (Pollinations keyless first). `lovable` was added
near the end of both orders (image: `google/gemini-3.1-flash-image`, video:
`google/gemini-omni-1.1-flash`).

---

## 3. What the console can do (owner only)

- **Connect / replace / disconnect** each provider's key (encrypted at rest).
- **Enable / disable** a provider *without* deleting its key — the media router
  and chat router both skip disabled providers (row in `provider_settings`).
- **Test** with one minimal real request: chat providers get
  `POST /api/ai/chat`, media/voice providers get `POST /api/generate/providers`.
  Every response shows the sanitized result (text excerpt, latency, model).
- See connection state at a glance: `SERVER ENV` / `SAVED IN APP` /
  `NOT CONNECTED` / `PAUSED`, plus capability chips (chat, image, video, music,
  voice) — keys are never displayed after saving.

## 4. Billing behavior

- **Owner bypasses all credit charges** (chat and generation).
- Non-owner chat: charged `text:standard`, refunded automatically if no
  provider answers. If billing RPCs aren't migrated yet, chat still runs
  uncharged instead of failing.
- Voice generation: `voice:standard` (10 credits, ≤ 500 chars) or
  `voice:long` (60 credits, ≤ 2500 chars) chosen automatically by script
  length; every failure path refunds the hold.

## 5. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Console says "Owner access only" | `OMNIAI_OWNER_ID` missing/wrong, or you're signed in with another account. |
| "In-app key storage is off" | Set `OMNIAI_KEY_SECRET` and redeploy. |
| Test fails with "rejected the API key" | Key revoked/typo at the provider — paste a fresh one. |
| Test fails with quota/balance | Top up the provider or disable it so the router moves on. |
| "Provider switches are unavailable" | Run the `20261017130000_add_provider_settings` migration. |
| Chat says no provider available | Check the attempt list in the response — it names each provider that failed and why. |

All of these env vars are documented in `.env.example` under
"Owner gate + AI provider console".
