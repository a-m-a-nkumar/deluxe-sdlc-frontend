/**
 * SADDocumentView — renders the entire SAD as a single scrollable document.
 *
 * The previous SADSectionView showed one section at a time, IDE-outline style.
 * The user wanted a document-style read: 10 plates flowing top-to-bottom in
 * the main pane, with per-plate header (plate number + title + score badge +
 * Audit + Revert affordances). The left rail then acts as a table of contents
 * — click a section, the page scrolls to it.
 *
 * Each section's content is fetched in parallel on mount; individual sections
 * are re-fetched when `refreshKey` bumps (edit/regen/revert) or when the
 * caller manually invalidates by changing `sectionInvalidationKey[n]`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ImageOff, Pencil, RefreshCcw, RotateCcw, X } from "lucide-react";
import {
  fetchSadDiagramBlobUrl,
  getSadSection,
  sadAudit,
  sadRevertSection,
  saveSadSection,
  type SADContentBlock,
  type SADSection,
  type SADSectionsList,
} from "@/services/sadApi";
import { blocksToMarkdown, markdownToBlocks } from "@/services/sadMarkdown";
import { loadDiagramForSession } from "@/services/designApi";

interface Props {
  sessionId: string;
  projectId: string;
  /** Latest sectionsList from the parent — used for stable section ordering
   * and as the source of audit badges (which we keep in sync after audits). */
  list: SADSectionsList;
  /** Bumped after a chat-driven edit or whole-doc regen — re-fetch all. */
  refreshKey: number;
  /** Section the parent wants us to scroll to. Bumping `scrollNonce` triggers
   * the scroll; the value alone does NOT (so an IntersectionObserver-driven
   * activeSection change in the parent doesn't accidentally re-scroll). */
  scrollToSection: number | null;
  scrollNonce: number;
  /** Fired when the section currently most in-view changes — feeds the
   * chat's viewing_section param so "make this edit" resolves correctly. */
  onActiveSectionChange?: (n: number) => void;
  /** Notify parent to refresh sectionsList (audit badges, etc). */
  onSectionsChanged: () => void;
}

type Tone = "green" | "amber" | "red" | "muted";

const toneFor = (score?: number): Tone => {
  if (score == null) return "muted";
  if (score >= 90) return "green";
  if (score >= 60) return "amber";
  return "red";
};

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

export function SADDocumentView({
  sessionId,
  projectId,
  list,
  refreshKey,
  scrollToSection,
  scrollNonce,
  onActiveSectionChange,
  onSectionsChanged,
}: Props) {
  // Map of section number → full SADSection (with content). Loaded in parallel.
  const [sections, setSections] = useState<Record<number, SADSection>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-section in-flight markers so the audit/revert spinners stay scoped.
  const [busy, setBusy] = useState<Record<number, "audit" | "revert" | "save" | null>>({});

  // Manual edit mode. Only one section is editable at a time. The
  // markdown buffer is kept in state so users can move focus and back
  // without losing their edits; on Save we parse it back to content
  // blocks and POST. On Cancel we drop the buffer.
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const diagramByKeyRef = useRef<Map<string, SADContentBlock>>(new Map());

  // Whether the formatting-help banner is shown above the textarea.
  // Persisted in localStorage so dismissing it once sticks for the user.
  const FORMAT_HINT_KEY = "sad.editFormatHintDismissed";
  const [formatHintDismissed, setFormatHintDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(FORMAT_HINT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismissFormatHint = useCallback(() => {
    setFormatHintDismissed(true);
    try {
      localStorage.setItem(FORMAT_HINT_KEY, "1");
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const sectionNumbers = useMemo(
    () => list.sections.map((s) => s.number),
    [list.sections],
  );

  // ---- Fetch all sections in parallel on mount / refreshKey change ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(sectionNumbers.map((n) => getSadSection(sessionId, n)))
      .then((results) => {
        if (cancelled) return;
        const map: Record<number, SADSection> = {};
        for (const s of results) map[s.number] = s;
        setSections(map);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, sectionNumbers, refreshKey]);

  // ---- Scroll to anchored section when the parent bumps `scrollNonce` ----
  // Depending on `scrollNonce` (not `scrollToSection`) means the
  // IntersectionObserver below — which writes back to the parent's active
  // section state — does NOT cause a re-scroll feedback loop.
  useEffect(() => {
    if (scrollToSection == null) return;
    const el = document.getElementById(`design-plate-${scrollToSection}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollNonce]);

  // ---- Track which section is currently most in-view ----
  //
  // Scroll-position approach (replaces the previous IntersectionObserver):
  // pick the section whose top edge is the LATEST one above an offset line
  // (defaulting to 1/3 of the way down the viewport). This is robust against
  // varying section heights and doesn't depend on threshold crossings.
  //
  // Run on scroll (rAF-throttled), on resize, and once on mount.
  const lastReportedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!onActiveSectionChange) return;
    if (loading) return;
    const scrollEl = containerRef.current?.parentElement ?? null;
    if (!scrollEl) return;

    console.log(
      `[SAD-VIEW] scroll-tracker attached. sections=[${sectionNumbers.join(",")}]`,
    );

    let rafId: number | null = null;

    const compute = () => {
      rafId = null;
      // Trigger line: 1/3 down the scroll container's viewport. The active
      // section is the one whose top is most recently above that line.
      const containerRect = scrollEl.getBoundingClientRect();
      const triggerY = containerRect.top + containerRect.height / 3;

      let bestN: number | null = null;
      let bestTop = -Infinity;
      const positions: Array<[number, number]> = [];
      for (const n of sectionNumbers) {
        const el = document.getElementById(`design-plate-${n}`);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        positions.push([n, Math.round(top - triggerY)]);
        if (top <= triggerY && top > bestTop) {
          bestTop = top;
          bestN = n;
        }
      }
      // If nothing is above the line yet (we're at the very top), use
      // the first section.
      if (bestN == null && sectionNumbers.length > 0) {
        bestN = sectionNumbers[0];
      }
      if (bestN == null) return;
      if (bestN === lastReportedRef.current) return;

      console.log(
        `[SAD-VIEW] active section → ${bestN}  ` +
          `(triggerY=${Math.round(triggerY)}px; section_top - triggerY: ` +
          positions.map(([n, d]) => `${n}=${d}`).join(", ") +
          ")",
      );
      lastReportedRef.current = bestN;
      onActiveSectionChange(bestN);
    };

    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(compute);
    };

    // Compute once on attach so we have an active section immediately.
    compute();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      console.log("[SAD-VIEW] scroll-tracker detached");
      if (rafId != null) cancelAnimationFrame(rafId);
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [loading, sectionNumbers, onActiveSectionChange]);

  const handleAuditOne = useCallback(
    async (n: number) => {
      setBusy((b) => ({ ...b, [n]: "audit" }));
      try {
        await sadAudit(sessionId, projectId || undefined, n);
        const fresh = await getSadSection(sessionId, n);
        setSections((prev) => ({ ...prev, [n]: fresh }));
        onSectionsChanged();
      } catch (e) {
        console.error("audit-one failed", e);
      } finally {
        setBusy((b) => ({ ...b, [n]: null }));
      }
    },
    [sessionId, projectId, onSectionsChanged],
  );

  const handleRevertOne = useCallback(
    async (n: number) => {
      setBusy((b) => ({ ...b, [n]: "revert" }));
      try {
        await sadRevertSection(sessionId, n);
        const fresh = await getSadSection(sessionId, n);
        setSections((prev) => ({ ...prev, [n]: fresh }));
        onSectionsChanged();
      } catch (e) {
        console.error("revert failed", e);
      } finally {
        setBusy((b) => ({ ...b, [n]: null }));
      }
    },
    [sessionId, onSectionsChanged],
  );

  const handleStartEdit = useCallback(
    (n: number) => {
      const sec = sections[n];
      if (!sec) return;
      const { markdown, diagramByKey } = blocksToMarkdown(sec.content || []);
      diagramByKeyRef.current = diagramByKey;
      setEditBuffer(markdown);
      setEditError(null);
      setEditingSection(n);
    },
    [sections],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingSection(null);
    setEditBuffer("");
    setEditError(null);
    diagramByKeyRef.current = new Map();
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (editingSection == null) return;
    const n = editingSection;
    setBusy((b) => ({ ...b, [n]: "save" }));
    setEditError(null);
    try {
      const newContent = markdownToBlocks(editBuffer, diagramByKeyRef.current);
      const fresh = await saveSadSection(sessionId, n, newContent);
      setSections((prev) => ({ ...prev, [n]: fresh }));
      setEditingSection(null);
      setEditBuffer("");
      diagramByKeyRef.current = new Map();
      onSectionsChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEditError(msg);
    } finally {
      setBusy((b) => ({ ...b, [n]: null }));
    }
  }, [editingSection, editBuffer, sessionId, onSectionsChanged]);

  if (loading) {
    return (
      <div className="design-marginalia px-8 py-10 max-w-3xl mx-auto">
        Loading the SAD…
      </div>
    );
  }

  if (error) {
    return (
      <div className="design-eyebrow px-8 py-6" style={{ color: "hsl(var(--design-mark))" }}>
        Failed to load SAD: {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="design-rise px-8 py-10 max-w-3xl mx-auto space-y-12">
      <header className="text-center pb-5 border-b" style={{ borderColor: "hsl(var(--design-rule-strong))" }}>
        <div className="design-eyebrow">Software Architecture Document</div>
        <h1 className="design-heading mt-2 text-4xl">{list.sad_id ? "Deluxe SAD" : "SAD Draft"}</h1>
        <p className="design-marginalia mt-2">
          {list.sections.length} plates · stage {list.stage}
        </p>
      </header>

      {list.sections.map((meta) => {
        const sec = sections[meta.number];
        const tone = toneFor(meta.audit?.score);
        const busyKind = busy[meta.number];
        const isAuditing = busyKind === "audit";
        const isReverting = busyKind === "revert";
        const hasPriorVersion = (sec?.previous_versions?.length ?? 0) > 0;
        const isEditing = editingSection === meta.number;
        const isSaving = busyKind === "save";
        const editingDisabled = editingSection != null && !isEditing;  // only one section editable at once

        return (
          <section
            key={meta.number}
            id={`design-plate-${meta.number}`}
            className="scroll-mt-24"
          >
            <header className="flex items-start justify-between gap-4 pb-4 mb-5 border-b" style={{ borderColor: "hsl(var(--design-rule) / 0.65)" }}>
              <div className="min-w-0 flex-1">
                <div className="design-eyebrow">
                  Plate · {String(meta.number).padStart(2, "0")} of {list.sections.length}
                  {isEditing && (
                    <span style={{ color: "hsl(var(--design-mark))" }}> · editing</span>
                  )}
                </div>
                <h2 className="design-heading mt-1.5 text-2xl leading-tight">
                  <span className="design-plate-num mr-3">
                    {String(meta.number).padStart(2, "0")}
                  </span>
                  {meta.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0 mt-2">
                {!isEditing && (
                  <>
                    {/* Score badge */}
                    <span className="design-eyebrow inline-flex items-center gap-1.5">
                      <span
                        className={`design-dot ${TONE_DOT[tone]} ${
                          tone === "red" ? "design-pulse-mark" : ""
                        }`}
                      />
                      <span>{TONE_LABEL[tone]}</span>
                      {typeof meta.audit?.score === "number" && (
                        <>
                          <span style={{ color: "hsl(var(--design-ink-muted))" }}>·</span>
                          <span>{meta.audit.score}</span>
                        </>
                      )}
                    </span>

                    <button
                      type="button"
                      className="design-btn-ghost"
                      disabled={isAuditing || editingDisabled}
                      onClick={() => handleAuditOne(meta.number)}
                      title="Re-audit this section"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {isAuditing ? "…" : "Audit"}
                    </button>

                    <button
                      type="button"
                      className="design-btn-ghost"
                      disabled={!sec || editingDisabled}
                      onClick={() => handleStartEdit(meta.number)}
                      title="Manually edit this section"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>

                    {hasPriorVersion && (
                      <button
                        type="button"
                        className="design-btn-ghost"
                        disabled={isReverting || editingDisabled}
                        onClick={() => handleRevertOne(meta.number)}
                        title="Revert to previous version"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {isReverting ? "…" : "Revert"}
                      </button>
                    )}
                  </>
                )}

                {isEditing && (
                  <>
                    <button
                      type="button"
                      className="design-btn-mark"
                      disabled={isSaving}
                      onClick={handleSaveEdit}
                      title="Save edits as the new latest version"
                    >
                      <Check className="h-3 w-3" />
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="design-btn-ghost"
                      disabled={isSaving}
                      onClick={handleCancelEdit}
                      title="Discard edits"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </header>

            {/* Audit notes (only when there are issues) — hidden in edit mode */}
            {!isEditing && sec?.audit?.issues?.length ? (
              <aside
                className="mb-5 design-plate design-plate--mark p-3"
                style={{ background: "hsl(var(--design-mark-soft))" }}
              >
                <div className="design-eyebrow mb-1.5">Audit notes</div>
                <ul className="space-y-1.5 text-[0.85rem]">
                  {sec.audit.issues.map((i, idx) => (
                    <li key={idx} className="flex gap-2.5">
                      <span
                        className="design-mono text-xs uppercase shrink-0"
                        style={{ color: "hsl(var(--design-mark))" }}
                      >
                        {i.code}
                      </span>
                      <span>{i.msg}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}

            {/* Section body — read or edit */}
            {isEditing ? (
              <div className="space-y-2">
              {!formatHintDismissed && (
                  <div
                    className="design-marginalia"
                    style={{
                      fontSize: "0.78rem",
                      lineHeight: 1.6,
                      position: "relative",
                      // Top/right margin so the wax-seal dismiss button,
                      // which sits half-outside the corner, isn't clipped
                      // by an ancestor's overflow.
                      marginTop: "0.85rem",
                      marginRight: "0.85rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={dismissFormatHint}
                      aria-label="Hide formatting help"
                      title="Hide this help"
                      className="design-hint-dismiss"
                    >
                      <X size={15} strokeWidth={2.75} />
                    </button>
                    <div style={{ marginBottom: "0.4rem" }}>
                      You're editing this section as plain text. Just type your content normally — paragraphs work as you'd expect. To add structure, start a line with one of these:
                    </div>
                    <ul style={{ margin: "0 0 0.5rem 1.1rem", padding: 0, listStyle: "disc" }}>
                      <li>
                        <span className="design-mono">##</span> followed by a title makes that line a <strong>heading</strong>
                      </li>
                      <li>
                        <span className="design-mono">-</span> at the start of a line makes it a <strong>bullet point</strong>
                      </li>
                      <li>
                        <span className="design-mono">1.</span>, <span className="design-mono">2.</span>, … makes a <strong>numbered list</strong>
                      </li>
                      <li>
                        Wrapping content in pipes like <span className="design-mono">| Column A | Column B |</span> makes a <strong>table row</strong>
                      </li>
                    </ul>
                    <div>
                      Lines that look like <span className="design-mono">[[diagram:…]]</span> are placeholders for the embedded architecture diagram — leave them in place so the diagram stays in this section.
                    </div>
                  </div>
                )}
                <textarea
                  value={editBuffer}
                  onChange={(e) => setEditBuffer(e.target.value)}
                  className="design-chat-input w-full"
                  style={{ minHeight: "320px", fontFamily: "JetBrains Mono, ui-monospace, monospace", fontSize: "0.85rem", lineHeight: 1.55 }}
                  spellCheck={false}
                />
                {editError && (
                  <div className="design-eyebrow" style={{ color: "hsl(var(--design-mark))", textTransform: "none", letterSpacing: "0.04em" }}>
                    {editError}
                  </div>
                )}
              </div>
            ) : sec ? (
              <div className="space-y-4 leading-relaxed">
                {sec.content.map((b, i) => (
                  <RenderBlock key={i} block={b} sessionId={sessionId} projectId={projectId} />
                ))}
              </div>
            ) : (
              <div className="design-marginalia py-3">Section content unavailable.</div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ============================================
// Block renderer (re-used from SADSectionView)
// ============================================

function RenderBlock({
  block,
  sessionId,
  projectId,
}: {
  block: SADContentBlock;
  sessionId: string;
  projectId: string;
}) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-[0.95rem] leading-relaxed">{block.text}</p>;
    case "heading": {
      const Tag = (`h${Math.min(Math.max(block.level, 2), 5)}` as unknown) as keyof JSX.IntrinsicElements;
      return <Tag className="design-heading mt-2">{block.text}</Tag>;
    }
    case "ordered_list":
      return (
        <ol className="space-y-1.5 text-[0.92rem] pl-5 list-decimal">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{it}</li>
          ))}
        </ol>
      );
    case "bullet_list":
      return (
        <ul className="space-y-1.5 text-[0.92rem] pl-5 list-[square]">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{it}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="design-table">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="whitespace-pre-wrap">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "diagram": {
      const kind = block.alt?.toLowerCase().includes("security")
        ? "security"
        : block.alt?.toLowerCase().includes("infrastructure")
        ? "infrastructure"
        : "logical";
      return (
        <DiagramBlock
          sessionId={sessionId}
          projectId={projectId}
          kind={kind}
          alt={block.alt}
        />
      );
    }
    default:
      return null;
  }
}

const DIAGRAM_KIND_LABEL: Record<string, string> = {
  logical: "Logical Architecture Diagram",
  security: "Security View Diagram",
  infrastructure: "Infrastructure Architecture Diagram",
};

// Read-only embedded draw.io viewer URL. `chrome=0` hides toolbars + edit
// affordances; `proto=json` enables the postMessage protocol we use to
// load the XML once the iframe is ready.
const DRAWIO_VIEWER_URL =
  "https://embed.diagrams.net/?embed=1&proto=json&saveAndExit=0&noSaveBtn=1&toolbar=0&chrome=0&edit=0&hide-pages=1&spin=0";

function DiagramBlock({
  sessionId,
  projectId,
  kind,
  alt,
}: {
  sessionId: string;
  projectId: string;
  kind: "logical" | "security" | "infrastructure" | string;
  alt?: string;
}) {
  // Three rendering modes, tried in order:
  //   1. "svg"   — fast path. SVG bytes were exported earlier and live in S3.
  //                Just an <img> tag, sub-second render.
  //   2. "xml"   — fallback. SVG missing/404; load the saved XML from the
  //                backend and render it in an embedded draw.io viewer iframe.
  //                Slower (~3-5s for draw.io's JS to boot), but bulletproof.
  //   3. "error" — no XML either; the user never saved a diagram.
  const [mode, setMode] = useState<"loading" | "svg" | "xml" | "error">("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [xml, setXml] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const label = DIAGRAM_KIND_LABEL[kind] ?? alt ?? "Architecture Diagram";

  useEffect(() => {
    let cancelled = false;
    let revoke: string | null = null;
    setMode("loading");
    setBlobUrl(null);
    setXml(null);
    setErrorMsg(null);

    // Try SVG first.
    fetchSadDiagramBlobUrl(sessionId, kind as any)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoke = url;
        setBlobUrl(url);
        setMode("svg");
      })
      .catch(() => {
        if (cancelled) return;
        // SVG missing — fall back to loading XML and rendering via iframe.
        // Pass `kind` so the per-type slot is consulted; otherwise the
        // backend defaults to "logical", silently substituting the wrong
        // type into §6 / §7 (or 400-ing when Logical is also empty).
        loadDiagramForSession(
          projectId,
          sessionId,
          undefined,
          undefined,
          kind as "logical" | "infrastructure" | "security",
        )
          .then((res) => {
            if (cancelled) return;
            if (res?.xml && res.xml.trim()) {
              setXml(res.xml);
              setMode("xml");
            } else {
              setErrorMsg(
                "No diagram saved for this session. Go to the Plate 00 phase and click \"Save to session\".",
              );
              setMode("error");
            }
          })
          .catch((e) => {
            if (cancelled) return;
            setErrorMsg(e instanceof Error ? e.message : String(e));
            setMode("error");
          });
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [sessionId, projectId, kind]);

  if (mode === "error") {
    return (
      <figure
        className="design-plate p-6 flex flex-col items-center justify-center text-center"
        style={{
          minHeight: "200px",
          background: "hsl(var(--design-paper-warm) / 0.45)",
          borderStyle: "dashed",
          borderColor: "hsl(var(--design-rule-strong) / 0.55)",
        }}
      >
        <ImageOff className="h-6 w-6 mb-2" style={{ color: "hsl(var(--design-ink-muted))" }} />
        <div className="design-eyebrow">Diagram placeholder</div>
        <div className="design-heading text-lg mt-1">{label}</div>
        <p
          className="design-marginalia mt-2 max-w-md"
          style={{ color: "hsl(var(--design-ink-soft))" }}
        >
          {errorMsg ?? "Diagram unavailable."}
        </p>
      </figure>
    );
  }

  if (mode === "svg" && blobUrl) {
    return (
      <figure className="design-plate p-3">
        <img src={blobUrl} alt={alt ?? label} className="w-full h-auto" />
        <figcaption className="design-eyebrow mt-2 text-center">
          Fig · {alt ?? label}
        </figcaption>
      </figure>
    );
  }

  if (mode === "xml" && xml) {
    return (
      <figure className="design-plate p-3">
        <DrawioViewerIframe xml={xml} alt={alt ?? label} />
        <figcaption className="design-eyebrow mt-2 text-center">
          Fig · {alt ?? label}
        </figcaption>
      </figure>
    );
  }

  // Loading shimmer.
  return (
    <figure className="design-plate p-3">
      <div
        className="w-full"
        style={{
          minHeight: "120px",
          background:
            "repeating-linear-gradient(45deg, hsl(var(--design-rule) / 0.15) 0 8px, transparent 8px 16px)",
        }}
      />
      <figcaption className="design-eyebrow mt-2 text-center">
        Fig · {alt ?? label} · loading…
      </figcaption>
    </figure>
  );
}

/**
 * Embedded read-only draw.io viewer. The iframe loads draw.io's JS, emits
 * an `init` event via postMessage, and we respond with `{action: 'load', xml}`.
 * No SVG export, no CDN icon fetches — just the same renderer the editor
 * uses, but in display-only mode.
 */
function DrawioViewerIframe({ xml, alt }: { xml: string; alt: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== "https://embed.diagrams.net") return;
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      let data: any;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event === "init") {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ action: "load", xml }),
          "https://embed.diagrams.net",
        );
        // Tell draw.io we want a fit-to-page rendering — once the diagram is
        // loaded, fit it to the viewport.
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ action: "status", modified: false }),
          "https://embed.diagrams.net",
        );
        setReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [xml]);

  return (
    <div className="relative w-full" style={{ height: "560px" }}>
      <iframe
        ref={iframeRef}
        src={DRAWIO_VIEWER_URL}
        title={alt}
        className="w-full h-full"
        style={{ border: 0, background: "transparent" }}
      />
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "hsl(var(--design-paper-deep))" }}
        >
          <div className="design-marginalia">Loading diagram…</div>
        </div>
      )}
    </div>
  );
}
