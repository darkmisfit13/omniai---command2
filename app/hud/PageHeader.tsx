import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="hud-kicker">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-hud-ink sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-hud-muted">
            {description}
          </p>
        )}
      </div>
      {actions}
    </header>
  );
}
