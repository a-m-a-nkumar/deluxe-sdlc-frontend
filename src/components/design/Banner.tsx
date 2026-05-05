/**
 * Banner — inline notice for info / recoverable error / blocking error.
 *
 * Replaces OS toasts and modal popups with an editorial-coloured inline strip.
 * Built on shadcn <Alert> + canonical Velox tokens (no design-* classes).
 */

import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
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

const VARIANT_CLASSES: Record<BannerVariant, string> = {
  info:
    "border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] [&>svg]:text-[hsl(var(--primary))]",
  recoverable:
    "border-l-4 border-l-[hsl(var(--audit-warn))] bg-[hsl(var(--audit-warn)/0.08)] [&>svg]:text-[hsl(var(--audit-warn))]",
  blocking:
    "border-l-4 border-l-destructive bg-destructive/10 [&>svg]:text-destructive",
};

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
    <Alert
      role={variant === "info" ? "status" : "alert"}
      tabIndex={focusOnMount ? -1 : undefined}
      ref={(el) => { if (focusOnMount && el) el.focus(); }}
      className={cn(VARIANT_CLASSES[variant], "py-3", className)}
    >
      <Icon className="w-4 h-4" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-sm font-semibold text-[hsl(var(--ink-body))] mb-0.5">
              {title}
            </div>
          )}
          {children && (
            <div className="text-sm text-[hsl(var(--ink-muted))] leading-relaxed">
              {children}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </Alert>
  );
};
