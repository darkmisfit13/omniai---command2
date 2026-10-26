# Free Media Generation — Step-by-Step Setup

OmniAI's **Media Studio** (sidebar → *Media Studio*, route `/media`) lets you:

- **Upload** images, video and audio into a private, owner-only library.
- **Generate** images, music and video through a **cloud-first, free-first** router.

The router is defined in [`config/generation.json`](../config/generation.json). For each
pipeline it tries providers in order. Free first, then fallbacks:

| Pipeline | Order (free → fallback) |
|---|---|
| Image | `pollinations_image` (keyless) → `huggingface` → `cloudflare` → `google_gemini_image` |
| Music | `huggingface` → `pollinations_gen` (paid) |
| Video | `pollinations_gen` (paid) → `huggingface` |

**Rules baked in:**

- Media is **cloud-only**. There is **no local fallback** for image/music/video — a bad config edit
  fails loudly at startup instead of cooking your laptop.
- If a provider is **out of quota** (HTTP 429/402) or **missing a key**, the router moves to the next
  cloud provider. If **all** are unavailable it does **not** generate locally — it raises a
  **Provider notice** in Media Studio so you can add/rotate a key.
- Local processing stays enabled only for **lightweight text/diagnostics** (Ollama).

> **Reality check on "free":** keyless free image generation is genuinely available.
> Free cloud **music** is limited (Hugging Face free credits). Free cloud **video** basically
> doesn't exist — video/music on Pollinations cost **Pollen credits** (cheap, not free). The router
> handles this honestly: it pauses and tells you rather than pretending.

---

## Verify your keys: the Providers panel

Open **Media Studio → Providers**. Each pipeline lists its providers **in order**, with badges:

- **ready** (green) — the key/account is present and the provider supports this pipeline.
- **key set** / **needs `ENV_VAR`** — whether the required env var is configured.
- **Test** — fires one tiny throwaway request (an image test even shows a thumbnail preview).
- **Test all in order** — checks every provider in that pipeline.

Providers that need a key or account id now show a **key box** right in this panel: paste the value
and click **Save** (see *0b. Paste keys right in the app*). No Vercel trip needed.

Nothing is stored and no alert is raised by a test. Use it right after pasting a key to confirm it
works. Remember keys are read per-request: locally restart `next dev`; on Vercel add the variable
(or save it in the app) and **redeploy**.

---

## Prerequisite: `OMNIAI_OWNER_ID`

Media Studio (including the test panel) only works for the **verified owner**. The server checks the
signed-in Supabase user id against `OMNIAI_OWNER_ID`:

- **Local:** already set in `omniai/.env.local` as
  `OMNIAI_OWNER_ID=07332edf-15ce-434b-b683-4c68a7277030`. Restart `next dev` after editing it.
- **Vercel:** Project → **Settings → Environment Variables** → add
  `OMNIAI_OWNER_ID=07332edf-15ce-434b-b683-4c68a7277030` (Production + Preview), then **redeploy**.

If it is missing you'll see *"Media owner access is not configured."*

---

## 0. Apply the database migrations (one time)

Two migrations, both **re-runnable and non-destructive** (they never drop anything):

1. `omniai/supabase/migrations/20261012120000_add_media_library.sql` — the private `media` bucket,
   the `media_assets` table and the `provider_alerts` table.
2. `omniai/supabase/migrations/20261012130000_add_provider_keys.sql` — the `provider_keys` table
   used by the in-app key box (skip this one if you'll only use server env vars).

**Option A — Dashboard SQL Editor (recommended, no password needed):**

1. Open your project → **SQL Editor** → **New query**.
2. Paste the whole of `20261012120000_add_media_library.sql`, **Run**, confirm **Success**.
3. Repeat with `20261012130000_add_provider_keys.sql`. If it errors (e.g. "relation auth.users does not exist"), run this simpler SQL directly in the SQL Editor instead:

```sql
-- Minimal provider_keys setup (works when auth.users isn't visible)
DO $$
DECLARE
  verified_owner uuid := '07332edf-15ce-434b-b683-4c68a7277030';
BEGIN
  CREATE TABLE IF NOT EXISTS public.provider_keys (
    env_name text PRIMARY KEY,
    ciphertext text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.provider_keys ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_keys TO authenticated;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='provider_keys' AND policyname='verified owner access'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING ((SELECT auth.uid()) = %L::uuid) '
      || 'WITH CHECK ((SELECT auth.uid()) = %L::uuid)',
      'verified owner access', 'provider_keys', verified_owner, verified_owner
    );
  END IF;
END
$$;
```

**Option B — Supabase CLI:**

```bash
cd omniai            # the folder with supabase/
supabase db push     # applies every file in supabase/migrations/
```

> The CLI needs the project linked first (`supabase init`, then `supabase link --project-ref
> caceyepfqgbgjbvvmvzd`), and will ask for your database password. If that is a hassle, use Option A.

If the SQL editor warns that a query *"may break or delete things"*, you almost certainly have an
older copy of these files that used `DROP POLICY`. The current files drop nothing; re-copy them.

If the migration reports **insufficient privilege** while creating the storage policies, the tables
were still created. Finish by hand in the Dashboard: **Storage → media → Policies** → add four
owner-only policies on `bucket_id = 'media'` (SELECT / INSERT / UPDATE / DELETE).

If you skip this entirely, image generation still returns the bytes but the app will tell you storing
failed and to run the migration.

---

## 0b. Paste keys right in the app (recommended)

Instead of editing Vercel env vars, you can paste a provider's key straight into **Media Studio →
Providers**. Every provider that needs a credential shows a **key box**.

1. Set one secret so the app can encrypt what you paste:
   - **Vercel:** Settings → **Environment Variables** → add `OMNIAI_KEY_SECRET` = a long random
     string (e.g. from `openssl rand -base64 48`), then **redeploy**.
   - **Local:** the same line in `omniai/.env.local`, then restart `next dev`.
2. In **Media Studio → Providers**, paste the key into that provider's box and click **Save**.
   The badge flips to **key set** / **ready** and **Test** should pass.

How it works:

- Keys are encrypted with **AES-256-GCM** using `OMNIAI_KEY_SECRET` and stored in your private
  Supabase (`provider_keys`, owner-only RLS). The value is **never returned to the browser** — the
  UI only learns *whether* a key is saved.
- A real **server environment variable always wins** over an app-saved value, so ops can override
  without touching the UI.
- **Remove** deletes an app-saved key. If `OMNIAI_KEY_SECRET` is unset the box is disabled and tells
  you so (and you can still use plain server env vars).

---

## 1. Image generation — **no key required** ✅

Nothing to do. The default provider is the keyless Pollinations image endpoint
(`https://image.pollinations.ai/prompt/...`). Type a prompt in Media Studio and hit
**Generate image**.

It is rate-limited (~1 request / 15s, anonymous) and watermarked unless you use an account token.
That's the tradeoff for needing zero setup. For more headroom, add any of the fallbacks below.

---

## 2. Hugging Face token (free monthly credits) — unlocks image fallback + music

1. Go to **https://huggingface.co/join** and create a free account.
2. Open **https://huggingface.co/settings/tokens**.
3. Click **Create new token** → type **Read** (or "Fine-grained" with *Make calls to Inference
   Providers* enabled). Copy the token (`hf_...`).
4. Add it to **both** of these places:
   - Local: `omniai/.env.local` →
     ```
     HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxx
     ```
   - Deployed: Vercel → Project → **Settings → Environment Variables** → add
     `HUGGINGFACE_API_KEY`. Redeploy.
5. Free accounts get a monthly inference credit allowance. If you exceed it, the router raises a
   notice and tries the next provider.

Music uses `facebook/musicgen-small`; image fallback uses `black-forest-labs/FLUX.1-schnell`.
If a model shows "loading" (HTTP 503), wait ~30s and try again.

---

## 3. Cloudflare Workers AI (10,000 free neurons/day) — image fallback

1. Create a free Cloudflare account → **https://dash.cloudflare.com/sign-up**.
2. In the dashboard, open **Workers & Pages → AI** (Workers AI). Enable it.
3. Copy your **Account ID** from the dashboard URL or the Workers AI page sidebar.
4. Create an API token: **My Profile → API Tokens → Create Token**. Use the
   **"Workers AI"** template (permission `Workers AI: Read`), or a custom token with
   `Account.Workers AI: Edit`. Copy the token.
5. Set both:
   - Local `omniai/.env.local` →
     ```
     CLOUDFLARE_ACCOUNT_ID=your-account-id
     CLOUDFLARE_API_TOKEN=your-token
     ```
   - Vercel → Environment Variables → add both. Redeploy.

Free plan includes **10,000 neurons/day**. When it runs out the router raises a notice.

---

## 4. Google Gemini key — and why it kept trying to charge you

The free tier lives in **Google AI Studio**, not Google Cloud. The "it says free but tries to
charge me" trap is almost always one of:

- You created the key in a **Google Cloud project with billing enabled**, or
- You used **Vertex AI** (which is billed) instead of the **Gemini Developer API**, or
- The model you picked isn't in the free tier.

**Free path (do this):**

1. Go to **https://aistudio.google.com/app/apikey** (sign in with your Google account).
2. Click **Create API key**. If asked to choose a project, pick **Create new project** — do **not**
   attach a billing account.
3. Copy the key (`AIza...`).
4. Set:
   - Local `omniai/.env.local` →
     ```
     GEMINI_API_KEY=AIza...
     ```
   - Vercel → Environment Variables → add `GEMINI_API_KEY`. Redeploy.

Notes:

- The app reads `GEMINI_API_KEY`, or falls back to `GOOGLE_API_KEY` if you already had one.
- The free tier is **rate-limited** (requests/minute + per-day). Text models are comfortably free;
  **image generation may still require billing** on Google's side, so treat `google_gemini_image`
  as a *fallback*, not your primary. Pollinations (no key) is your primary image path.
- **Never** link a billing account if you want to guarantee free.

---

## 5. Pollinations gen key (Pollen credits) — for video + music

Video and music on the new Pollinations platform are **paid in Pollen credits** (this is not free,
but it's cheap and zero-setup).

1. Go to **https://enter.pollinations.ai/keys** and create an account.
2. Create an API key and copy it.
3. Set:
   - Local `omniai/.env.local` →
     ```
     POLLINATIONS_API_KEY=your-key
     ```
   - Vercel → Environment Variables → add it. Redeploy.

Used for `video` (e.g. `veo-3.1-fast`) and music (`elevenmusic`). Without it, video/music
generation pauses with a notice — exactly as intended.

---

## 6. The seven newer providers (queue APIs, 2026-10)

These sit **after** the free basics in every `order` array — free first, paid last. Paste their keys
in **Media Studio** (they appear automatically) or add them as env vars.

| Provider | Media | Key env var | What it costs | Notes |
|---|---|---|---|---|
| **AI Horde** | image | `AIHORDE_API_KEY` *(optional)* | **Free, no key** | Works anonymously, so it's ready immediately. Anonymous requests are capped at **576×576** — over that the Horde returns `KudosUpfront` until you register free at [aihorde.net](https://aihorde.net) for a key with kudos. Queued, so expect 30–120 s. |
| **Puter.js** | image | `PUTER_AUTH_TOKEN` | **Free**, billed to your Puter account | Create a **Client Token** at [developer.puter.com](https://developer.puter.com). No per-call API key needed. |
| **Pixazo** | image, video, music | `PIXAZO_API_KEY` | Free tier (card required) | Images use the free SDXL Lightning endpoint (sync). Music and video are queued. Activating the free tier requires a credit card on file — it is never charged. |
| **fal.ai** | image, video | `FAL_KEY` | Sign-up credits, then usage | Queue API. Create a key at [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys). |
| **APIFrame** | image, video, music | `APIFRAME_API_KEY` | Paid | One key for all three media types. Returns `402` when credits run out → treated as **quota**, so you get the "switch provider" notice. |
| **ElevenLabs** | music | `ELEVENLABS_API_KEY` | Paid only | Studio-grade music, synchronous (returns audio bytes directly). |
| **ZSky** | image, video | `ZSKY_API_KEY` | Paid | Needs a **prepaid balance or a Pro/Max plan** — the API has no free tier (only the web app does). |

> **FreeMusicLab was deliberately left out:** its API is upload/list/delete over an existing track
> catalog and has **no generation endpoint**, so it can't turn a prompt into music. It's a candidate
> for a future "browse free music" feature instead.

### The provider time budget

Both generate routes run with `maxDuration = 60` on Vercel. A queued provider that runs past that
gets the whole function killed — losing every remaining fallback — so each attempt defaults to **45 s**
and then fails over cleanly. Override it only if you also raise `maxDuration`:

```
OMNIAI_PROVIDER_TIMEOUT_MS=45000
```

---

## Where keys go (important)

- **Media generation runs in Next.js route handlers**, so server keys are **Vercel Environment
  Variables** (and `omniai/.env.local` locally). They are **server-only** — never prefix with
  `NEXT_PUBLIC_`.
- Alternatively, key values you paste in **Media Studio** are stored (encrypted) in your Supabase
  `provider_keys` table and read server-side per request. Env vars still take precedence.
- The older chat/web-search keys (`TAVILY_API_KEY`, Anthropic, etc.) live in **Supabase Edge
  Function secrets**, which is a *separate* store. Media keys do **not** go there.

---

## Turning off / reordering providers

Edit [`config/generation.json`](../config/generation.json):

- Change the `order` array for a pipeline.
- `allow_local_fallback` **must stay `false`** for `image`, `music`, `video` — the app refuses to
  boot if you flip it, by design.

## Adding a brand-new provider

1. Add an entry under `providers` with a `transport` and `models`.
2. Put it in a pipeline's `order`.
3. If it needs a new HTTP shape, add a case in
   [`lib/generation/providers.ts`](../lib/generation/providers.ts).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "storing it failed" | Migration not applied. Run step 0. |
| "Could not find the table 'public.media_assets'" | Migration not applied. Run step 0. |
| SQL editor says the migration "may break or delete things" | You have an old copy that used `DROP POLICY`. Re-copy the current file (it drops nothing). |
| "Media owner access is not configured" | Set `OMNIAI_OWNER_ID` (see the prerequisite section). |
| Key box is disabled / "Set OMNIAI_KEY_SECRET…" | In-app key storage is off. Set `OMNIAI_KEY_SECRET` (step 0b) or use server env vars instead. |
| Save fails with "provider_keys table is missing" | Apply the second migration `20261012130000_add_provider_keys.sql` (step 0). |
| Notice: *"…needs its API key"* | That provider's env var is empty. Add it (step 2–5) or paste it in the app (step 0b). |
| Notice: *"…out of quota/rate limited"* | Free limit hit. Wait, or add a different provider's key. |
| Music/video pauses | No key with cloud music/video access. Add `POLLINATIONS_API_KEY` or `HUGGINGFACE_API_KEY`. |
| Image is watermarked | Anonymous Pollinations. Add `POLLINATIONS_API_KEY` (nologo) or use a fallback key. |
