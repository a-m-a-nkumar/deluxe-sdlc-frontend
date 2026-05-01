/**
 * Hidden draw.io iframe SVG export utility.
 *
 * The Design Assistant's main draw.io iframe (`embed.diagrams.net`) only
 * exchanges XML with the host today. To embed the diagram in a SAD we need
 * a self-contained SVG. We reuse draw.io's own renderer by spinning up a
 * one-shot hidden iframe, sending it `{action: 'export', format: 'xmlsvg',
 * embedImages: true, xml}`, and capturing the SVG that comes back.
 *
 * No new server dependency, no headless-browser tax — just the same draw.io
 * code path the user is already trusting in the editor.
 */

const DRAWIO_EMBED_URL = "https://embed.diagrams.net/?embed=1&proto=json&saveAndExit=0&noSaveBtn=1&spin=0";

type ExportFormat = "svg" | "png";

/**
 * Convert a draw.io mxGraph XML string into a PNG bytes blob (data URL).
 *
 * Spawns a fresh hidden iframe, loads the XML, exports. Slower path —
 * use `exportPngFromVisibleIframe` first when a viewer iframe is already
 * on the page (e.g. the SAD section view's DiagramBlock).
 */
export function exportDrawioXmlAsPng(xml: string): Promise<string> {
  return runDrawioExport(xml, "png");
}

/**
 * Export a PNG from a draw.io iframe that is ALREADY loaded with a
 * diagram on the page. This is the fast and reliable path:
 *   • The iframe has already loaded draw.io's JS.
 *   • It already has the diagram rendered (the user can see it).
 *   • Export just rasterises the existing canvas.
 *
 * Used by the DOCX-download flow. The viewer iframe rendered by
 * DiagramBlock in the SAD page is the source.
 *
 * Resolves with `data:image/png;base64,...`. Rejects if no iframe
 * is found, the iframe doesn't respond, or it returns an unexpected
 * shape.
 */
export function exportPngFromVisibleIframe(timeoutMs = 20_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const iframe = findVisibleDrawioIframe();
    if (!iframe?.contentWindow) {
      reject(new Error("No visible draw.io iframe found on the page"));
      return;
    }

    const t0 = Date.now();
    const stamp = () => `${(Date.now() - t0).toString().padStart(5)}ms`;
    console.log(`[draw.io export] ${stamp()} starting from VISIBLE iframe (${iframe.src.split("?")[0]})`);

    let resolved = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };

    const timer = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(
        new Error(
          `draw.io visible-iframe PNG export timed out after ${timeoutMs / 1000}s. ` +
            `The iframe is loaded but didn't respond to action: export.`,
        ),
      );
    }, timeoutMs);

    const onMessage = (e: MessageEvent) => {
      if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
      let msg: any;
      try {
        msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      if (msg.event !== "export") return;
      if (msg.format !== "png" && msg.format !== "xmlpng") return;

      if (resolved) return;
      resolved = true;
      console.log(`[draw.io export] ${stamp()} visible-iframe PNG response received (format=${msg.format})`);
      cleanup();
      const data: string = msg.data ?? msg.message ?? "";
      if (data.startsWith("data:image/png;")) {
        resolve(data);
      } else {
        reject(new Error(`draw.io PNG export returned unexpected shape: ${data.slice(0, 80)}`));
      }
    };

    window.addEventListener("message", onMessage);
    iframe.contentWindow.postMessage(
      JSON.stringify({ action: "export", format: "png", spin: false, embedImages: false }),
      "*",
    );
  });
}

/** Locate the first visible draw.io iframe in the DOM. Used by the
 * visible-iframe export path. Returns null if none rendered. */
function findVisibleDrawioIframe(): HTMLIFrameElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLIFrameElement>('iframe[src*="diagrams.net"]'),
  );
  // Prefer iframes that look loaded (have a contentWindow and non-zero
  // bounding box). Falls back to the first match.
  for (const f of candidates) {
    if (!f.contentWindow) continue;
    const r = f.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return f;
  }
  return candidates[0] ?? null;
}

// Two separate budgets:
//  • INIT — time we wait for draw.io's JS to load + emit its "init" event.
//    On slow networks / cold-cache this can take 30+ seconds.
//  • EXPORT — time we wait for the SVG render after we've sent the request.
//    Real renders are fast (<5s) once the iframe is alive.
const INIT_TIMEOUT_MS = 60_000;
const EXPORT_TIMEOUT_MS = 30_000;

/**
 * Convert a draw.io mxGraph XML string into a self-contained SVG string.
 * Resolves with the SVG markup; rejects on timeout or iframe error.
 *
 * Note: SVG export is fragile in some environments (icon CDN can stall).
 * For DOCX embedding prefer `exportDrawioXmlAsPng`, which uses the same
 * hidden iframe but the PNG-rasterise code path that doesn't hang on
 * external image fetches.
 *
 * Step-by-step `[draw.io export]` console logs make it possible to tell
 * which phase is slow/stuck (iframe load, init, export, decode).
 */
export function exportDrawioXmlAsSvg(xml: string): Promise<string> {
  return runDrawioExport(xml, "svg");
}

/**
 * Shared engine for both SVG and PNG exports. Spins up a hidden draw.io
 * iframe, listens for `init`, sends `{action: "export", format, xml}`,
 * decodes the response data URL into a string. Resolves with:
 *   • SVG: raw SVG markup ("<svg ...>...</svg>")
 *   • PNG: data URL string ("data:image/png;base64,...")
 */
function runDrawioExport(xml: string, format: ExportFormat): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!xml || !xml.trim()) {
      reject(new Error("Cannot export empty XML"));
      return;
    }

    const t0 = Date.now();
    const stamp = () => `${(Date.now() - t0).toString().padStart(5)}ms`;
    console.log(`[draw.io export] ${stamp()} starting format=${format} (xml ${xml.length} chars)`);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.left = "-1000px";
    iframe.style.top = "-1000px";
    iframe.style.opacity = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = DRAWIO_EMBED_URL;

    let resolved = false;
    let phase: "loading" | "init" | "exporting" = "loading";
    let exportTimer: number | null = null;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLoad);
      if (exportTimer != null) window.clearTimeout(exportTimer);
      window.clearTimeout(initTimer);
      try {
        iframe.parentNode?.removeChild(iframe);
      } catch {
        /* ignore */
      }
    };

    const fail = (err: Error) => {
      if (resolved) return;
      resolved = true;
      console.warn(`[draw.io export] ${stamp()} FAILED in phase=${phase}: ${err.message}`);
      cleanup();
      reject(err);
    };

    // Init timeout — covers iframe network load + draw.io JS init.
    const initTimer = window.setTimeout(() => {
      if (phase !== "loading" && phase !== "init") return;
      fail(
        new Error(
          `draw.io did not become ready within ${INIT_TIMEOUT_MS / 1000}s ` +
            `(phase=${phase}). Check network, content blockers, or browser ` +
            `extensions blocking embed.diagrams.net.`,
        ),
      );
    }, INIT_TIMEOUT_MS);

    const onLoad = () => {
      console.log(`[draw.io export] ${stamp()} iframe load event fired`);
      phase = "init";
    };

    const onMessage = (e: MessageEvent) => {
      if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
      let msg: any;
      try {
        msg = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      // 1. iframe ready → send export request.
      if (msg.event === "init") {
        console.log(`[draw.io export] ${stamp()} init received → sending export request`);
        phase = "exporting";
        // Now wait for the export response under a tighter budget; init has happened.
        exportTimer = window.setTimeout(() => {
          fail(
            new Error(
              `draw.io export hung — init succeeded but no export response within ${EXPORT_TIMEOUT_MS / 1000}s. ` +
                `Most likely a referenced image (AWS icon CDN, etc.) is slow or blocked.`,
            ),
          );
        }, EXPORT_TIMEOUT_MS);
        // `embedImages: false` — do NOT inline external images. With it on,
        // draw.io's SVG path blocks waiting for icon CDNs to respond.
        // PNG path rasterises through canvas and isn't affected, but we
        // pass the flag for both formats anyway as a belt-and-braces.
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            action: "export",
            format,
            xml,
            embedImages: false,
            spin: false,
          }),
          "*",
        );
        return;
      }

      // 2. export response. Format echoed in msg.format.
      //   • SVG: "data:image/svg+xml;base64,..." or raw "<svg ...>..."
      //   • PNG: "data:image/png;base64,..."
      if (msg.event === "export") {
        const respFormat = msg.format;
        const matchesSvg = format === "svg" && (respFormat === "xmlsvg" || respFormat === "svg");
        const matchesPng = format === "png" && (respFormat === "png" || respFormat === "xmlpng");
        if (!matchesSvg && !matchesPng) return;

        if (resolved) return;
        resolved = true;
        console.log(`[draw.io export] ${stamp()} export response received (format=${respFormat})`);
        cleanup();
        try {
          const data: string = msg.data ?? msg.message ?? "";
          if (format === "png") {
            // PNG: pass the data URL through verbatim — caller hands it to a
            // backend that wants the bytes (we'll strip the header server-side).
            if (data.startsWith("data:image/png;")) {
              console.log(`[draw.io export] ${stamp()} got PNG data URL (${data.length} chars)`);
              resolve(data);
              return;
            }
            reject(new Error(`draw.io PNG export returned unexpected shape: ${data.slice(0, 80)}`));
            return;
          }
          // SVG path
          if (data.startsWith("data:image/svg+xml;base64,")) {
            const base64 = data.split(",", 2)[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const decoder = new TextDecoder("utf-8");
            const decoded = decoder.decode(bytes);
            console.log(`[draw.io export] ${stamp()} decoded ${decoded.length} chars of SVG`);
            resolve(decoded);
            return;
          }
          if (data.startsWith("<")) {
            console.log(`[draw.io export] ${stamp()} got raw SVG markup (${data.length} chars)`);
            resolve(data);
            return;
          }
          reject(new Error("draw.io SVG export returned unexpected data shape"));
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
        return;
      }
    };

    iframe.addEventListener("load", onLoad);
    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}
