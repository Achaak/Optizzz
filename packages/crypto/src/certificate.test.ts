import { describe, expect, it } from "vitest";
import { openCertificate, signCertificate, type CertificateKind } from "./certificate";
import { fromBase64Url, toBase64Url } from "./encoding";
import { CryptoError } from "./errors";
import { generateKeyPair } from "./personal-key";

async function errorCode(promise: Promise<unknown>) {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CryptoError);
  return (error as CryptoError).code;
}

const SPACE = "space-s5-ad2";
const KINDS: CertificateKind[] = ["member", "admin", "admin-revocation", "exclusion"];

// [format 1][kind 1][issued at u64][issuer 32][subject 32][signature 64]
const KIND_OFFSET = 1;
const ISSUED_AT_OFFSET = 2;
const ISSUER_OFFSET = 10;
const SUBJECT_OFFSET = 42;

function withByte(blob: string, offset: number, change: (byte: number) => number): string {
  const bytes = fromBase64Url(blob);
  bytes[offset] = change(bytes[offset] ?? 0);
  return toBase64Url(bytes);
}

describe("certificates and revocations", () => {
  it.each(KINDS)("signs and opens a %s", async (kind) => {
    const admin = await generateKeyPair();
    const subject = await generateKeyPair();
    const blob = await signCertificate({
      kind,
      spaceId: SPACE,
      subject: subject.publicKey,
      admin,
      issuedAt: 1_761_400_000_000,
    });
    expect(await openCertificate(blob, SPACE)).toEqual({
      kind,
      issuer: admin.publicKey,
      subject: subject.publicKey,
      issuedAt: 1_761_400_000_000,
    });
  });

  it("is dated now by default", async () => {
    const admin = await generateKeyPair();
    const subject = await generateKeyPair();
    const before = Date.now();
    const blob = await signCertificate({ kind: "member", spaceId: SPACE, subject: subject.publicKey, admin });
    const { issuedAt } = await openCertificate(blob, SPACE);
    expect(issuedAt).toBeGreaterThanOrEqual(before);
    expect(issuedAt).toBeLessThanOrEqual(Date.now());
  });

  it("is refused in another space", async () => {
    const admin = await generateKeyPair();
    const subject = await generateKeyPair();
    const blob = await signCertificate({ kind: "admin", spaceId: SPACE, subject: subject.publicKey, admin });
    expect(await errorCode(openCertificate(blob, "space-s2-ad2"))).toBe("bad-certificate");
  });

  it("is refused for another key, another kind, another date or another signer", async () => {
    const admin = await generateKeyPair();
    const subject = await generateKeyPair();
    const other = await generateKeyPair();
    const blob = await signCertificate({ kind: "member", spaceId: SPACE, subject: subject.publicKey, admin });

    const forOther = fromBase64Url(blob);
    forOther.set(fromBase64Url(other.publicKey), SUBJECT_OFFSET);
    expect(await errorCode(openCertificate(toBase64Url(forOther), SPACE))).toBe("bad-certificate");

    // A member certificate turned into an Admin one, or an exclusion turned into a membership.
    expect(
      await errorCode(
        openCertificate(
          withByte(blob, KIND_OFFSET, () => 2),
          SPACE,
        ),
      ),
    ).toBe("bad-certificate");
    expect(
      await errorCode(
        openCertificate(
          withByte(blob, ISSUED_AT_OFFSET + 7, (b) => b ^ 1),
          SPACE,
        ),
      ),
    ).toBe("bad-certificate");

    const otherSigner = fromBase64Url(blob);
    otherSigner.set(fromBase64Url(other.publicKey), ISSUER_OFFSET);
    expect(await errorCode(openCertificate(toBase64Url(otherSigner), SPACE))).toBe("bad-certificate");
  });

  it("refuses a forged signature", async () => {
    const admin = await generateKeyPair();
    const subject = await generateKeyPair();
    const blob = await signCertificate({ kind: "exclusion", spaceId: SPACE, subject: subject.publicKey, admin });
    expect(
      await errorCode(
        openCertificate(
          withByte(blob, 137, (b) => b ^ 1),
          SPACE,
        ),
      ),
    ).toBe("bad-certificate");
  });

  it("refuses a certificate one signs for oneself", async () => {
    const admin = await generateKeyPair();
    expect(await errorCode(signCertificate({ kind: "admin", spaceId: SPACE, subject: admin.publicKey, admin }))).toBe(
      "malformed",
    );
  });

  it("refuses a truncated blob, an unknown kind and a newer format", async () => {
    const admin = await generateKeyPair();
    const subject = await generateKeyPair();
    const blob = await signCertificate({ kind: "member", spaceId: SPACE, subject: subject.publicKey, admin });
    expect(await errorCode(openCertificate(toBase64Url(fromBase64Url(blob).subarray(0, 100)), SPACE))).toBe(
      "malformed",
    );
    expect(
      await errorCode(
        openCertificate(
          withByte(blob, KIND_OFFSET, () => 9),
          SPACE,
        ),
      ),
    ).toBe("malformed");
    expect(
      await errorCode(
        openCertificate(
          withByte(blob, 0, () => 2),
          SPACE,
        ),
      ),
    ).toBe("unsupported-format");
  });

  it("refuses an empty space, a bad date or a bad subject when signing", async () => {
    const admin = await generateKeyPair();
    const subject = await generateKeyPair();
    const base = { kind: "member" as const, subject: subject.publicKey, admin };
    expect(await errorCode(signCertificate({ ...base, spaceId: "" }))).toBe("malformed");
    expect(await errorCode(signCertificate({ ...base, spaceId: SPACE, issuedAt: -1 }))).toBe("malformed");
    expect(await errorCode(signCertificate({ ...base, spaceId: SPACE, issuedAt: 1.5 }))).toBe("malformed");
    expect(await errorCode(signCertificate({ ...base, spaceId: SPACE, subject: "AAAA" }))).toBe("malformed");
  });
});
