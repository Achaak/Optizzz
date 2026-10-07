import { describe, expect, it } from "vitest";
import { bugReportUrl, featureRequestUrl, REPOSITORY_URL } from "./links";

describe("issue links", () => {
  it("labels a bug report and includes the version and browser", () => {
    const url = new URL(bugReportUrl("1.2.3", "Firefox/142"));
    expect(`${url.origin}${url.pathname}`).toBe(`${REPOSITORY_URL}/issues/new`);
    expect(url.searchParams.get("labels")).toBe("bug");
    expect(url.searchParams.get("body")).toContain("Optizzz 1.2.3 — Firefox/142");
  });

  it("labels a feature request", () => {
    const url = new URL(featureRequestUrl());
    expect(url.searchParams.get("labels")).toBe("enhancement");
  });
});
