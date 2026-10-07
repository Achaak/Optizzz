// Builds DOM from static markup without assigning innerHTML, which store reviewers (AMO) flag.
// Only for markup written in our code: never pass game or player data in, use textContent for that.

/** The single root element of a static HTML template, owned by `doc`; it must be a `tag`. */
export function htmlElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  html: string,
): HTMLElementTagNameMap[K] {
  const root = new DOMParser().parseFromString(html.trim(), "text/html").body.firstElementChild;
  if (root?.localName !== tag) throw new Error(`htmlElement: the template's root is not a <${tag}>`);
  return doc.importNode(root, true) as HTMLElementTagNameMap[K];
}

/** An SVG element from static markup, owned by `doc`. */
export function svgElement(doc: Document, svg: string): SVGSVGElement {
  const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  return doc.importNode(root, true) as unknown as SVGSVGElement;
}
