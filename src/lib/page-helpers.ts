import { redirect } from "next/navigation";
import { getSession } from "./auth";
import { ensureSetup, projects, oid } from "./db";
import { serializeProject, type ProjectJSON } from "./types";
import { ObjectId } from "mongodb";

/** Loads the project for a stage page or redirects (used by every /m/[id]/* server page). */
export async function loadProjectForPage(id: string, slug: string): Promise<ProjectJSON> {
  await ensureSetup();
  const session = await getSession();
  if (!session) redirect(`/login?next=/m/${id}/${slug}`);
  const _id = oid(id);
  if (!_id) redirect("/projects");
  const filter: Record<string, unknown> = { _id };
  if (session.role !== "admin") filter.userId = new ObjectId(session.uid);
  const p = await (await projects()).findOne(filter, { projection: { sourceText: 0 } });
  if (!p) redirect("/projects");
  return serializeProject(p);
}
