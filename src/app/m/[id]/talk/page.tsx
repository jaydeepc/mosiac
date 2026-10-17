import { loadProjectForPage } from "@/lib/page-helpers";
import { TalkStage } from "@/components/stages/TalkStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "talk");
  return <TalkStage initial={project} />;
}
