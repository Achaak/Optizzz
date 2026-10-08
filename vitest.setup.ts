import { beforeEach } from "vitest";
import { forgetGamePages } from "@/utils/game-page";

// Pages read in the background are shared for a few seconds: each test reads its own.
beforeEach(() => {
  forgetGamePages();
});
