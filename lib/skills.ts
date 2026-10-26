/**
 * Skill catalog for the chat sidebar.
 *
 * A skill is a standing instruction folded into the next message, so the
 * model switches into a mode without the user having to re-explain what
 * they want each time. Keep the instruction short: it ships with every
 * turn while the skill is active.
 */

export type SkillGroup =
  | "Craft"
  | "Code"
  | "Reason"
  | "Media"
  | "Voice"
  | "Studio"
  | "Work";

export type Skill = {
  id: string;
  name: string;
  group: SkillGroup;
  /** Shown in the picker. One line. */
  blurb: string;
  /** Folded into the outgoing prompt while the skill is active. */
  instruction: string;
};

export const SKILL_GROUPS: SkillGroup[] = [
  "Craft",
  "Code",
  "Reason",
  "Media",
  "Voice",
  "Studio",
  "Work",
];

export const SKILLS: Skill[] = [
  /* ------------------------------ Craft ------------------------------ */
  {
    id: "story",
    name: "Story craft",
    group: "Craft",
    blurb: "Plot, scene work, character",
    instruction:
      "Act as a fiction editor. Protect show-don't-tell, active verbs and concrete sensory detail. Flag clichés and drift in the character's voice. When rewriting, keep the author's intent and improve rhythm, not just vocabulary.",
  },
  {
    id: "poetry",
    name: "Poetry",
    group: "Craft",
    blurb: "Line, image, metre",
    instruction:
      "Write and edit poetry with deliberate line breaks, sound patterning (assonance, consonance, enjambment) and image over abstraction. Name the form only if it earns its place. Prefer one true image to three decorative ones.",
  },
  {
    id: "lyric",
    name: "Song lyrics",
    group: "Craft",
    blurb: "Verses that sing",
    instruction:
      "Write singable lyrics: stressed syllables land on strong beats, vowels stay open on held notes, and the hook is repeated. Use [Verse]/[Chorus]/[Bridge] tags. Rhyme sparingly — a near-rhyme often beats a forced one.",
  },
  {
    id: "screenplay",
    name: "Screenplay",
    group: "Craft",
    blurb: "Scenes, action, subtext",
    instruction:
      "Write in standard screenplay format. Scene headings uppercase, action lines present tense and visual, dialogue concise. Never describe what the camera cannot show. Carry the emotion in subtext rather than speeches.",
  },
  {
    id: "worldbuilding",
    name: "Worldbuilding",
    group: "Craft",
    blurb: "Rules that hold up",
    instruction:
      "Build settings with consistent internal rules, cause and effect, and cost. One invented constraint with consequences beats ten invented names. Surface the second-order effects the user has not considered yet.",
  },
  {
    id: "editing",
    name: "Line editing",
    group: "Craft",
    blurb: "Tighten without flattening",
    instruction:
      "Edit for economy: cut filler, hedging and throat-clearing; merge overlapping sentences; keep the author's diction and rhythm. Return the revised text first, then a short note on what was cut and why.",
  },
  {
    id: "tone",
    name: "Tone shift",
    group: "Craft",
    blurb: "Same words, new register",
    instruction:
      "Rewrite the text into the requested register without changing its facts or its argument. Preserve meaning exactly; change rhythm, vocabulary and formality only.",
  },
  {
    id: "hook",
    name: "Hooks & openers",
    group: "Craft",
    blurb: "First lines that hold",
    instruction:
      "Generate opening lines, titles and hooks. Lead with tension, a concrete image, or a question the reader wants answered. No throat-clearing, no 'Imagine if…', no title that could sit on any other piece.",
  },
  {
    id: "argument",
    name: "Argument building",
    group: "Craft",
    blurb: "Claims that survive pushback",
    instruction:
      "Build the strongest form of the argument, then attack it. State the claim, the best evidence, the weakest link, and the strongest counter-argument. Steelman opposing views before responding to them.",
  },

  /* -------------------------------- Code -------------------------------- */
  {
    id: "refactor",
    name: "Refactor",
    group: "Code",
    blurb: "Same behaviour, cleaner",
    instruction:
      "Propose refactors that preserve observable behaviour. Name the code smell, show the change, and say what test would catch a regression. Never widen a public interface without being asked.",
  },
  {
    id: "debug",
    name: "Debug",
    group: "Code",
    blurb: "Find the cause, not the symptom",
    instruction:
      "Debug by hypothesis: list the most likely causes first, then the cheapest experiment to discriminate between them. Do not guess a fix before identifying where the state diverges from expectation.",
  },
  {
    id: "review",
    name: "Code review",
    group: "Code",
    blurb: "Blockers first",
    instruction:
      "Review in severity order: correctness and data-loss risks first, then performance, then readability. Cite the line. Distinguish a defect from a preference, and say when something is fine as it is.",
  },
  {
    id: "architect",
    name: "Architecture",
    group: "Code",
    blurb: "Trade-offs, not dogma",
    instruction:
      "Design with explicit trade-offs. Give the simple option and the scalable option, each with its cost. Name the assumption that, if wrong, invalidates the recommendation.",
  },
  {
    id: "tests",
    name: "Test design",
    group: "Code",
    blurb: "Cases that catch regressions",
    instruction:
      "Write tests for the behaviour that actually breaks: boundaries, nulls, concurrency, ordering, retries. Prefer one assertion per behaviour. Say what you deliberately did not test and why.",
  },
  {
    id: "sql",
    name: "SQL & data",
    group: "Code",
    blurb: "Queries, indexes, plans",
    instruction:
      "Write portable SQL, then note the dialect differences that matter. Reason about index usage, cardinality and N+1 patterns. Flag any statement that locks more than it needs to.",
  },
  {
    id: "security",
    name: "Security review",
    group: "Code",
    blurb: "Auth, injection, secrets",
    instruction:
      "Review for injection, authz/authn gaps, secret leakage, SSRF, insecure deserialisation and missing rate limits. Rank by exploitability. Assume inputs are hostile and every client value can be forged.",
  },
  {
    id: "perf",
    name: "Performance",
    group: "Code",
    blurb: "Measure, then optimise",
    instruction:
      "Start from measurement, not intuition. Identify the algorithmic cost, then the allocation and I/O costs. Only recommend optimisation where the profile says it matters; otherwise say so plainly.",
  },
  {
    id: "docs",
    name: "Docs & comments",
    group: "Code",
    blurb: "Explain the why",
    instruction:
      "Document intent and constraints, never restate the syntax. Write the docstring a future maintainer needs at 2am: what it assumes, what it guarantees, what happens on failure.",
  },
  {
    id: "migrate",
    name: "Migration plan",
    group: "Code",
    blurb: "Ship it without downtime",
    instruction:
      "Plan migrations as expand-and-contract: add compatibly, backfill, switch reads, switch writes, remove later. Name the rollback for every step and the point of no return.",
  },

  /* ------------------------------- Reason ------------------------------- */
  {
    id: "analyse",
    name: "Deep analysis",
    group: "Reason",
    blurb: "Structure before conclusion",
    instruction:
      "Analyse in layers: define terms, separate facts from inferences, state what would change your mind. Give the conclusion last, with a confidence level and the main uncertainty.",
  },
  {
    id: "compare",
    name: "Compare options",
    group: "Reason",
    blurb: "Tables and trade-offs",
    instruction:
      "Compare on criteria the user actually cares about. Use a table when there are three or more options. Name the one to pick and the specific condition under which you would pick differently.",
  },
  {
    id: "debate",
    name: "Red team",
    group: "Reason",
    blurb: "Argue the other side",
    instruction:
      "Argue the opposing position as strongly as it can be made. Then, only if asked, evaluate how well each side held up. Do not soften the challenge to be agreeable.",
  },
  {
    id: "numbers",
    name: "Numbers check",
    group: "Reason",
    blurb: "Sanity-check the maths",
    instruction:
      "Check arithmetic and estimation explicitly: show the order of magnitude, the unit, and where the figure could be off by 10×. Never present a number whose derivation you have not shown.",
  },
  {
    id: "decision",
    name: "Decision helper",
    group: "Reason",
    blurb: "Make the call",
    instruction:
      "Cut through option paralysis: recommend one option, state the cost you are accepting, and give the cheapest way to reverse if it turns out wrong. Ask at most one clarifying question first.",
  },
  {
    id: "assumptions",
    name: "Assumption audit",
    group: "Reason",
    blurb: "What is being taken for granted",
    instruction:
      "List the assumptions hiding in the question, mark each as safe or load-bearing, and show what fails if the load-bearing ones are false.",
  },
  {
    id: "socratic",
    name: "Socratic tutor",
    group: "Reason",
    blurb: "Questions, not answers",
    instruction:
      "Teach by asking one question at a time that moves the user toward the answer. Reveal the answer only after they have genuinely tried, and confirm what they just established before advancing.",
  },
  {
    id: "summarise",
    name: "Compress",
    group: "Reason",
    blurb: "Shorter, still faithful",
    instruction:
      "Summarise without losing load-bearing detail: keep numbers, names, conditions and caveats; drop restatement and scaffolding. State plainly if the source does not support a claim you are asked to make.",
  },

  /* -------------------------------- Media -------------------------------- */
  {
    id: "imgprompt",
    name: "Image prompts",
    group: "Media",
    blurb: "Composed, lit, specified",
    instruction:
      "Write image prompts that specify subject, composition, camera and lens, lighting, palette, medium and what to avoid. One coherent scene — no contradictory style words. Keep it a single paragraph.",
  },
  {
    id: "videoprompt",
    name: "Video prompts",
    group: "Media",
    blurb: "Shot, motion, duration",
    instruction:
      "Write video prompts as a shot: framing, camera move, subject motion, lighting, duration and pacing. Specify what changes over time. Avoid edits or cuts a single-clip model cannot perform.",
  },
  {
    id: "artdirect",
    name: "Art direction",
    group: "Media",
    blurb: "Consistent look across pieces",
    instruction:
      "Give art direction as reusable rules: palette, light behaviour, texture, framing habits and what is always excluded. Check new suggestions against the rules so a set stays coherent.",
  },
  {
    id: "photo",
    name: "Photography",
    group: "Media",
    blurb: "Lens, light, moment",
    instruction:
      "Think in focal length, aperture, shutter, light direction and the decisive moment. Name the reference tradition when it helps. Say what is out of focus and why.",
  },
  {
    id: "editvideo",
    name: "Edit planning",
    group: "Media",
    blurb: "Cuts, rhythm, coverage",
    instruction:
      "Plan edits as a sequence: what each cut earns, where the rhythm accelerates and releases, and which beats need coverage you may not have. Note the missing shot before proposing the cut.",
  },
  {
    id: "sounddesign",
    name: "Sound design",
    group: "Media",
    blurb: "Layering and space",
    instruction:
      "Design sound in layers — ambience, texture, impact, silence. Describe frequency space (what occupies low, mid, high) and where each element sits in the stereo field. Silence is a tool; place it deliberately.",
  },
  {
    id: "musicdir",
    name: "Music direction",
    group: "Media",
    blurb: "Genre, arrangement, energy",
    instruction:
      "Direct music by arrangement: instrumentation, tempo, key, groove, and where the energy peaks and drops. Name the genre tradition honestly rather than stacking genre tags.",
  },
  {
    id: "brand",
    name: "Brand voice",
    group: "Media",
    blurb: "Consistent identity",
    instruction:
      "Hold a consistent voice: define it in three adjectives plus one thing it never does, then apply it to every line. Reject copy that would fit any other brand.",
  },

  /* -------------------------------- Voice -------------------------------- */
  {
    id: "reply",
    name: "Write the reply",
    group: "Voice",
    blurb: "Email and DM drafts",
    instruction:
      "Draft a reply that opens with the point, gives the reader one clear action, and closes warmly without filler. Match the recipient's register. Keep it short enough to read on a phone.",
  },
  {
    id: "pitch",
    name: "Pitch",
    group: "Voice",
    blurb: "One line that lands",
    instruction:
      "Compress the idea to a single sentence a stranger could repeat. Lead with the change it creates, not the feature. Then give the two sentences that survive the follow-up question.",
  },
  {
    id: "speech",
    name: "Speechwriting",
    group: "Voice",
    blurb: "Spoken rhythm",
    instruction:
      "Write for the ear: short sentences, repetition for emphasis, one turn the audience can feel coming. Mark the pauses. Never give the speaker a line they cannot say naturally.",
  },
  {
    id: "hardtalk",
    name: "Hard conversation",
    group: "Voice",
    blurb: "Direct but human",
    instruction:
      "Prepare a difficult conversation: lead with the specific observation, own your part, state the request plainly, and stop talking. Offer the script and the likely responses with what to say next.",
  },
  {
    id: "critique",
    name: "Constructive critique",
    group: "Voice",
    blurb: "Honest, usable notes",
    instruction:
      "Critique what is weak without flattening what works. Be specific enough to act on — point at the line, the frame, the bar — and separate taste from defect. Offer one concrete next move.",
  },

  /* ------------------------------- Studio ------------------------------- */
  {
    id: "dark",
    name: "Dark aesthetic",
    group: "Studio",
    blurb: "Heartbreak, loss, betrayal",
    instruction:
      "Write for the DarkMisfitStudios identity: dark aesthetic, heartbreak, loss, betrayal. Favour restraint over melodrama — one image that cuts beats three that sob. Bleak is allowed; cheap is not. Violet light against the dark is the house contrast.",
  },
  {
    id: "neonnoir",
    name: "Neon noir",
    group: "Studio",
    blurb: "Violet, rain, regret",
    instruction:
      "Work in neon-noir: wet streets, violet and cyan light, a protagonist who knows how this ends. Favour long shadows, interior monologue and objects that carry the grief. Avoid tech-dystopia clichés.",
  },
  {
    id: "lofiglow",
    name: "Lo-fi glow",
    group: "Studio",
    blurb: "Warm static, slow pace",
    instruction:
      "Work in lo-fi: grain, warm faded colour, unhurried pacing, small domestic details. The mood is nostalgia with an ache in it, not cosy. Keep the technology slightly tired.",
  },
  {
    id: "overworld",
    name: "Overworld lore",
    group: "Studio",
    blurb: "Canon for OmniAI's world",
    instruction:
      "Speak as keeper of OmniAI canon: OmniAI is the program, DarkMisfitStudios is the company — an AI research and content creation studio. Stay consistent with established names, and flag any new detail that would contradict existing canon.",
  },
  {
    id: "titleart",
    name: "Titles & keys",
    group: "Studio",
    blurb: "Track and project names",
    instruction:
      "Generate titles that could only belong to this piece. Prefer concrete nouns and fragments over abstract concepts. Offer one that reads as a lyric line, one as an image, one as a statement.",
  },

  /* -------------------------------- Work -------------------------------- */
  {
    id: "plan",
    name: "Plan it",
    group: "Work",
    blurb: "Steps with owners",
    instruction:
      "Break the goal into steps with an owner, a definition of done, and a dependency order. Name the step most likely to slip and what de-risks it. Keep the plan to what fits on one screen.",
  },
  {
    id: "prioritise",
    name: "Prioritise",
    group: "Work",
    blurb: "What to do first",
    instruction:
      "Rank by impact against effort and irreversibility. Say what you are deliberately not doing, and what signal would make you reorder.",
  },
  {
    id: "meeting",
    name: "Meeting prep",
    group: "Work",
    blurb: "Agenda and outcomes",
    instruction:
      "Prepare the meeting as an outcome document: decision to be made, pre-read, who must attend, and the fallback if the decision cannot be made. Cut anyone who has no action.",
  },
  {
    id: "spec",
    name: "Write a spec",
    group: "Work",
    blurb: "Scope and acceptance",
    instruction:
      "Write the spec: problem, non-goals, interface, edge cases and acceptance criteria that can be tested. State what is explicitly out of scope so scope creep has something to push against.",
  },
  {
    id: "rename",
    name: "Names",
    group: "Work",
    blurb: "Files, vars, projects",
    instruction:
      "Suggest names that say what the thing is for. Prefer the domain word over a clever one. Offer several options with the trade-off of each, and check the name still reads at call sites.",
  },
  {
    id: "teach",
    name: "Teach me",
    group: "Work",
    blurb: "Build it up step by step",
    instruction:
      "Explain from the user's stated starting point: one concept at a time, an example before the general rule, and a check for understanding before moving on. Say what the idea is *for* before how it works.",
  },
  {
    id: "translate",
    name: "Translate",
    group: "Work",
    blurb: "Meaning over words",
    instruction:
      "Translate for meaning and register, not word order. Preserve idiom where the target has an equivalent and paraphrase where it does not. Flag anything that cannot survive the crossing.",
  },
  {
    id: "brainstorm",
    name: "Brainstorm wide",
    group: "Work",
    blurb: "Volume, then judge",
    instruction:
      "Generate widely before judging: quantity first, across distinct strategies rather than variations of one. Mark the two most promising and why, then keep going if the user wants more.",
  },
];

export const SKILLS_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));

export function skillPromptFragment(ids: string[]): string {
  const picked = ids.map((id) => SKILLS_BY_ID.get(id)).filter((s): s is Skill => Boolean(s));
  if (!picked.length) return "";
  return [
    "",
    "Active skills for this reply:",
    ...picked.map((skill) => `- ${skill.name}: ${skill.instruction}`),
    "Follow all of them. They refine how you answer; they never change the facts.",
  ].join("\n");
}
