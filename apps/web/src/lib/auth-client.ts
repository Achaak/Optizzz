"use client";

// The browser side of Better Auth (src/server/auth.ts): the same origin, under /api/auth.
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
