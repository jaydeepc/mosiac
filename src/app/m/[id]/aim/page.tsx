import { loadProjectForPage } from "@/lib/page-helpers";
import { AimStage } from "@/components/stages/AimStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "aim");
  return <AimStage initial={project} />;
}
