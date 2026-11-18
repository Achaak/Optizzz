import "server-only";
import { type CountedPage, isRobot, parisDay } from "~/lib/page-views";
import { db } from "~/server/db";

// The page views counter (docs/features/site-audience.md): adds one to a page's count of the day. One statement, so two
// views at once never lose one.

/** Counts one view of `page`, unless the request comes from a robot. A failed write is only logged. */
export async function countView({ page, server }: CountedPage, userAgent: string | null, now = new Date()) {
  if (isRobot(userAgent)) return;
  try {
    await db.$executeRaw`
      INSERT INTO "accounts"."PageView" ("day", "page", "server", "views") VALUES (${parisDay(now)}, ${page}, ${server}, 1)
      ON CONFLICT ("day", "page", "server") DO UPDATE SET "views" = "PageView"."views" + 1`;
  } catch (error) {
    console.error("page view not counted", error);
  }
}
