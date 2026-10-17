import Link from "next/link";
import { getSession } from "@/lib/auth";
import { MosaicMark, Wordmark } from "@/components/Mark";
import { ArrowRight, Mic } from "@/components/Icons";
import { Washes } from "@/components/Washes";
import { LanguagePill } from "@/components/LanguagePill";
import { HeroIllustration } from "@/components/HeroIllustration";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await getSession();
  const beginHref = session ? "/new" : "/login?next=/new";

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink flex flex-col">
      <Washes variant="welcome" />

      <header className="relative flex items-center justify-between gap-6 flex-wrap px-6 py-5 sm:px-14 sm:py-7">
        <Wordmark size={26} />
        <nav className="flex items-center gap-3 flex-wrap">
          <LanguagePill initial={session?.language ?? "en"} />
          {session ? (
            <>
              <Link href="/projects" className="px-4 py-2.5 rounded-full text-sm font-semibold text-ink no-underline hover:bg-white">
                My Mosaics
              </Link>
              {session.role === "admin" && (
                <Link href="/admin/users" className="px-4 py-2.5 rounded-full text-sm font-semibold text-muted no-underline hover:text-ink">
                  People
                </Link>
              )}
            </>
          ) : (
            <Link href="/login" className="px-4 py-2.5 rounded-full text-sm font-semibold text-ink no-underline hover:bg-white">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <main className="relative max-w-[1200px] w-full mx-auto px-6 sm:px-14 pt-6 sm:pt-12 flex flex-wrap gap-12 items-center">
        <section className="flex-[1_1_460px] min-w-0 flex flex-col gap-7">
          <p className="m-0 inline-flex items-center gap-2 text-[13px] font-bold tracking-[0.08em] uppercase text-teal">
            <span className="w-2 h-2 rounded-full bg-teal" />
            Eight short steps · any language
          </p>
          <h1 className="m-0 font-display font-normal text-[48px] sm:text-[72px] leading-[1.02] tracking-[-0.02em]" style={{ textWrap: "pretty" }}>
            Your story,
            <br />
            <em className="italic text-teal">pieced together.</em>
          </h1>
          <p className="m-0 max-w-[520px] text-[17px] sm:text-[19px] leading-[1.55] text-muted" style={{ textWrap: "pretty" }}>
            Upload what you have, talk about what you have done since — in the language you think in — and Mosaic shapes it into a two‑page
            story aimed at the exact role you want.
          </p>
          <div className="flex gap-3.5 flex-wrap items-center">
            <Link href={beginHref} className="btn-primary" style={{ padding: "16px 28px", fontSize: 16, boxShadow: "var(--shadow-cta)" }}>
              {session ? "Begin a new Mosaic" : "Begin"}
              <ArrowRight size={18} />
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 px-5 py-4 text-base font-semibold text-ink no-underline hover:text-teal">
              See how it works
            </a>
          </div>
          <p className="m-0 flex items-center gap-2.5 text-sm text-muted">
            <Mic size={18} stroke="#2F6F73" />
            Speak instead of typing — Mosaic listens in Hindi, Tamil, Bengali, Spanish, Arabic, Japanese and more.
          </p>
        </section>

        <section aria-label="Illustration of a resume being assembled" className="flex-[1_1_420px] min-w-0 flex justify-center">
          <HeroIllustration />
        </section>
      </main>

      <section id="how" className="relative max-w-[1200px] w-full mx-auto mt-14 px-6 sm:px-14 pb-14">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-5">
          <h2 className="m-0 font-display font-normal text-[30px]">How it works</h2>
          <p className="m-0 text-sm text-muted">Skip any step. Come back to any step.</p>
        </div>
        <ol className="list-none m-0 p-0 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
          {[
            ["1–2", "Upload what you have", "An old resume, any format. Mosaic reads it and notices when it was last updated."],
            ["3–4", "Confirm and talk", "Tick what is really you online, then just talk about the years in between."],
            ["5–6", "Aim and choose a look", "Name the role. Pick visual or classic. Two pages, never more."],
            ["7–8", "Refine and download", "Comment on any section by voice or text, then take it as PDF or DOCX."],
          ].map(([n, t, d]) => (
            <li key={n} className="p-[18px] rounded-2xl bg-white border border-line flex flex-col gap-2">
              <span className="font-display text-[28px] text-teal">{n}</span>
              <strong className="text-[15px]">{t}</strong>
              <span className="text-[13px] text-muted leading-[1.5]">{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="relative px-6 sm:px-14 pb-8 flex items-center gap-2 text-xs text-muted">
        <MosaicMark size={14} /> Mosaic · Your resume, voice notes and anything found online stay private to you.
      </footer>
    </div>
  );
}
