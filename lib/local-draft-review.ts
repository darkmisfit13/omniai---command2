export type LocalDraftDiffLine = {
  kind: "added" | "removed";
  text: string;
  lineNumber: number;
};

export type LocalDraftDiff = {
  lines: LocalDraftDiffLine[];
  truncated: boolean;
  tooLarge: boolean;
};

function stripLeadingComments(source: string) {
  let text = source.replace(/^\uFEFF/, "").trimStart();

  while (text.startsWith("/*") || text.startsWith("//")) {
    if (text.startsWith("/*")) {
      const commentEnd = text.indexOf("*/", 2);
      if (commentEnd === -1) break;
      text = text.slice(commentEnd + 2).trimStart();
    } else {
      const lineEnd = text.indexOf("\n");
      if (lineEnd === -1) return "";
      text = text.slice(lineEnd + 1).trimStart();
    }
  }

  return text;
}

export function getLocalDraftIssue(filePath: string, proposed: string, original: string) {
  if (!proposed.trim()) return "The proposed file is empty.";
  if (proposed === original) return "No changes were made in this draft.";

  const source = stripLeadingComments(proposed);
  if (/\.(?:ts|tsx|js|jsx)$/i.test(filePath)) {
    const preservesClientDirective = !/^\s*["']use client["']\s*;/.test(stripLeadingComments(original))
      || /^\s*["']use client["']\s*;/.test(source);
    const startsLikeSource = /^(?:(?:["']use client["']\s*;\s*)?)(?:import\b|export\b|const\b|let\b|function\b|async function\b|class\b|interface\b|type\b|enum\b|module\.exports\b)/.test(source);

    if (!preservesClientDirective) {
      return "This file starts with a required ‘use client’ directive, which the draft removed.";
    }
    if (!startsLikeSource) {
      return "This draft doesn't start like a JavaScript or TypeScript source file. It may be an explanation instead of code.";
    }
  }

  if (/\.css$/i.test(filePath) && !/^(?:@import\b|@tailwind\b|@layer\b|@media\b|:root\b|html\b|body\b|\*|[.#][\w-]+)/.test(source)) {
    return "This draft doesn't start like a CSS file. It may be an explanation instead of CSS.";
  }

  return null;
}

export function createLocalDraftDiff(original: string, proposed: string): LocalDraftDiff {
  const oldLines = original.split("\n");
  const newLines = proposed.split("\n");
  const columns = newLines.length + 1;
  const cellCount = (oldLines.length + 1) * columns;

  if (cellCount > 1_000_000) {
    return { lines: [], truncated: false, tooLarge: true };
  }

  const lengths = new Uint32Array(cellCount);
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      const cell = oldIndex * columns + newIndex;
      lengths[cell] = oldLines[oldIndex] === newLines[newIndex]
        ? 1 + lengths[(oldIndex + 1) * columns + newIndex + 1]
        : Math.max(lengths[(oldIndex + 1) * columns + newIndex], lengths[cell + 1]);
    }
  }

  const lines: LocalDraftDiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let truncated = false;
  const maxChangedLines = 120;

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      oldIndex += 1;
      newIndex += 1;
    } else if (lengths[(oldIndex + 1) * columns + newIndex] >= lengths[oldIndex * columns + newIndex + 1]) {
      if (lines.length < maxChangedLines) {
        lines.push({ kind: "removed", text: oldLines[oldIndex], lineNumber: oldIndex + 1 });
      } else {
        truncated = true;
      }
      oldIndex += 1;
    } else {
      if (lines.length < maxChangedLines) {
        lines.push({ kind: "added", text: newLines[newIndex], lineNumber: newIndex + 1 });
      } else {
        truncated = true;
      }
      newIndex += 1;
    }
  }

  while (oldIndex < oldLines.length) {
    if (lines.length < maxChangedLines) {
      lines.push({ kind: "removed", text: oldLines[oldIndex], lineNumber: oldIndex + 1 });
    } else {
      truncated = true;
    }
    oldIndex += 1;
  }

  while (newIndex < newLines.length) {
    if (lines.length < maxChangedLines) {
      lines.push({ kind: "added", text: newLines[newIndex], lineNumber: newIndex + 1 });
    } else {
      truncated = true;
    }
    newIndex += 1;
  }

  return { lines, truncated, tooLarge: false };
}
