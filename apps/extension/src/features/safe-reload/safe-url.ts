/**
 * The address to keep in the history so that reloading the page cannot replay an action. Action links
 * carry a token `t` (`construction.php?annuler=3&t=…`): their whole query goes, the page stays.
 */
export function safeUrl(url: URL): string {
  const search = url.searchParams.has("t") ? "" : url.search;
  return `${url.pathname}${search}${url.hash}`;
}
