import { redirect } from "next/navigation";
import { loadProjectForPage } from "@/lib/page-helpers";
import { STAGES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadProjectForPage(id, "upload");
  const stage = STAGES.find((s) => s.n === Math.min(8, Math.max(2, p.stage))) ?? STAGES[1];
  redirect(`/m/${id}/${p.resume && p.stage >= 8 ? "ready" : stage.slug}`);
}
