"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SHEET_W, SHEET_H } from "./ResumeDocument";

/**
 * Renders a 794×1123 (A4) sheet scaled to the container width. `page` shows the n-th page of the
 * flowing document by offsetting the content, so the same markup serves the preview and the PDF.
 */
export function ScaledSheet({ children, page = 1, maxWidth = 640, className, onMeasure }: { children: ReactNode; page?: number; maxWidth?: number; className?: string; onMeasure?: (pages: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / SHEET_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!onMeasure || !content.current) return;
    const el = content.current;
    const ro = new ResizeObserver(() => {
      onMeasure(Math.max(1, Math.ceil(el.scrollHeight / SHEET_H)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onMeasure]);

  return (
    <div ref={wrap} className={className} style={{ width: "100%", maxWidth, position: "relative" }}>
      <div className="paper-sheet" style={{ width: "100%", aspectRatio: `${SHEET_W} / ${SHEET_H}`, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: SHEET_W, height: SHEET_H, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>
          <div ref={content} style={{ position: "absolute", top: -(page - 1) * SHEET_H, left: 0, width: SHEET_W, minHeight: SHEET_H }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
