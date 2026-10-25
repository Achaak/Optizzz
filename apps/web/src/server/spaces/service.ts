import "server-only";

import { db } from "~/server/db";
import { prismaSpaceStore } from "./prisma-store";
import { spaceService } from "./space-service";

const store = prismaSpaceStore(db);

/** The Alliance Spaces' rules on the site's database. */
export const spaces = spaceService(store);

/** What an invitation link shows before signing in: the space's name, tag, Admins and size. */
export const invitationSummary = (spaceId: string) =>
  /^[0-9a-f-]{36}$/.test(spaceId) ? store.spaceSummary(spaceId) : Promise.resolve(null);
