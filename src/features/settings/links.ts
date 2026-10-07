export const REPOSITORY_URL = "https://github.com/Achaak/Optizzz";

/** Link to a new GitHub issue, pre-filled with a label and a body template. */
export function newIssueUrl(label: string, body: string): string {
  const params = new URLSearchParams({ labels: label, body });
  return `${REPOSITORY_URL}/issues/new?${params.toString()}`;
}

export function bugReportUrl(version: string, userAgent: string): string {
  return newIssueUrl(
    "bug",
    [
      "**Ce qui se passe**",
      "",
      "**Ce qui devrait se passer**",
      "",
      "**Page du jeu concernée**",
      "",
      "---",
      `Optizzz ${version} — ${userAgent}`,
    ].join("\n"),
  );
}

export function featureRequestUrl(): string {
  return newIssueUrl(
    "enhancement",
    ["**Ce que la fonctionnalité ferait**", "", "**Pourquoi ce serait utile**", ""].join("\n"),
  );
}
