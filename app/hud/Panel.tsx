import type { ReactNode } from "react";

export default function Panel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "aside";
}) {
  return (
    <Tag
      className={`hud-panel ${className}`.trim()}
      data-d3="4"
      data-d3-y="3"
    >
      {children}
    </Tag>
  );
}
