// Called by the cron once the exports are stored: every page is rebuilt at its next visit.
import { revalidatePath } from "next/cache";
import { env } from "~/env";

export function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.REVALIDATE_SECRET}`)
    return new Response(null, { status: 401 });
  revalidatePath("/", "layout");
  return Response.json({ revalidated: true });
}
