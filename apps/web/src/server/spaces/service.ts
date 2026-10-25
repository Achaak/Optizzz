import "server-only";

import { db } from "~/server/db";
import { prismaSpaceStore } from "./prisma-store";
import { spaceService } from "./space-service";

/** The Alliance Spaces' rules on the site's database. */
export const spaces = spaceService(prismaSpaceStore(db));
