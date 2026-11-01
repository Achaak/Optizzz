// The space's roles for a React view (the chain, the map): see ./site-roles-source.ts.
import { useEffect, useState } from "react";
import type { ChainRolesAnswer } from "@/features/optizzz-account/envois";
import { followSiteChainRoles } from "./site-roles-source";

/** The background's answer: undefined while it is asked, null when it does not answer (no Compte Optizzz). */
export function useSiteChainRoles(origin: string): ChainRolesAnswer | null | undefined {
  const [answer, setAnswer] = useState<ChainRolesAnswer | null | undefined>(undefined);
  useEffect(() => followSiteChainRoles(origin, setAnswer), [origin]);
  return answer;
}
