import { loadProjectForPage } from "@/lib/page-helpers";
import { ReadyStage } from "@/components/stages/ReadyStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "ready");
  return <ReadyStage initial={project} />;
}
