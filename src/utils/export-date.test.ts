import { expect, it } from "vitest";
import { formatExportVersion } from "@/utils/export-date";

it("shows the export version in Paris time", () => {
  expect(formatExportVersion("202610062200")).toBe("07/10 à 0 h 00"); // summer time
  expect(formatExportVersion("202601142300")).toBe("15/01 à 0 h 00"); // winter time
});
