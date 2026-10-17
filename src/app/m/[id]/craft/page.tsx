import { loadProjectForPage } from "@/lib/page-helpers";
import { CraftStage } from "@/components/stages/CraftStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "craft");
  return <CraftStage initial={project} />;
}
