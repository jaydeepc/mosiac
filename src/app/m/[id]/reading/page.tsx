import { loadProjectForPage } from "@/lib/page-helpers";
import { ReadingStage } from "@/components/stages/ReadingStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "reading");
  return <ReadingStage initial={project} />;
}
