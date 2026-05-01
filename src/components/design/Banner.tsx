/**
 * Banner — editorial info / recoverable-error / blocking-error notices.
 *
 * Replaces all OS toasts and modal popups in the redesign. Three variants:
 *   • info        — non-blocking notice (stale state reconcile, etc.)
 *   • recoverable — has a Retry; user can usually self-recover
 *   • blocking    — cannot proceed without resolution; uses crimson-deep + ⚠
 *
 * The visual language lives in `design-theme.css`. This component composes
 * title + body + optional action area (slot for buttons / links).
 */

import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BannerVariant = "info" | "recoverable" | "blocking";

interface Props {
  variant: BannerVariant;
  title?: string;
  children?: ReactNode;
  /** Right-side cluster — typically [Retry] [Open logs] etc. */
  actions?: ReactNode;
  /** When true, the banner is the focus target on mount — used for blocking
   *  errors per Stage 5's focus discipline. */
  focusOnMount?: boolean;
  className?: string;
}

const ICON: Record<BannerVariant, typeof Info> = {
  info: Info,
  recoverable: Info,
  blocking: AlertTriangle,
};

export const Banner = ({
  variant,
  title,
  children,
  actions,
  focusOnMount,
  className,
}: Props) => {
  const Icon = ICON[variant];
  return (
    <div
      className={cn("design-banner", className)}
      data-variant={variant}
      role={variant === "info" ? "status" : "alert"}
      tabIndex={focusOnMount ? -1 : undefined}
      ref={(el) => { if (focusOnMount && el) el.focus(); }}
    >
      <Icon
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        aria-hidden
        style={{ color: "currentColor" }}
      />
      <div className="flex-1 min-w-0">
        {title && <span className="design-banner__title">{title}</span>}
        {children && <div className="design-banner__body">{children}</div>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
