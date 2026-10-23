import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineLinkFormat, earlierFormat, readLinkState } from "./link-state";

const base64Url = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** A tool whose state is its short keys. */
const plain = defineLinkFormat({ version: 1, schema: z.object({ n: z.string(), l: z.number().int().min(0) }) });

/** A tool with long names in its state and short keys in the address. */
interface Trip {
  attackSpeed: number;
  server: string | null;
}
const trip = defineLinkFormat({
  version: 1,
  schema: z.object({ v: z.number().int().min(0).max(100), s: z.string().nullable() }),
  toWire: (state: Trip) => ({ v: state.attackSpeed, s: state.server }),
  fromWire: (wire): Trip => ({ attackSpeed: wire.v, server: wire.s }),
});

describe("tool state in the address", () => {
  it("round-trips a state, accents included, as a version then base64url", () => {
    const text = plain.encode({ n: "Étable à pucerons", l: 12 });
    expect(text).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(plain.decode(text)).toEqual({ n: "Étable à pucerons", l: 12 });
  });

  it("keeps short keys in the address and gives back the tool's own state", () => {
    const text = trip.encode({ attackSpeed: 7, server: "s5" });
    expect(text).toBe(`1.${base64Url({ v: 7, s: "s5" })}`);
    expect(trip.decode(text)).toEqual({ attackSpeed: 7, server: "s5" });
  });

  it("refuses a state without its version, or of an unknown one", () => {
    const body = plain.encode({ n: "a", l: 1 }).slice("1.".length);
    expect(plain.decode(body)).toBeNull();
    expect(plain.decode(`2.${body}`)).toBeNull();
    expect(plain.decode(`x.${body}`)).toBeNull();
  });

  it("refuses a cut, hand-edited or invalid state", () => {
    expect(plain.decode("1.not-base64!")).toBeNull();
    expect(plain.decode(plain.encode({ n: "abcdefghij", l: 1 }).slice(0, 12))).toBeNull();
    expect(plain.decode(`1.${base64Url({ n: "a", l: -1 })}`)).toBeNull();
    expect(plain.decode(`1.${base64Url("text")}`)).toBeNull();
    expect(plain.decode("")).toBeNull();
  });

  it("reads the earlier versions it declares, and writes only the current one", () => {
    const next = defineLinkFormat({
      version: 2,
      schema: z.object({ n: z.string(), l: z.number().int(), h: z.boolean() }),
      earlier: { 1: earlierFormat(z.object({ n: z.string(), l: z.number().int() }), (old) => ({ ...old, h: false })) },
    });
    const old = plain.encode({ n: "a", l: 3 });
    expect(next.decode(old)).toEqual({ n: "a", l: 3, h: false });
    expect(next.encode({ n: "a", l: 3, h: true })).toMatch(/^2\./);
    expect(next.decode(next.encode({ n: "a", l: 3, h: true }))).toEqual({ n: "a", l: 3, h: true });
    expect(next.decode(`1.${base64Url({ n: "a" })}`)).toBeNull();
    expect(next.decode(`3.${base64Url({ n: "a", l: 3, h: true })}`)).toBeNull();
  });
});

describe("what an address asks of a tool", () => {
  const at = (address: string) => readLinkState(new URL(address, "https://optizzz.fr"), plain);
  const state = { n: "a", l: 2 };

  it("reads a shared state from the fragment", () => {
    expect(at(`/tools/costs#p=${plain.encode(state)}`)).toEqual({ kind: "state", state });
  });

  it("says a broken link is not valid", () => {
    expect(at("/tools/costs#p=1.abc")).toEqual({ kind: "invalid" });
    expect(at(`/tools/costs#p=${plain.encode(state).replace("1.", "9.")}`)).toEqual({ kind: "invalid" });
  });

  it("asks for nothing without a state in the fragment, nor reads one from the query", () => {
    expect(at("/tools/costs")).toEqual({ kind: "none" });
    expect(at("/tools/costs#p=")).toEqual({ kind: "none" });
    expect(at(`/tools/costs?p=${plain.encode(state)}`)).toEqual({ kind: "none" });
  });
});
