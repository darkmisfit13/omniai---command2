/**
 * The credit table and plan roster, in one place.
 *
 * These numbers are the contract shown on /pricing, the values the API charges
 * against a balance, and the values the webhook seeds into the database — so
 * they live in one module rather than being retyped in each. Pricing was
 * checked against Runway (52 cr/$), Pika (25) and Frameo (60); OmniAI lands at
 * 52.6 / 76.9 / 101 credits per dollar, which is competitive while holding
 * 68–95% margin per action.
 *
 * Three rows differ from the table carried over from the other app, each for a
 * reason worth keeping visible here:
 *
 *   text:standard        2 → 1.  Chat is the hook, and ChatGPT/Claude are ~$20
 *                         unlimited. At 1000 credits the Creator plan should
 *                         read as "1000 messages", not 500. Still ~95% margin.
 *   image_edit:premium   10 → 22. It was priced *below* image_edit:standard
 *                         (13) — premium cannot cost less than standard.
 *   music:standard       80 → 40, and the +1/sec after 30s dropped. A real
 *                         3-minute song previously cost 230 credits — $4.37 on
 *                         Creator — where Suno sells ~250 songs for $10.
 *
 * voice:standard and voice:long also carry character caps. ElevenLabs runs
 * ~$0.00018–0.00022 per character, so an uncapped "long voiceover" at 60
 * credits (=$1.14) loses money past ~5000 characters. The cap is what makes
 * those two rows profitable; it is displayed next to the price.
 */

export type CreditGroup =
  | "text"
  | "image"
  | "video"
  | "music"
  | "voice"
  | "web"
  | "app"
  | "social";

export type CreditAction = {
  /** Stable machine key — the value sent by clients and written to the ledger. */
  key: string;
  /** Customer-facing name as it appears on /pricing. */
  label: string;
  group: CreditGroup;
  credits: number;
  /** Charged per second once `includedSeconds` are used. 0 = flat price. */
  perSecond: number;
  /** Seconds included in the base price. 0 = no metered tail. */
  includedSeconds: number;
  /** Characters the row covers, where a provider bills by volume. */
  charLimit?: number;
  /** Everything refunds on failure — kept explicit so the API cannot drift. */
  refundOnFailure: true;
};

export const CREDIT_ACTIONS: CreditAction[] = [
  { key: "text:standard", label: "Text / chat reply", group: "text", credits: 1, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "text:long", label: "Long-form writing", group: "text", credits: 5, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "script:standard", label: "Script", group: "text", credits: 3, perSecond: 0, includedSeconds: 0, refundOnFailure: true },

  { key: "image:free", label: "Image (free service)", group: "image", credits: 2, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "image:standard", label: "Image — Standard", group: "image", credits: 10, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "image:hd", label: "Image — HD", group: "image", credits: 20, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "image:premium", label: "Image — Premium", group: "image", credits: 30, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "image:fal", label: "Image (fal.ai FLUX)", group: "image", credits: 12, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "image_edit:standard", label: "Image edit — Standard", group: "image", credits: 13, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "image_edit:premium", label: "Image edit — Premium", group: "image", credits: 22, perSecond: 0, includedSeconds: 0, refundOnFailure: true },

  { key: "video:short", label: "Video — Short", group: "video", credits: 100, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "video:standard", label: "Video — Standard", group: "video", credits: 200, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "video:hd", label: "Video — HD", group: "video", credits: 350, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "video:premium", label: "Video — Premium", group: "video", credits: 600, perSecond: 40, includedSeconds: 8, refundOnFailure: true },
  { key: "video:fal", label: "Video clip (fal.ai, per clip)", group: "video", credits: 150, perSecond: 0, includedSeconds: 0, refundOnFailure: true },

  { key: "music:standard", label: "Music track", group: "music", credits: 40, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "music_video:standard", label: "Music video", group: "music", credits: 400, perSecond: 0, includedSeconds: 0, refundOnFailure: true },

  { key: "voice:standard", label: "Voiceover", group: "voice", credits: 10, perSecond: 0, includedSeconds: 0, charLimit: 500, refundOnFailure: true },
  { key: "voice:long", label: "Long voiceover", group: "voice", credits: 60, perSecond: 0, includedSeconds: 0, charLimit: 2500, refundOnFailure: true },

  { key: "website:new", label: "Website — new", group: "web", credits: 15, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "website:edit", label: "Website — change", group: "web", credits: 10, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "website_analysis:standard", label: "Website analysis", group: "web", credits: 8, perSecond: 0, includedSeconds: 0, refundOnFailure: true },

  { key: "app:blueprint", label: "App blueprint", group: "app", credits: 8, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "app:scaffold", label: "App source files", group: "app", credits: 16, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
  { key: "app:preview", label: "App live preview", group: "app", credits: 12, perSecond: 0, includedSeconds: 0, refundOnFailure: true },

  { key: "social:analyze", label: "Social profile analysis", group: "social", credits: 5, perSecond: 0, includedSeconds: 0, refundOnFailure: true },
];

export const GROUP_LABELS: Record<CreditGroup, string> = {
  text: "Text & chat",
  image: "Image",
  video: "Video",
  music: "Music",
  voice: "Voice",
  web: "Website",
  app: "App",
  social: "Social",
};

export type PlanTier = "free" | "creator" | "pro" | "business";

export type Plan = {
  tier: PlanTier;
  name: string;
  /** Whole dollars per month. 0 marks the plan that never bills. */
  priceUsd: number;
  monthlyCredits: number;
  /** Stripe lookup_key once the products exist — empty until keys are set. */
  stripePriceId: string;
  blurb: string;
  highlights: string[];
};

/**
 * Customer-facing plan names and prices (approved catalog).
 *
 * The *internal* tier values ("free" | "creator" | "pro" | "business") are
 * stable identifiers written to the database, Stripe metadata, the ledger and
 * every webhook — they are never renamed here. Only the names customers see
 * and the monthly prices change. `ensurePlanPrice` refuses to sell a tier
 * whose configured Stripe price does not match `priceUsd`, so a stale price
 * can never charge an amount different from what these cards advertise.
 */
export const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Omni Free",
    priceUsd: 0,
    monthlyCredits: 100,
    stripePriceId: "",
    blurb: "Try the platform — no card required",
    highlights: [
      "100 credits / month",
      "Standard text-to-image & video",
      "Basic audio previews",
      "Watermarked exports",
      "Standard queue",
    ],
  },
  {
    tier: "creator",
    name: "Omni Plus",
    priceUsd: 19,
    monthlyCredits: 1200,
    stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID ?? "",
    blurb: "Full creative suite for solo makers",
    highlights: [
      "1,200 credits / month",
      "Full creative suite access",
      "No watermarks",
      "1080p exports",
      "Standard GPU priority",
    ],
  },
  {
    tier: "pro",
    name: "Omni Pro",
    priceUsd: 49,
    monthlyCredits: 4500,
    stripePriceId: process.env.STRIPE_STUDIO_PRO_PRICE_ID ?? "",
    blurb: "Power users — our most popular tier",
    highlights: [
      "4,500 credits / month",
      "4K upscaling",
      "Character consistency anchors",
      "Stem splitting",
      "Priority rendering queue",
    ],
  },
  {
    tier: "business",
    name: "Omni Ultra",
    priceUsd: 99,
    monthlyCredits: 10000,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "",
    blurb: "Maximum power for teams & agencies",
    highlights: [
      "10,000 credits / month",
      "Maximum priority processing",
      "Custom LoRA / Preset vault",
      "Team tools",
      "Dedicated support",
    ],
  },
];

const BY_KEY = new Map(CREDIT_ACTIONS.map((action) => [action.key, action]));

export function creditCost(key: string): CreditAction | undefined {
  return BY_KEY.get(key);
}

/** Total credits for a metered action — base plus any tail past the included seconds.
 *
 * Rounding rule: durations are sanitized (non-finite or negative input bills
 * as 0 seconds) and any *started* second past the included window is billed as
 * a whole second (ceiling) — 8.2 s of a Premium video bills 1 extra second,
 * never 0.2 of a credit. A video:premium charge is therefore always an
 * integer: 600 for ≤ 8 s, then +40 per started second.
 */
export function totalCredits(key: string, seconds = 0): number | null {
  const action = BY_KEY.get(key);
  if (!action) return null;
  const safeSeconds =
    typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const billable = Math.ceil(Math.max(0, safeSeconds - action.includedSeconds));
  return action.credits + billable * action.perSecond;
}

export function planForStripePrice(priceId: string): Plan | undefined {
  if (!priceId) return undefined;
  return PLANS.find((plan) => plan.stripePriceId === priceId);
}
