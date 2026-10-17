"use client";

import { Mic, Stop } from "@/components/Icons";

export function MicButton({ recording, onClick, size = 84, label }: { recording: boolean; onClick: () => void; size?: number; label?: string }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {recording && (
        <>
          <span aria-hidden="true" className="absolute inset-0 rounded-full anim-pulse-ring" style={{ background: "rgba(47,111,115,0.25)" }} />
          <span aria-hidden="true" className="absolute inset-0 rounded-full anim-pulse-ring" style={{ background: "rgba(47,111,115,0.25)", animationDelay: "0.6s" }} />
        </>
      )}
      <button
        type="button"
        aria-label={label ?? (recording ? "Stop listening" : "Start talking")}
        onClick={onClick}
        className="relative inline-flex items-center justify-center rounded-full border-0 text-white transition-transform active:scale-95"
        style={{ width: size, height: size, background: recording ? "#2F6F73" : "#1E2430", boxShadow: recording ? "0 10px 24px rgba(47,111,115,0.3)" : "0 10px 24px rgba(30,36,48,0.2)" }}
      >
        {recording ? <Stop size={Math.round(size * 0.34)} /> : <Mic size={Math.round(size * 0.36)} />}
      </button>
    </div>
  );
}

const DELAYS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1];
const DURS = [1, 1.1, 0.9, 1.2, 1, 0.8, 1.1, 1, 0.9, 1.2, 1, 0.8];

export function Waveform({ level = 0.5, bars = 12, height = 28, active = true }: { level?: number; bars?: number; height?: number; active?: boolean }) {
  return (
    <div aria-hidden="true" className="flex items-center" style={{ gap: 3, height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={active ? "anim-bar" : undefined}
          style={{
            width: 4,
            height: active ? `${40 + Math.round(level * 60)}%` : "35%",
            borderRadius: 2,
            background: i % 2 ? "#2F6F73" : "#9CC3C5",
            animationDuration: `${DURS[i % DURS.length] / Math.max(0.6, 0.6 + level)}s`,
            animationDelay: `${DELAYS[i % DELAYS.length]}s`,
            transition: "height 0.2s ease",
          }}
        />
      ))}
    </div>
  );
}
