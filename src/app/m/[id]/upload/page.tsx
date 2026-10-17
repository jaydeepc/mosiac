import { loadProjectForPage } from "@/lib/page-helpers";
import { UploadStage } from "@/components/stages/UploadStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "upload");
  return <UploadStage initial={project} />;
}
