import {
  withErrorHandling,
  parseBody,
  jsonOk,
} from "@/lib/server/api-helpers";
import {
  listHomeSections,
  createHomeSection,
} from "@/lib/server/admin/home-sections";
import { homeSectionSchema } from "@/lib/server/admin/schemas";

export const GET = withErrorHandling(async () => {
  return jsonOk(await listHomeSections());
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, homeSectionSchema);
  return jsonOk(await createHomeSection(body), { status: 201 });
});
