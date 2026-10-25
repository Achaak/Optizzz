import { TRPCClientError } from "@trpc/client";
import { CryptoError } from "@optizzz/crypto/errors";
import { describeProblem } from "~/lib/spaces/problems";

/** What to tell the person after a failed step: the site's French message, or the cryptographic step's, reworded. */
export function errorText(error: unknown): string {
  if (error instanceof TRPCClientError && typeof error.message === "string" && error.message) return error.message;
  if (error instanceof CryptoError) return describeProblem(error);
  return "Cela n'a pas abouti. Réessayez ; si cela se reproduit, prévenez-nous.";
}
