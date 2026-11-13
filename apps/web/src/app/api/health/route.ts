// One row of each schema the site reads with its own role: the servers' data (public) and the accounts.
import { db } from "~/server/db";
import { health } from "~/server/health";

export const dynamic = "force-dynamic";

export const GET = () =>
  health([
    () => db.exportRead.findFirst({ select: { server: true } }),
    () => db.user.findFirst({ select: { id: true } }),
  ]);
