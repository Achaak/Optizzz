import "server-only";

import { db } from "~/server/db";
import { extensionStore } from "~/server/extension/store";
import { envoiService } from "./envoi-service";
import { prismaEnvoiStore } from "./prisma-store";

/** The Envois' rules on the site's database. */
export const envois = envoiService(prismaEnvoiStore(db));

/** What the extension's routes need: the token's account, and the rules. */
export const envoiRoutes = { tokens: extensionStore, service: envois };
