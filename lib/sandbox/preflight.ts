/**
 * OmniAI — Sandbox Preflight Verifier
 * ===================================
 * The deterministic core of the "self-healing server sandbox".
 *
 * Honest scope: a real Chromium instance cannot run inside a Vercel
 * serverless function, so this is not a headless browser. It is the layer
 * that runs *before* a browser ever would — a static, reproducible pass over
 * generated artifacts that catches the failures which actually break a build:
 * placeholder/stub code, elided or truncated files, dead UI handlers, broken
 * relative imports and unbalanced delimiters. Findings carry a file:line and a
 * stack-trace-style `trace`, so the pipeline can feed them straight back into
 * the model to self-heal and re-run.
 *
 * Everything here is pure and synchronous — trivially unit-testable.
 */

export type PreflightSeverity = "error" | "warning" | "info";

export interface PreflightFile {
  path: string;
  content: string;
}

export interface PreflightFinding {
  file: string;
  line: number;
  column?: number;
  severity: PreflightSeverity;
  rule: string;
  message: string;
  snippet: string;
  trace: string;
}

export interface PreflightReport {
  pass: boolean;
  files: number;
  counts: { error: number; warning: number; info: number };
  findings: PreflightFinding[];
}

const CODE_EXT = /\.(tsx?|jsx?|mjs|cjs)$/i;

const PLACEHOLDER_PATTERNS: { rule: string; re: RegExp; message: string }[] = [
  { rule: "placeholder-todo", re: /\b(TODO|FIXME|XXX|HACK)\b/, message: "Placeholder marker left in shipped code." },
  { rule: "placeholder-stub", re: /\b(not implemented|implement later|coming soon|to be implemented)\b/i, message: "Unimplemented stub described in code." },
  { rule: "placeholder-lorem", re: /lorem ipsum/i, message: "Lorem-ipsum filler instead of real content." },
];

const ELISION_PATTERNS: { rule: string; re: RegExp; message: string }[] = [
  { rule: "elided-block", re: /\/\*\s*\.\.\.\s*\*\//, message: "Elided block (/* ... */) — section was omitted." },
  { rule: "elided-comment", re: /^\s*\/\/\s*\.\.\.\s*$/m, message: "Elided comment (// ...) — code was truncated." },
  { rule: "elided-rest", re: /\/\/\s*(rest|remainder) of (the )?(code|file|implementation|logic)/i, message: "Code truncated with a 'rest of…' comment." },
  { rule: "elided-continues", re: /\/\/\s*(code )?continues (below|here|in)\b/i, message: "Code truncated with a 'continues…' comment." },
];

const DEAD_HANDLER_PATTERNS: { rule: string; re: RegExp; message: string }[] = [
  { rule: "dead-handler", re: /on[A-Z]\w*\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/, message: "Empty event handler — control does nothing." },
  { rule: "dead-handler", re: /on[A-Z]\w*\s*=\s*\{\s*\(\s*\)\s*=>\s*(undefined|null)\s*\}/, message: "No-op event handler — control does nothing." },
  { rule: "dead-link", re: /<a\b[^>]*href\s*=\s*["']#["'][^>]*>/, message: "Anchor points at '#' — dead navigation unless wired elsewhere." },
];

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i += 1) {
    if (content[i] === "\n") line += 1;
  }
  return line;
}

function snippetAt(content: string, line: number): string {
  const lineText = content.split(/\r?\n/)[line - 1] ?? "";
  return lineText.trim().slice(0, 160);
}

function makeFinding(
  file: string,
  content: string,
  index: number,
  severity: PreflightSeverity,
  rule: string,
  message: string
): PreflightFinding {
  const line = lineOf(content, index);
  return {
    file,
    line,
    severity,
    rule,
    message,
    snippet: snippetAt(content, line),
    trace: `at ${file}:${line} [${rule}] ${message}`,
  };
}

/** Strip strings + comments so structural checks don't trip on literals. */
function structuralView(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    const next = code[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && code[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i += 1;
      while (i < n && code[i] !== quote) {
        if (code[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      out += " "; // keep positions roughly aligned
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Count delimiter balance on the string/comment-stripped view. */
function balance(view: string): { char: string; delta: number } | null {
  const pairs: [string, string, string][] = [
    ["{", "}", "braces"],
    ["(", ")", "parentheses"],
    ["[", "]", "brackets"],
  ];
  for (const [open, close, name] of pairs) {
    let depth = 0;
    for (const ch of view) {
      if (ch === open) depth += 1;
      else if (ch === close) depth -= 1;
      if (depth < 0) return { char: name, delta: depth };
    }
    if (depth !== 0) return { char: name, delta: depth };
  }
  return null;
}

function resolveRelative(spec: string, fromPath: string, paths: Set<string>): boolean {
  const fromDir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const base = fromDir ? `${fromDir}/${spec}` : spec;
  const normalised = base.replace(/\/\.\//g, "/").replace(/\/[^/]+\/\.\.\//g, "/");
  const candidates = [
    normalised,
    `${normalised}.ts`,
    `${normalised}.tsx`,
    `${normalised}.js`,
    `${normalised}.jsx`,
    `${normalised}.mjs`,
    `${normalised}.css`,
    `${normalised}.json`,
    `${normalised}/index.ts`,
    `${normalised}/index.tsx`,
    `${normalised}/index.js`,
    `${normalised}/index.jsx`,
  ];
  return candidates.some((candidate) => paths.has(candidate));
}

const IMPORT_RE = /(?:from|import|require)\s*\(?\s*["'](\.[^"']+)["']/g;

/** Run every static check over a set of generated files. */
export function preflightFiles(files: PreflightFile[]): PreflightReport {
  const findings: PreflightFinding[] = [];
  const paths = new Set(files.map((f) => f.path.replace(/^\.\//, "")));

  for (const fileObject of files) {
    const file = fileObject.path.replace(/^\.\//, "");
    const content = fileObject.content ?? "";

    for (const { rule, re, message } of PLACEHOLDER_PATTERNS) {
      const match = re.exec(content);
      if (match) findings.push(makeFinding(file, content, match.index, "error", rule, message));
    }

    for (const { rule, re, message } of ELISION_PATTERNS) {
      const match = re.exec(content);
      if (match) findings.push(makeFinding(file, content, match.index, "error", rule, message));
    }

    if (CODE_EXT.test(file)) {
      for (const { rule, re, message } of DEAD_HANDLER_PATTERNS) {
        const match = re.exec(content);
        if (match) findings.push(makeFinding(file, content, match.index, "warning", rule, message));
      }

      const view = structuralView(content);
      const imbalanced = balance(view);
      if (imbalanced) {
        findings.push({
          file,
          line: content.split(/\r?\n/).length,
          severity: "error",
          rule: "unbalanced-delimiters",
          message: `Unbalanced ${imbalanced.char} (${imbalanced.delta > 0 ? "unclosed" : "extra close"}). File looks truncated.`,
          snippet: content.split(/\r?\n/).slice(-1)[0]?.trim().slice(0, 160) ?? "",
          trace: `at ${file} [unbalanced-delimiters] ${imbalanced.char} delta ${imbalanced.delta}`,
        });
      }
    }

    IMPORT_RE.lastIndex = 0;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = IMPORT_RE.exec(content)) !== null) {
      const spec = importMatch[1];
      const fromIndex = importMatch.index + importMatch[0].indexOf(spec);
      if (!resolveRelative(spec, file, paths)) {
        findings.push(
          makeFinding(
            file,
            content,
            fromIndex,
            "warning",
            "unresolved-import",
            `Relative import "${spec}" does not resolve to any file in the bundle.`
          )
        );
      }
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const counts = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;

  return { pass: counts.error === 0, files: files.length, counts, findings };
}

/** Compact, model-feedable rendering of a report for the self-heal loop. */
export function formatPreflight(report: PreflightReport): string {
  if (report.findings.length === 0) {
    return `Preflight: clean — ${report.files} file${report.files === 1 ? "" : "s"} verified, 0 findings.`;
  }
  const header = `Preflight: ${report.counts.error} error(s), ${report.counts.warning} warning(s) across ${report.files} file(s).`;
  const lines = report.findings
    .slice(0, 40)
    .map((f) => `  ${f.severity.toUpperCase().padEnd(7)} ${f.file}:${f.line}  [${f.rule}] ${f.message}\n      > ${f.snippet}`);
  return [header, ...lines].join("\n");
}
