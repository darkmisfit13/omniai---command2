# OmniAI Hub Roadmap

## Live holographic activity (Oct 14)
- [x] Make studio gauge counts and dials represent completed work over the last 24 hours, with running jobs shown separately
- [x] Upgrade the AI core and share real-activity effects across authenticated pages
- [x] Check signed-in dashboard, activity changes, and reduced-motion behavior — real Chat completion increased count 19 → 20 and dial; desktop/mobile no overflow or browser errors; two focused tests passed. Other studios use the same gauge logic but new generations were not run.

## App-wide editing and command center (Oct 12)
- [x] Consolidate Video tools and categorized media dialogs; compact viewer/timeline layout
- [x] Align Image generation mode, project bar, viewer, belt, prompt and History
- [x] Apply compact Music Video working view and shared media actions
- [x] Add activity-driven command center and app-wide holographic hover styling
- [x] Verify media actions, project selection and editing layout in signed-in preview — grouped Library, timeline insertion, format controls, project menu, rename persisted and restored; no browser errors. Playback/export not re-tested

## Shared studio tool belts
- [x] Standardize all editor tool belts and add real editing actions
- [x] Verify matching menus and editing actions in the signed-in studios (16 shared tools; duplicate, undo and rotation checked)

- [x] Production foundation: authentication, projects, assets, providers, AI Director, chat, image, content, prompts, website intelligence
- [x] Replace green product accent and glow with #ae00ff
- [x] Build Video Studio foundation and connect real async video generation
- [x] Make Director video tasks durable, self-refreshing, and resumable
- [x] Build Music Studio: lyrics, voiceovers, uploads, real playback controls, and honest song-generation limits
- [ ] Build Music Video Studio from real project media
- [ ] Build Social Intelligence integrations
- [x] Build Automations execution engine + hourly/daily/weekly schedules (webhook triggers next)
- [x] Build AI App Builder blueprint, real starter source generation, export, and Director handoff
- [x] Real credits: live balance, deduction per AI action, monthly plan refill, out-of-credit blocking, Billing page
- [x] Website Builder: generate, preview, edit, download websites
- [x] Payments enabled
- [x] Plan products + checkout + subscription logic (wallet/ledger, costs table, feature flags, job holds/refunds) — waiting on prices and purchase rules from user
- [x] Real music generation via ElevenLabs Music (songs + instrumentals)
- [x] App Builder: live in-browser preview + downloadable project zip
- [x] Run a Director workflow end-to-end (ran in Demo Mode)

- [x] Director planner tailored to the goal; website + music tasks runnable; retry failed steps
- [x] Website Intelligence: multi-page crawl + technical SEO audit + AI strategy
- [ ] Email domain notify.darkmisfitstudios.com — waiting on DNS records at the domain provider
- [ ] Audit business logic + payment implementation (catalog, auth, entitlement, renewal, gateway), list gaps, plan fixes
- [ ] Add plan products + checkout (Paddle) + subscription webhook logic — needs prices & purchase rules from user

- [ ] Move remaining tools (chat, video, voice, director, app builder) fully onto the shared job runner + cost confirmation
- [ ] Media library rename/delete/filter polish, Content Studio pipeline view
- [ ] Admin dashboard for plans/costs/flags

## Hardening pass (Sep 2026)

- [x] P0 SSRF-safe website fetching (pages, robots.txt, sitemap, redirects) + tests
- [x] P1 Signed checkout ownership, webhook event dedupe, out-of-order protection, checked DB writes + tests
- [ ] P1 Verify cancel/plan-change end to end against the test payment service (needs a real test checkout)
- [ ] P2 Move chat, website, app builder, voice, Director/automation tasks, video onto runJob (reserve/capture/release); remove remaining-balance fallback in recordUsage
- [x] P2 Stale-job recovery (hourly refund of stuck holds) + idempotent video polling
- [ ] P3 Director/registry honesty audit (unavailable tools never return generic text)
- [ ] P4 Signed-URL refresh, rate/concurrency limits, orphan-asset cleanup
- [ ] P5 Media library rename/delete/filter, music video from owned assets, social integrations, scheduled triggers, admin screen
- [x] P0 Fix Paddle fulfillment when transaction notifications omit price import metadata; reconcile verified test purchases idempotently
- [x] Sandbox renewal fulfillment verified (owner-confirmed, Sep 24 2026): renewal posted and credits increased by the correct amount
- [ ] Live payments: go-live verification + one real live purchase/renewal (real money — owner must run it)
- [ ] Live-mode checks: cancel-at-period-end, reactivate, refund/adjustment handling
- [ ] Move chat, website analysis, App Builder, voice, and video onto real provider-backed job fulfillment with authoritative costs
- [x] Admin dashboard: credit costs, plan names/credits/features, credit packs, feature access, provider on/off + default model + key status (prices stay in payment service)
- [ ] Build Music Video Studio from owned media-library assets with wallet cost estimates
- [ ] Refresh expiring asset links and enforce usage/cleanup limits

## Billing gaps (Sep 24)
- [x] Immediate prorated upgrades (Upgrade now + price preview); downgrades still at renewal
- [x] Refunds/chargebacks remove unused credits; full plan refund ends plan (webhook adjustment events subscribed, test + live)
- [x] Failed renewal keeps access with warning
- [x] Customer binding for credit-pack-only buyers (billing portal works); plan shared across test/live no longer dropped by a test cancel
- [x] Checked errors on plan-change saves
- [x] Settings: change email, change password, delete account
- [ ] Preview-test upgrade-now and refund flows (owner)

## Domain switch (Sep 24, 2026)
- [ ] Replace omniaihub.darkmisfitstudios.com with hub.darkmisfitstudios.com (user's own DNS + Lovable domain settings)
- [ ] Re-run Paddle domain review once hub subdomain is live

## Payments moved to Stripe (Paddle declined AI products)
- [x] Stripe connected, catalog recreated (same ids/prices), in-page checkout, webhook (dedupe, owner checks, renewals, upgrades, refunds/disputes), portal, legal pages updated
- [x] Owner: test purchase in preview (4242 4242 4242 4242) to confirm credits post — verified 2026-09-25: Business monthly upgrade active (sub_1UJNUH9xbpWu6xIiITssSnLR), 3,000 sub + 7,000 upgrade credits granted; 5,000-credit top-up granted; wallet 22,000
- [ ] Owner: claim Stripe account + go-live steps in Payments tab, then live purchase

## Sep 25 editor round
- [x] Exports findable + downloadable (library shows videos/music; real download button; export list with players)
- [x] Timeline stays fixed width and scrolls; snip tool follows mouse
- [x] Timeline saved between visits (this browser)
- [x] Library page: upload finished videos, download, 7-day share links; links refreshed on every load
- [ ] Owner: 60-second export walk-through with own clips
- [ ] Owner: live card purchase on hub.darkmisfitstudios.com after publish

## Studio usability round
- [x] Video prompts in a closable viewer; mobile width and preview/media controls repaired (preview-tested)
- [x] Video source images in prompt, preview generated results, and basic timeline split/duplicate/trim (preview-tested uploads and playback controls)
- [x] Image before/after, manual adjustments/transparent eraser with undo/redo, AI edit/reference choices and single-result billing (manual editor preview-tested)
- [x] Music lyrics and prompt enhancement controls with credit confirmation; provider invocation not preview-tested
- [ ] True video-to-video generation, AI object inpainting/masking, background removal fidelity and multi-reference image generation require supported provider capabilities; video draft timeline does not render an export (use Music Video for finished cuts)

## Studio round 3 (Sep 25)
- [x] AI Director: attach images/videos as references; Director sees pictures and uses first as base for image/video steps
- [x] AI Director: download buttons for image, video, audio and text results; links refresh so they don't expire
- [x] Video Studio: preview on top, working add image/video button (inside prompt box), multi-file upload, fixed-width progress bars
- [x] Video Studio: looks, colour/blur/speed/volume sliders, mirror, mute, set trim from playhead, undo/redo, downloads, "use this frame to generate"
- [x] Music Video Studio name in menu; preview moved above AI director
- [x] Phones no longer zoom/jump when tapping text boxes
- [ ] Video Studio rendered export with effects (currently in Music Video Studio only)

- [x] Studio upgrades (2026-09-25): image gallery delete/collapse, video job thumbnails + side edit panel + photo picker, Write full song + genre chips, Music Video @image story director with Stop/Redo/per-scene reference. Not browser-tested. Lip-sync unavailable.

## Reference editor layout (Sep 25)
- [x] Reorganize Video Studio and Music Video Studio around preview, scrollable video/audio/text tracks, and a compact bottom tool strip while preserving AI prompts and existing controls; Image Studio uses preview-first layout without a video timeline
- [x] Add practical preview sound, downloadable cover frame, and Music Video song start/end controls where supported; unavailable editing tools are not presented as working
- [x] Check phone and desktop layouts in the preview (all three studios loaded with no page errors or horizontal overflow)

## Nested studio menus (Sep 26)
- [x] Shared back-to-main editing menus with real available tools next to video, music-video and image previews; retain generation prompts
- [x] Separate collapsible uploaded image/video/audio libraries in Video Studio and rename generation jobs to Video Library
- [x] Content tone choices and Prompt Studio goal shortcuts with custom goal entry
- [x] Advanced requested tools that require new media processing, avatar, transcription or provider support are omitted from working menus rather than simulated

## Omni orchestration (spec upload)
- [x] Phases 1-4: contracts, provider adapters, model router, tool executor
- [ ] Phases 5-6: Omni Core in Chat and AI Director (both entry points), delegating complex goals to Director
- [ ] Phases 7-11: specialists, verification/repair, council, chat migration, UI

## Sep 30 Studio and Omni completion
- [x] Reorganize Video Studio editing controls and bounded thumbnail Video Library
- [x] Add explicit Director routing in Chat and Omni-first planning on AI Director
- [x] Build collapsible Chat locker with threads, modes, preferences, attachments, and reset
- [x] Join lyrics, genre, AI music, references, beat sync, timing, and timeline in Music Video Studio
- [ ] Browser-check all four surfaces and run one real image-to-video job (real generation remains owner-confirmed because it spends credits)

## Sep 30 dashboard and editor request
- [ ] Fix bounded expandable dashboard generation/workflow entries and Director run titles
- [ ] Add working multi-media references inside Dashboard and Director prompt boxes; tidy other prompt attachments
- [ ] Apply user palette throughout app and update video editor tools, media thumbnails and collapsible video library

## Music Video Studio scene references and editor organization
- [x] Move AI Director below timeline/tool belt and consolidate clip, crop, effects, transitions, and colour controls into tool menus
- [x] Let the scene planner inspect selected images and expose one-image-per-generated-scene limitation with still-frame fallback
- [ ] Verify a live benign accident scene and multi-reference identity/logo output (requires available AI generation balance and provider acceptance)

## Maintenance and media (Oct 7)
- [x] Hourly cleanup authenticates with a server-only key; refunds stuck holds, fails frozen jobs (verified: 1 hold refunded, 1 job failed)
- [x] Scheduled automations run from the hourly cleanup (hourly/daily/weekly picker on Automations page)
- [x] Fresh file links on dashboard + project pages; unsaved working uploads older than 7 days and unused by any project are deleted
- [x] Real music video: plan + one generated scene + reopen project verified; final render needs a normal browser (test browser can't play MP4)
- [ ] Publish so the hourly job reaches the live site

## Oct 10 — providers & 3-minute videos
- [x] fal.ai video clips (Kling) in Music Video Studio + per-clip rate (video:fal)
- [x] 3-minute music video cap, direct-storage export
- [x] Groq scene planner (verified live)
- [x] Free Pollinations images in Image Studio
- [x] Video providers page (/video-providers)
- [ ] fal.ai key rejected (401) — blocked on a valid key from the user
- [ ] Full music video run — blocked on a working video service (fal key or AI balance)

- [x] Apply OmniAI/Synaptex design tokens (panel colour, focus, glow, motion, nav highlight)
- [x] Social Intelligence page + automation event triggers + Library delivery

- [x] Official OAuth social connections (X, TikTok, LinkedIn) — waiting on owner to create sign-in apps
- [x] Automation run history page
- [x] PDF + CSV export of social profile reports
- [ ] Creative Studio upgrade (Video Studio + Music Video Studio) — Phase 1 findings reported, awaiting plan approval
