import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Wordmark } from "@/components/Mark";
import { UsersAdmin } from "./UsersAdmin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/users");
  if (session.role !== "admin") redirect("/");
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="flex items-center justify-between gap-4 flex-wrap px-6 sm:px-8 py-4 border-b border-line bg-white">
        <Wordmark />
        <nav className="flex items-center gap-3">
          <Link href="/projects" className="px-3 py-2 text-[13px] font-semibold text-muted no-underline hover:text-ink">
            My Mosaics
          </Link>
          <span className="pill">
            {session.name} · admin
          </span>
        </nav>
      </header>
      <main className="w-full max-w-[1100px] mx-auto px-6 sm:px-10 py-9 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display font-normal text-[40px] tracking-[-0.01em]">People</h1>
          <p className="m-0 text-base text-muted leading-[1.5]">
            Everyone who can sign in to Mosaic. Create accounts, hand out passwords, pause access, or make someone an admin.
          </p>
        </div>
        <UsersAdmin selfId={session.uid} />
      </main>
    </div>
  );
}
