export const REPOSITORY_URL = "https://github.com/Achaak/Optizzz";

/**
 * Link to a new GitHub issue from a form in `.github/ISSUE_TEMPLATE/`, with some of its fields
 * pre-filled (keys are the fields' `id`).
 */
export function newIssueUrl(template: string, fields: Record<string, string> = {}): string {
  const params = new URLSearchParams({ template, ...fields });
  return `${REPOSITORY_URL}/issues/new?${params.toString()}`;
}

export function bugReportUrl(version: string, userAgent: string): string {
  return newIssueUrl("bug.yml", { version, browser: userAgent });
}

export function featureRequestUrl(): string {
  return newIssueUrl("feature.yml");
}
