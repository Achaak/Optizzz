// The state of a site tool (and of the server map) kept in the fragment of its address, `#p=<version>.<base64url>`:
// shared as a link, never sent to the site's server. Shared by the site and the extension, which builds the links it
// opens. See docs/features/site-outils.md.
import type { z } from "zod";

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (text: string) =>
  new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)),
  );

/** A state written in an address and read back; `decode` gives null for what is not one of its states. */
export interface LinkFormat<State> {
  /** The version written: `1.` for a first format. */
  readonly version: number;
  encode: (state: State) => string;
  decode: (text: string) => State | null;
}

/** A version a format no longer writes but still reads, brought to the current state. */
export interface EarlierFormat<State> {
  read: (json: unknown) => State | null;
}

export function earlierFormat<Wire, State>(schema: z.ZodType<Wire>, upgrade: (wire: Wire) => State) {
  return {
    read: (json: unknown) => {
      const parsed = schema.safeParse(json);
      return parsed.success ? upgrade(parsed.data) : null;
    },
  } satisfies EarlierFormat<State>;
}

interface FormatSpec<Wire> {
  /** Raised when the state changes; the earlier versions go to `earlier`. */
  version: number;
  /** What the address holds, with short keys: a link must stay short (a full battle under 1,000 characters). */
  schema: z.ZodType<Wire>;
}

interface Earlier<State> {
  earlier?: Readonly<Record<number, EarlierFormat<State>>>;
}

/**
 * The format of a tool's state. Without `toWire` and `fromWire`, the state is what the address holds; with them, the
 * tool keeps its own names and the address its short keys.
 */
export function defineLinkFormat<State, Wire>(
  spec: FormatSpec<Wire> & Earlier<State> & { toWire: (state: State) => Wire; fromWire: (wire: Wire) => State },
): LinkFormat<State>;
export function defineLinkFormat<State>(spec: FormatSpec<State> & Earlier<State>): LinkFormat<State>;
export function defineLinkFormat<State, Wire>(
  spec: FormatSpec<Wire> & Earlier<State> & { toWire?: (state: State) => Wire; fromWire?: (wire: Wire) => State },
): LinkFormat<State> {
  // Without them, State and Wire are the same type (first overload).
  const toWire = spec.toWire ?? ((state: State) => state as unknown as Wire);
  const fromWire = spec.fromWire ?? ((wire: Wire) => wire as unknown as State);
  const current = earlierFormat(spec.schema, fromWire);
  return {
    version: spec.version,
    encode: (state) => `${String(spec.version)}.${toBase64Url(JSON.stringify(toWire(state)))}`,
    decode: (text) => {
      const match = /^(\d+)\.([A-Za-z0-9_-]*)$/.exec(text);
      if (!match?.[1] || match[2] === undefined) return null;
      const version = Number(match[1]);
      const format = version === spec.version ? current : spec.earlier?.[version];
      if (!format) return null;
      let json: unknown;
      try {
        json = JSON.parse(fromBase64Url(match[2]));
      } catch {
        return null;
      }
      return format.read(json);
    },
  };
}

/** What an address asks of a tool: a shared state, a link that cannot be read, or nothing. */
export type LinkRequest<State> = { kind: "state"; state: State } | { kind: "invalid" } | { kind: "none" };

/** The state in the fragment (`#p=`) of `address`; the query is never read (the old map links in `?p=` are not). */
export function readLinkState<State>(address: URL, format: LinkFormat<State>): LinkRequest<State> {
  const shared = new URLSearchParams(address.hash.slice(1)).get("p");
  if (!shared) return { kind: "none" };
  const state = format.decode(shared);
  return state === null ? { kind: "invalid" } : { kind: "state", state };
}

/** The fragment holding an encoded state. */
export const linkFragment = (encoded: string) => `#p=${encoded}`;
