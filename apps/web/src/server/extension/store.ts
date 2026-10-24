import "server-only";

import { db } from "~/server/db";
import { prismaExtensionStore } from "~/server/extension/prisma-store";

/** The extension API's store on the site's database. */
export const extensionStore = prismaExtensionStore(db);
