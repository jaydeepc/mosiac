"use client";

import { useState } from "react";

/**
 * Generated watercolour hero (GPT Image 2.5 Sunburst via OpenRouter), cached server-side.
 * Shows the drifting-tiles placeholder from the design until the painting arrives.
 */
export function PaintedHero({ artKey = "hero-login", width = 380, height = 300 }: { artKey?: string; width?: number; height?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative overflow-hidden" style={{ width: `min(${width}px, 100%)`, aspectRatio: `${width} / ${height}`, borderRadius: 24 }}>
      {!loaded && (
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-teal" style={{ border: "1.5px dashed rgba(47,111,115,0.45)", borderRadius: 24 }}>
          <div className="flex gap-2.5 items-end">
            <span className="anim-float" style={{ "--r": "-8deg", width: 44, height: 44, borderRadius: 11, background: "#2F6F73", opacity: 0.9 } as React.CSSProperties} />
            <span className="anim-float" style={{ "--r": "6deg", width: 58, height: 58, borderRadius: 14, background: "#9CC3C5", opacity: 0.9, animationDelay: "0.6s" } as React.CSSProperties} />
            <span className="anim-float" style={{ "--r": "-4deg", width: 36, height: 36, borderRadius: 9, background: "#E7B99E", opacity: 0.9, animationDelay: "1.2s" } as React.CSSProperties} />
            <span className="anim-float" style={{ "--r": "10deg", width: 50, height: 50, borderRadius: 12, background: "#C9693F", opacity: 0.9, animationDelay: "1.8s" } as React.CSSProperties} />
          </div>
          <span className="text-xs font-bold tracking-[0.08em] uppercase">{failed ? "Watercolour tiles" : "Painting…"}</span>
        </div>
      )}
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/art/${artKey}`}
          alt="Watercolour tiles drifting down into a blank page"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: loaded ? 1 : 0, borderRadius: 24 }}
        />
      )}
    </div>
  );
}
