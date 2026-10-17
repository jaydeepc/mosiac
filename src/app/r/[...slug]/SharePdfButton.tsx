"use client";

import { Download } from "@/components/Icons";

export function SharePdfButton({ slug, which }: { slug: string; which: "main" | "second" }) {
  return (
    <a href={`/api/share/${encodeURIComponent(slug)}/pdf?lang=${which}`} className="btn-primary" style={{ padding: "9px 16px", fontSize: 13 }}>
      <Download size={14} /> PDF
    </a>
  );
}
