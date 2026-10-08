// Game pages read in the background (Ressources.php, construction.php…), shared by the features of a page view:
// several features asking for the same page within a few seconds share one request.

/** A page read longer ago than this is read again. */
const SHARED_MS = 15_000;

const pages = new Map<string, { at: number; page: Promise<Document | null> }>();

/** The page at `url` (session cookie included), parsed; null when the game answers with an error status. */
export function fetchGamePage(
  url: string,
  fetchFn: (url: string) => Promise<Response> = fetch,
): Promise<Document | null> {
  const now = Date.now();
  const known = pages.get(url);
  if (known && now - known.at < SHARED_MS) return known.page;
  const page = fetchFn(url).then(async (response) =>
    response.ok ? new DOMParser().parseFromString(await response.text(), "text/html") : null,
  );
  pages.set(url, { at: now, page });
  // A failed request is not shared: the next feature tries again.
  page.catch(() => pages.delete(url));
  return page;
}

/** For tests: every page is read again. */
export function forgetGamePages(): void {
  pages.clear();
}
