import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { Wordmark } from "@/components/Mark";
import { Washes } from "@/components/Washes";
import { LoginForm } from "./LoginForm";
import { PaintedHero } from "@/components/PaintedHero";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  const { next } = await searchParams;
  if (session) redirect(next && next.startsWith("/") ? next : "/projects");

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-wrap">
      <section aria-label="Painted introduction" className="relative flex-[1_1_520px] min-w-0 overflow-hidden bg-paper-2 flex flex-col justify-between" style={{ minHeight: 420, padding: "40px 48px" }}>
        <Washes variant="login" />
        <div className="relative">
          <Wordmark size={26} />
        </div>
        <div className="relative self-center my-6 w-full flex justify-center">
          <PaintedHero />
        </div>
        <blockquote className="relative m-0 max-w-[460px] flex flex-col gap-2.5">
          <p className="m-0 font-display text-[28px] sm:text-[34px] leading-[1.15] tracking-[-0.01em]" style={{ textWrap: "pretty" }}>
            Every career is a mosaic. Most resumes only show the grout.
          </p>
          <span className="text-sm text-muted">Tell your story once, in your own words. Aim it anywhere.</span>
        </blockquote>
      </section>

      <section aria-labelledby="h-signin" className="flex-[1_1_480px] min-w-0 flex items-center justify-center" style={{ padding: "48px 40px" }}>
        <LoginForm allowSignup={config.allowSelfSignup} next={next} />
      </section>
    </div>
  );
}
