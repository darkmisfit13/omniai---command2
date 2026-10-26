/**
 * The four tool areas of the personal environment.
 *
 * Shared by the dashboard (the metric count and the monitoring grid) and the
 * /environment page so both always describe the same workspace. Approval
 * Safeguards no longer has a monitoring card on the dashboard — its gauge owns
 * that register now — but it remains an area of the environment, so the count
 * still reads four.
 */
export type EnvironmentArea = {
  number: string;
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  action: string;
};

export const environmentAreas: EnvironmentArea[] = [
  {
    number: "01",
    title: "Local AI",
    eyebrow: "LOCAL INTELLIGENCE",
    description: "Check Ollama and installed models.",
    href: "/local-diagnostics",
    action: "Open diagnostics",
  },
  {
    number: "02",
    title: "AI Providers",
    eyebrow: "MODEL NETWORK",
    description: "Review configured provider settings.",
    href: "/settings",
    action: "Review configuration",
  },
  {
    number: "03",
    title: "Approval Safeguards",
    eyebrow: "GOVERNANCE",
    description: "Review proposals and approval requirements.",
    href: "/approvals",
    action: "Review approvals",
  },
  {
    number: "04",
    title: "System Activity",
    eyebrow: "AUDIT TRAIL",
    description: "Explore available audit records.",
    href: "/audit-log",
    action: "View activity",
  },
];
