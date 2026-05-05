/**
 * SectionErrorBoundary — class-based React error boundary scoped to one
 * SAD section / one design subtree.
 *
 * Background: a malformed block in `sec.content` (e.g. an `ordered_list`
 * with `items: undefined` from a corrupted `previous_versions` stack)
 * threw inside `RenderBlock` and, with no boundary in the tree, killed
 * the entire Design page — pinkish-cream background with no content.
 *
 * This boundary catches render errors and renders an editorial-styled
 * placeholder so the rest of the page stays usable. The user can
 * refresh, edit/regenerate the section, or revert again from the row
 * controls — the rest of the SAD viewer is unaffected.
 */

import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  /** Optional label shown in the fallback. Helps the user understand
   * which section failed when more than one is on screen. */
  label?: string;
  /** Optional click handler — typically calls back to the parent so the
   * user can retry / revert / regenerate the failing section. */
  onRetry?: () => void;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to the dev console so the actual stack is preserved for
    // debugging. Avoids the previous failure mode where a render crash
    // produced a totally blank page with no diagnostic.
    // eslint-disable-next-line no-console
    console.error("[SectionErrorBoundary] render failed", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        className="design-plate p-5 flex items-start gap-3"
        style={{
          background: "hsl(var(--design-paper-warm))",
          borderLeft: "4px solid hsl(var(--design-mark-deep))",
          borderRadius: "0 2px 2px 0",
        }}
      >
        <AlertTriangle
          className="w-5 h-5 flex-shrink-0 mt-0.5"
          style={{ color: "hsl(var(--design-mark-deep))" }}
        />
        <div className="flex-1 min-w-0">
          <div
            className="design-eyebrow"
            style={{ color: "hsl(var(--design-mark-deep))" }}
          >
            {this.props.label ?? "Section"} · render error
          </div>
          <p
            className="design-marginalia mt-1"
            style={{ fontSize: "0.85rem", color: "hsl(var(--design-ink))" }}
          >
            This section's content is in a shape the renderer didn't expect
            (likely a corrupted block from a regenerate / revert). The rest
            of the document is fine. Try regenerating or editing this
            section, or refresh the page.
          </p>
          <p
            className="design-mono mt-2"
            style={{
              fontSize: "0.72rem",
              color: "hsl(var(--design-ink-muted))",
              wordBreak: "break-word",
            }}
          >
            {error.message}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="design-btn-ghost"
              onClick={this.reset}
            >
              Try again
            </button>
            {this.props.onRetry && (
              <button
                type="button"
                className="design-btn-link"
                onClick={() => {
                  this.reset();
                  this.props.onRetry?.();
                }}
              >
                Retry from server →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
