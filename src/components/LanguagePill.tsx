"use client";

import { useState } from "react";
import { Globe } from "./Icons";
import { LANGUAGES } from "@/lib/config";

/** Globe + language select pill (header). Persists the choice for the sign-in page. */
export function LanguagePill({ initial = "en", onChange, compact = false }: { initial?: string; onChange?: (code: string) => void; compact?: boolean }) {
  const [lang, setLang] = useState(initial);
  return (
    <label className="flex items-center gap-2 bg-white border border-line rounded-full font-semibold text-ink" style={{ padding: compact ? "8px 12px" : "10px 14px", fontSize: compact ? 13 : 14 }}>
      <Globe size={compact ? 14 : 16} stroke="#2F6F73" />
      <span className="sr-only">Language</span>
      <select
        value={lang}
        onChange={(e) => {
          setLang(e.target.value);
          try {
            localStorage.setItem("mosaic.lang", e.target.value);
            document.cookie = `mosaic_lang=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          } catch {
            /* ignore */
          }
          onChange?.(e.target.value);
        }}
        className="border-0 bg-transparent outline-none"
        style={{ font: "inherit", color: "inherit" }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
