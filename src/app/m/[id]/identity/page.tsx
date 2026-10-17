import { loadProjectForPage } from "@/lib/page-helpers";
import { IdentityStage } from "@/components/stages/IdentityStage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProjectForPage(id, "identity");
  return <IdentityStage initial={project} />;
}
