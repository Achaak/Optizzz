import { describe, expect, it } from "vitest";
import { bugReportUrl, featureRequestUrl, REPOSITORY_URL } from "./links";

describe("issue links", () => {
  it("opens the bug form with the version and browser filled in", () => {
    const url = new URL(bugReportUrl("1.2.3", "Firefox/142"));
    expect(`${url.origin}${url.pathname}`).toBe(`${REPOSITORY_URL}/issues/new`);
    expect(url.searchParams.get("template")).toBe("bug.yml");
    expect(url.searchParams.get("version")).toBe("1.2.3");
    expect(url.searchParams.get("browser")).toBe("Firefox/142");
  });

  it("opens the feature request form", () => {
    const url = new URL(featureRequestUrl());
    expect(url.searchParams.get("template")).toBe("feature.yml");
  });
});
