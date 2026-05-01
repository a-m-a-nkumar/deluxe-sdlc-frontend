/**
 * Cartouche — the signature element of the Design Assistant module.
 *
 * It renders a tiny monospace title-block in the corner of every plate,
 * reading like real architectural drafting metadata:
 *
 *     ┌──────────────────────────────────────────────────────┐
 *     │ DRAWN · A.K.   ⌁   REV · 02   ⌁   SCALE · N/A        │
 *     └──────────────────────────────────────────────────────┘
 *
 * The `⌁` divider is in Deluxe crimson to nail the brand connection
 * without becoming decoration. Use this component in the header of
 * every page-level surface (diagram phase, SAD phase, section view).
 */

import { Fragment } from "react";

export interface CartoucheField {
  label: string;
  value: string;
}

interface Props {
  fields: CartoucheField[];
  className?: string;
}

export function Cartouche({ fields, className }: Props) {
  return (
    <div className={`design-cartouche ${className ?? ""}`}>
      {fields.map((f, i) => (
        <Fragment key={`${f.label}-${i}`}>
          {i > 0 && <span className="design-cartouche__divider">⌁</span>}
          <span>
            <span className="design-cartouche__field-label">{f.label}</span>
            <span className="design-cartouche__field-label"> · </span>
            <span className="design-cartouche__field-value">{f.value}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}
