// Two alliances face to face (docs/features/analyse-alliances.md): read by the alliance page's « Face-à-face avec… »
// field, so that the page itself stays static. Public data, from the last hourly reading.
import { faceOff } from "@optizzz/game/analysis/face-off";
import { serverById } from "@optizzz/game/servers";
import { faceOffMembers } from "~/server/queries";

export async function GET(request: Request, { params }: { params: Promise<{ server: string; tag: string }> }) {
  const { server: id, tag } = await params;
  const server = serverById(id);
  const other = new URL(request.url).searchParams.get("with")?.trim();
  if (!server || !other) return Response.json({ error: "Alliance manquante" }, { status: 400 });
  const { ours, theirs } = await faceOffMembers(server.id, decodeURIComponent(tag), other);
  if (ours.length === 0)
    return Response.json({ error: `Aucune alliance « ${other} » sur ${server.name}` }, { status: 404 });
  return Response.json(faceOff(ours, theirs), {
    // The cron writes the readings once an hour.
    headers: { "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=3600" },
  });
}
