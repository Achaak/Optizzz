"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

/** « Retirer » on /account: the extension's token stops working at once. Only one of the signed-in account's own. */
export async function removeExtension(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session || typeof id !== "string") return;
  await db.extensionToken.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/account");
}
