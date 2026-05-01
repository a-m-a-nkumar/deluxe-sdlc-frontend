/**
 * SADSectionList — left index inside the SAD tab. Each row is a "row in
 * a table-of-contents", with an audit signal in its own column rather
 * than competing with the title.
 */

import type { SADSectionsList } from "@/services/sadApi";

type Tone = "green" | "amber" | "red" | "muted";

function toneFor(score?: number): Tone {
  if (score == null) return "muted";
  if (score >= 90) return "green";
  if (score >= 60) return "amber";
  return "red";
}

const TONE_DOT: Record<Tone, string> = {
  green: "design-dot--green",
  amber: "design-dot--amber",
  red: "design-dot--red",
  muted: "design-dot--muted",
};

const TONE_LABEL: Record<Tone, string> = {
  green: "OK",
  amber: "REVIEW",
  red: "FIX",
  muted: "—",
};

interface Props {
  list: SADSectionsList;
  selected: number | null;
  onSelect: (n: number) => void;
}

export function SADSectionList({ list, selected, onSelect }: Props) {
  return (
    <ul className="design-stagger flex-1 overflow-auto py-2 px-1.5 space-y-0.5">
      {list.sections.map((s) => {
        const tone = toneFor(s.audit?.score);
        const active = selected === s.number;
        return (
          <li key={s.number}>
            <button
              type="button"
              data-active={active}
              onClick={() => onSelect(s.number)}
              className="design-row"
            >
              <span
                className={`design-plate-num shrink-0 mt-0.5 w-7 text-right ${
                  active ? "" : "opacity-70"
                }`}
              >
                {String(s.number).padStart(2, "0")}
              </span>
              <span className="flex-1 min-w-0">
                <span className="design-heading text-[0.95rem] leading-tight block truncate">
                  {s.title}
                </span>
                <span className="design-eyebrow mt-1.5 inline-flex items-center gap-1.5">
                  <span
                    className={`design-dot ${TONE_DOT[tone]} ${
                      tone === "red" ? "design-pulse-mark" : ""
                    }`}
                  />
                  <span>{TONE_LABEL[tone]}</span>
                  {typeof s.audit?.score === "number" && (
                    <>
                      <span style={{ color: "hsl(var(--design-ink-muted))" }}>·</span>
                      <span>{s.audit.score}</span>
                    </>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
