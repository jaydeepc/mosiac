import { loadProjectForPage } from "@/lib/page-helpers";
import { LookStage } from "@/components/stages/LookStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "look");
  return <LookStage initial={project} />;
}
