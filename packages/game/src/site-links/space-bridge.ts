// What a page of an Alliance Space on optizzz.fr and the extension's script on it agree on (docs/features/site-comptes-
// espaces.md, « Espaces d'alliance : réalisation (ticket 17) » and « (ticket 18) »). « Donner l'accès », and the
// departure alerts of an Admin's or Délégué's page, ask the linked extension for its last list of the game's Members
// page, by `window.postMessage` within the page: the list goes from the extension to the page open in the same
// browser, never to the site's server. No token ever crosses.

/** The pages of the Alliance Spaces, where the extension's script runs (once optizzz.fr is granted). */
export const SPACES_PATH = "/spaces";

/** Set on <html> by the extension's script once it listens: the page knows at once that the extension is there. */
export const SPACE_BRIDGE_ATTRIBUTE = "data-optizzz-space";

export const MEMBERS_REQUEST = "optizzz:members-request";
export const MEMBERS_REPLY = "optizzz:members-reply";

export interface MembersRequest {
  type: typeof MEMBERS_REQUEST;
  /** To match the reply. */
  id: string;
  /** « s5 ». */
  server: string;
}

/** The last list of the Members page the extension kept for a server, with its date (milliseconds since 1970). */
export interface MembersList {
  tag: string | null;
  pseudos: string[];
  readAt: number;
}

export type MembersAnswer = { status: "unlinked" } | { status: "linked"; members: MembersList | null };

export interface MembersReply {
  type: typeof MEMBERS_REPLY;
  id: string;
  answer: MembersAnswer;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

export function isMembersRequest(value: unknown): value is MembersRequest {
  const m = record(value);
  return (
    m?.type === MEMBERS_REQUEST &&
    typeof m.id === "string" &&
    m.id.length > 0 &&
    m.id.length <= 64 &&
    typeof m.server === "string" &&
    /^s\d{1,2}$/.test(m.server)
  );
}

export function isMembersList(value: unknown): value is MembersList {
  const m = record(value);
  return (
    m !== null &&
    (m.tag === null || typeof m.tag === "string") &&
    Array.isArray(m.pseudos) &&
    m.pseudos.every((p) => typeof p === "string") &&
    typeof m.readAt === "number" &&
    Number.isFinite(m.readAt)
  );
}

export function isMembersAnswer(value: unknown): value is MembersAnswer {
  const m = record(value);
  if (m?.status === "unlinked") return true;
  return m?.status === "linked" && (m.members === null || isMembersList(m.members));
}

export function isMembersReply(value: unknown): value is MembersReply {
  const m = record(value);
  return m?.type === MEMBERS_REPLY && typeof m.id === "string" && isMembersAnswer(m.answer);
}
