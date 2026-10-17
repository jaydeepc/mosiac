import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { ensureSetup, projects } from "@/lib/db";
import { Wordmark, TileTrio } from "@/components/Mark";
import { ArrowRight, Plus } from "@/components/Icons";
import { Washes } from "@/components/Washes";
import { STAGES } from "@/lib/types";
import { LogoutButton } from "@/components/LogoutButton";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await ensureSetup();
  const session = await getSession();
  if (!session) redirect("/login?next=/projects");
  const list = await (await projects())
    .find({ userId: new ObjectId(session.uid) }, { projection: { title: 1, stage: 1, targetRole: 1, updatedAt: 1, look: 1, "profile.name": 1, "profile.headline": 1, resume: 1 }, sort: { updatedAt: -1 } })
    .toArray();

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink flex flex-col">
      <Washes variant="welcome" />
      <header className="relative flex items-center justify-between gap-4 flex-wrap px-6 sm:px-14 py-6">
        <Wordmark size={26} />
        <nav className="flex items-center gap-3">
          {session.role === "admin" && (
            <Link href="/admin/users" className="px-4 py-2.5 rounded-full text-sm font-semibold text-muted no-underline hover:text-ink">
              People
            </Link>
          )}
          <span className="pill">{session.name}</span>
          <LogoutButton />
        </nav>
      </header>
      <main className="relative w-full max-w-[1100px] mx-auto px-6 sm:px-14 pb-16 flex flex-col gap-7">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 font-display font-normal text-[40px] sm:text-[48px] tracking-[-0.01em]">Your Mosaics</h1>
            <p className="m-0 text-base text-muted">Pick up where you left off, or aim your story at a new role.</p>
          </div>
          <Link href="/new" className="btn-primary" style={{ boxShadow: "var(--shadow-cta)" }}>
            <Plus size={16} /> New Mosaic
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="card p-10 flex flex-col items-center gap-4 text-center">
            <TileTrio size={16} />
            <p className="m-0 font-display text-2xl">Nothing here yet.</p>
            <p className="m-0 text-muted max-w-[420px]">Begin with an old resume — or none at all — and Mosaic will walk you through eight short steps.</p>
            <Link href="/new" className="btn-primary">
              Begin <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <ul className="list-none m-0 p-0 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))" }}>
            {list.map((p) => {
              const stage = STAGES.find((s) => s.n === Math.min(8, Math.max(2, p.stage))) ?? STAGES[1];
              const done = Boolean(p.resume) && p.stage >= 8;
              return (
                <li key={p._id.toString()} className="card p-5 flex flex-col gap-3 relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <strong className="font-display text-[22px] font-medium truncate">{p.profile?.name || p.title}</strong>
                      <span className="text-[13px] text-muted truncate">{p.targetRole ? `Aimed at ${p.targetRole}` : p.profile?.headline || "Not yet aimed at a role"}</span>
                    </div>
                    <DeleteProjectButton id={p._id.toString()} />
                  </div>
                  <div className="flex gap-1" aria-hidden="true">
                    {STAGES.map((s) => (
                      <span key={s.n} className="flex-1 h-1.5 rounded-sm" style={{ background: s.n <= p.stage ? "#2F6F73" : "#E6E2DA" }} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
                    <span>
                      {done ? "Ready to download" : `Stage ${stage.n} of 8 · ${stage.label}`}
                    </span>
                    <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <Link href={`/m/${p._id.toString()}/${done ? "ready" : stage.slug}`} className="btn-secondary mt-1" style={{ padding: "11px 16px", fontSize: 14 }}>
                    {done ? "Open" : "Continue"} <ArrowRight size={14} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
