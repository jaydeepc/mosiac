import { requireAdmin } from "@/lib/auth";
import { handleError, json } from "@/lib/api";
import { config } from "@/lib/config";

/** Admin-only: which models and search engine this deployment is running with. */
export async function GET() {
  try {
    await requireAdmin();
    return json({
      models: config.models,
      web: config.web,
      image: config.image,
      questionBudget: config.questionBudget,
      appUrl: config.appUrl,
    });
  } catch (e) {
    return handleError(e);
  }
}
