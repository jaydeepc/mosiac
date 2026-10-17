"use client";

import { useEffect, useState } from "react";
import { TileTrio } from "./Mark";

const FACTS: Record<string, string[]> = {
  reading: [
    "Recruiters spend about seven seconds on a first skim. The top third of page one does most of the work.",
    "A resume is a mosaic: lots of small true pieces, arranged so the picture is clear from a distance.",
    "Numbers travel better than adjectives. 'Cut onboarding from two days to five minutes' beats 'improved onboarding'.",
    "Screening software reads plain structure best: real headings, real bullets, no text hidden in images.",
    "Two pages is the quiet maximum almost everywhere. Older roles can become a single line without losing the arc.",
  ],
  research: [
    "Mosaic only reads inside pages you tick. Everything else is left closed.",
    "When several people share your name, Mosaic shows the alternatives instead of guessing.",
    "Conference talks and articles count as evidence; follower counts and endorsements don't.",
    "If a page turns out to have nothing useful for this resume, Mosaic says so rather than force-fitting it.",
  ],
  listening: [
    "Talk the way you'd tell a friend who knows your field. Mosaic tidies the grammar, not the facts.",
    "Any language works, mid-sentence switches included. The resume is written afterwards, in the language you chose.",
    "Numbers help most: team size, volume, what went up or down, and roughly by how much.",
    "Rough estimates are fine. Mosaic marks them 'confirm?' so you can check them before downloading.",
    "You can pause, think, and carry on. Long answers are welcome; Mosaic keeps writing as you speak.",
  ],
  crafting: [
    "Most recent two roles get the most space; older ones shrink to the one line that still matters.",
    "The summary is written last, once the target role is known, so every sentence can earn its place.",
    "Charts in the Visual look are drawn only from numbers you gave or confirmed, never from stock.",
    "Colours are chosen to differ in lightness as well as hue, so the resume reads well with colour-blindness.",
    "Clichés are removed on sight: no 'passionate', no 'visionary', no 'results-driven'.",
  ],
};

export function FunFacts({ topic = "reading", intervalMs = 6000, className }: { topic?: keyof typeof FACTS | string; intervalMs?: number; className?: string }) {
  const facts = FACTS[topic] ?? FACTS.reading;
  const [i, setI] = useState(() => Math.floor(Math.random() * facts.length));
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setShown(false);
      setTimeout(() => {
        setI((n) => (n + 1) % facts.length);
        setShown(true);
      }, 350);
    }, intervalMs);
    return () => clearInterval(t);
  }, [facts.length, intervalMs]);
  return (
    <div className={`flex items-start gap-3 rounded-[14px] ${className ?? ""}`} style={{ padding: "12px 14px", background: "#F7F5EF" }}>
      <span className="mt-1">
        <TileTrio size={8} />
      </span>
      <p className="m-0 text-[13px] leading-[1.5] text-muted transition-opacity duration-300" style={{ opacity: shown ? 1 : 0 }}>
        <span className="font-bold text-ink">While you wait · </span>
        {facts[i]}
      </p>
    </div>
  );
}
