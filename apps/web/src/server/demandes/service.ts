import "server-only";

import { db } from "~/server/db";
import { extensionStore } from "~/server/extension/store";
import { remindLater } from "~/server/reminders/service";
import { demandeService } from "./demande-service";
import { prismaDemandeStore } from "./prisma-store";

/** The Demandes' rules on the site's database. */
export const demandes = demandeService(prismaDemandeStore(db), undefined, remindLater);

/** What the extension's routes need: the token's account, and the rules. */
export const demandeRoutes = { tokens: extensionStore, service: demandes };
