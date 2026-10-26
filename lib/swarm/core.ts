/**
 * OmniAI — Autonomous Intelligence Swarm Engine
 * See top comment (overview).
 */

export type ModelTier = "heavy" | "fast";
export type AgentRole = "code" | "prompt" | "package" | "syntax";

export interface SwarmSubTask {
  id: string;
  role: AgentRole;
  instruction: string;
  context?: string;
  modelTier: ModelTier;
}

export interface SubAgentResult {
  taskId: string;
  role: AgentRole;
  ok: boolean;
  output: string;
  model: string;
  durationMs: number;
  error?: string;
}

export interface SwarmPlan {
  instruction: string;
  subtasks: SwarmSubTask[];
  notes?: string;
}

export interface SwarmRunResult {
  instruction: string;
  plan: SwarmPlan;
  results: SubAgentResult[];
  synthesis: string;
  totalMs: number;
}

export type SwarmTextGenerate = (
  tier: ModelTier,
  prompt: string,
  systemPrompt?: string,
) => Promise<{ model: string; text: string }>;

export interface SwarmRunOptions {
  onProgress?: (event: { step: string; task?: SwarmSubTask; result?: SubAgentResult; synthesis?: string }) => void;
  plan?: SwarmPlan;
}

const ROLE_SYSTEM_PROMPTS: Record<AgentRole, string> = {
  code: "[ROLE: Senior Code Agent] Produce complete, production-grade code. Never elide. Return files as a JSON array {path,content}.",
  prompt: "[ROLE: Prompt Optimizer] Refine the user instruction into a crisp, directive prompt.",
  package: "[ROLE: Packaging Agent] Assemble a concise deliverable manifest (title, files, entry point, summary).",
  syntax: "[ROLE: Syntax Evaluator] Check for syntax/type issues. Return JSON {ok:boolean, errors:string[]}.",
};

const ROLE_TIER: Record<AgentRole, ModelTier> = {
  code: "heavy",
  prompt: "fast",
  package: "fast",
  syntax: "fast",
};

export function decomposeInstruction(instruction: string): SwarmSubTask[] {
  const tasks: SwarmSubTask[] = [];
  const base = instruction.trim();
  const lower = base.toLowerCase();
  tasks.push({ id: crypto.randomUUID(), role: "prompt", instruction: `Refine this instruction for optimal agent execution: ${base}`, modelTier: "fast" });
  const codey = /\b(build|create|implement|code|write|generate|feature|app|component|api|schema|page|route)\b/.test(lower);
  if (codey) {
    tasks.push({ id: crypto.randomUUID(), role: "code", instruction: `Implement the following in full, with all files. Instruction: ${base}`, modelTier: "heavy", context: "Complete source. No elision." });
    tasks.push({ id: crypto.randomUUID(), role: "syntax", instruction: `Evaluate the implementation implied by: ${base}. Return JSON {ok, errors}.`, modelTier: "fast" });
  }
  tasks.push({ id: crypto.randomUUID(), role: "package", instruction: `Assemble a deliverable manifest for: ${base}`, modelTier: "fast" });
  return tasks;
}

async function runTask(task: SwarmSubTask, gen: SwarmTextGenerate): Promise<SubAgentResult> {
  const t0 = Date.now();
  try {
    const { model, text } = await gen(task.modelTier, task.instruction, ROLE_SYSTEM_PROMPTS[task.role]);
    return { taskId: task.id, role: task.role, ok: true, output: String(text ?? ""), model, durationMs: Date.now() - t0 };
  } catch (e) {
    return { taskId: task.id, role: task.role, ok: false, output: "", model: "unknown", durationMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runSwarm(instruction: string, gen: SwarmTextGenerate, options: SwarmRunOptions = {}): Promise<SwarmRunResult> {
  const t0 = Date.now();
  const plan: SwarmPlan = options.plan ?? { instruction, subtasks: decomposeInstruction(instruction) };
  options.onProgress?.({ step: "plan" });
  options.onProgress?.({ step: "decomposed", synthesis: `${plan.subtasks.length} sub-tasks across ${[...new Set(plan.subtasks.map((t) => t.role))].join(", ")}` });

  const results = await Promise.all(plan.subtasks.map((t) => runTask(t, gen)));
  options.onProgress?.({ step: "synthesizing" });

  const blocks = plan.subtasks.map((task, i) => `--- ${task.role.toUpperCase()} agent ---\n${results[i]?.output ?? ""}`).join("\n\n");
  const { text: synthesis } = await gen("heavy", `You are the Lead Director Agent. Unify these parallel agent results into one final comprehensive answer. No elision.\n\n${blocks}`, "[ROLE: Lead Director] Synthesize into one complete output.");

  options.onProgress?.({ step: "done", synthesis });
  return { instruction, plan, results, synthesis, totalMs: Date.now() - t0 };
}
