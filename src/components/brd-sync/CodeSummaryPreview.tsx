import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchConfluencePage } from "@/services/brdSyncApi";

interface CodeSummaryPreviewProps {
  pageId: string;
}

const stripConfluenceMacros = (html: string): string =>
  html
    .replace(/<ac:structured-macro[\s\S]*?<\/ac:structured-macro>/g, "")
    .replace(/<ac:adf-extension[\s\S]*?<\/ac:adf-extension>/g, "")
    .replace(/<ac:[^>]*>/g, "")
    .replace(/<\/ac:[^>]*>/g, "");

export const CodeSummaryPreview = ({ pageId }: CodeSummaryPreviewProps) => {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml(null);
    fetchConfluencePage(pageId)
      .then((page) => {
        if (cancelled) return;
        const raw = page.body?.storage?.value ?? "";
        setHtml(stripConfluenceMacros(raw));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "Failed to load summary content");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading summary…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!html) {
    return (
      <div className="text-sm text-muted-foreground py-8">
        This summary has no body content.
      </div>
    );
  }

  return (
    <article
      className="prose prose-sm max-w-none dark:prose-invert
        prose-headings:scroll-mt-20
        prose-h1:text-xl prose-h2:text-base prose-h3:text-sm
        prose-code:before:content-none prose-code:after:content-none
        prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-muted/60 prose-pre:border"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
