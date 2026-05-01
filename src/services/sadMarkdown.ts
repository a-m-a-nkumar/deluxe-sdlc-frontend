/**
 * SAD content-block ↔ Markdown round-trip helpers for the manual-edit UI.
 *
 * The SAD's canonical storage shape is a JSON array of typed content
 * blocks (paragraph, heading, ordered_list, bullet_list, table, diagram).
 * That's good for rendering and machine-handling, but bad for hand-edit.
 * For the manual edit pane we render those blocks as Markdown that any
 * developer recognises, let the user edit, then parse back.
 *
 * Diagram blocks are treated as opaque — they're rendered in the editor
 * as a non-editable placeholder line that we recognise on the way back
 * and restore from a side-channel map. Users can move them up/down in
 * the document by repositioning the placeholder line, or delete them by
 * deleting the line.
 */

import type { SADContentBlock } from "./sadApi";

// Sentinel format for diagram blocks inside the markdown buffer. The
// line is round-trippable: convert blocks → markdown emits exactly this
// shape, parse markdown → blocks recognises it and restores from the map.
const DIAGRAM_LINE_RE = /^\[\[diagram:([^\]]+)\]\]$/;

export interface BlocksToMarkdownResult {
  markdown: string;
  /** Map keyed by the diagram's `s3_key` so the round-trip doesn't lose
   * a block's full data even though the markdown only carries the alt. */
  diagramByKey: Map<string, SADContentBlock>;
}

/**
 * Convert a section's content blocks into a Markdown string.
 *   • paragraph    → plain text + blank line
 *   • heading      → `## Title` (level 2 → `##`, level 3 → `###`, etc.)
 *   • ordered_list → `1. item` lines
 *   • bullet_list  → `- item` lines
 *   • table        → GFM pipe table
 *   • diagram      → `[[diagram:<s3_key>]]` placeholder
 */
export function blocksToMarkdown(blocks: SADContentBlock[]): BlocksToMarkdownResult {
  const lines: string[] = [];
  const diagramByKey = new Map<string, SADContentBlock>();
  for (const b of blocks ?? []) {
    switch (b.type) {
      case "paragraph":
        lines.push(b.text ?? "");
        lines.push("");
        break;
      case "heading": {
        const level = Math.max(2, Math.min(b.level ?? 3, 5));
        lines.push("#".repeat(level) + " " + (b.text ?? ""));
        lines.push("");
        break;
      }
      case "ordered_list":
        (b.items ?? []).forEach((it, i) => lines.push(`${i + 1}. ${it}`));
        lines.push("");
        break;
      case "bullet_list":
        (b.items ?? []).forEach((it) => lines.push(`- ${it}`));
        lines.push("");
        break;
      case "table": {
        const headers = b.headers ?? [];
        if (headers.length === 0) break;
        lines.push("| " + headers.join(" | ") + " |");
        lines.push("|" + headers.map(() => "---").join("|") + "|");
        for (const row of b.rows ?? []) {
          const cells = row.map((c) =>
            String(c ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br/>"),
          );
          // Pad short rows to header length.
          while (cells.length < headers.length) cells.push("");
          lines.push("| " + cells.slice(0, headers.length).join(" | ") + " |");
        }
        lines.push("");
        break;
      }
      case "diagram": {
        const key = (b as any).s3_key ?? "";
        if (key) diagramByKey.set(key, b);
        lines.push(`[[diagram:${key}]]`);
        lines.push("");
        break;
      }
    }
  }
  // Trim trailing blank lines.
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return { markdown: lines.join("\n"), diagramByKey };
}

/**
 * Parse a Markdown string back into content blocks. Companion to
 * `blocksToMarkdown` — accepts the diagram side-channel map so diagram
 * placeholders can be restored to their full block shape.
 *
 * Recognised constructs:
 *   • blank line  → block separator
 *   • `# … #####` → heading (level = number of `#`)
 *   • `1. item`   → ordered_list (consecutive numbered lines)
 *   • `- item` / `* item` → bullet_list
 *   • `| col | …` with separator row → table
 *   • `[[diagram:KEY]]` → diagram (restored from `diagramByKey`)
 *   • anything else → paragraph
 */
export function markdownToBlocks(
  markdown: string,
  diagramByKey: Map<string, SADContentBlock>,
): SADContentBlock[] {
  const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: SADContentBlock[] = [];
  let i = 0;

  const isHeading = (s: string) => /^(#{2,5})\s+(.+)$/.exec(s.trim());
  const isOrderedItem = (s: string) => /^\s*\d+[.)]\s+(.+)$/.exec(s);
  const isBulletItem = (s: string) => /^\s*[-*]\s+(.+)$/.exec(s);
  const isTableRow = (s: string) => /^\s*\|.*\|\s*$/.test(s);
  const isTableSeparator = (s: string) => /^\s*\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|\s*$/.test(s);
  const splitRow = (s: string): string[] => {
    // Split on `|` honoring `\|` escapes.
    const trimmed = s.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed
      .split(/(?<!\\)\|/g)
      .map((c) => c.trim().replace(/\\\|/g, "|").replace(/<br\s*\/?>/g, "\n"));
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Diagram placeholder
    const dm = DIAGRAM_LINE_RE.exec(line.trim());
    if (dm) {
      const key = dm[1];
      const original = diagramByKey.get(key);
      if (original) {
        blocks.push(original);
      } else {
        // Unknown diagram key — preserve as paragraph so we don't drop content.
        blocks.push({ type: "paragraph", text: line } as SADContentBlock);
      }
      i++;
      continue;
    }

    // Heading
    const hm = isHeading(line);
    if (hm) {
      blocks.push({
        type: "heading",
        level: hm[1].length,
        text: hm[2].trim(),
      } as SADContentBlock);
      i++;
      continue;
    }

    // Table — needs at least header + separator + 0 body rows
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, rows } as SADContentBlock);
      continue;
    }

    // Ordered list — consecutive numbered lines
    if (isOrderedItem(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const om = isOrderedItem(lines[i]);
        if (!om) break;
        items.push(om[1].trim());
        i++;
      }
      blocks.push({ type: "ordered_list", items } as SADContentBlock);
      continue;
    }

    // Bullet list
    if (isBulletItem(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const bm = isBulletItem(lines[i]);
        if (!bm) break;
        items.push(bm[1].trim());
        i++;
      }
      blocks.push({ type: "bullet_list", items } as SADContentBlock);
      continue;
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isHeading(lines[i]) &&
      !isOrderedItem(lines[i]) &&
      !isBulletItem(lines[i]) &&
      !DIAGRAM_LINE_RE.test(lines[i].trim()) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join(" ") } as SADContentBlock);
    }
  }

  return blocks;
}
