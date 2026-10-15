// A tooltip of our own for what Optizzz adds to the header boxes (#boiteInfo).

/**
 * The game's tooltip (jQuery UI, on the header cell) would take the element's `title` and lose its line breaks:
 * the element has its own, and keeps the game's from opening over it.
 */
export const HEADER_TIP_STYLE = `
[data-optizzz-tip] { position: relative; cursor: help; }
[data-optizzz-tip]:hover::after, [data-optizzz-tip]:focus::after {
  content: attr(data-optizzz-tip); position: absolute; left: 0; top: 100%; z-index: 1000; width: max-content;
  max-width: 340px; padding: 4px 6px; white-space: pre-line; text-align: left; font-weight: normal;
  color: var(--optizzz-text); background: var(--optizzz-surface-raised); border: 1px solid var(--optizzz-border); }`;

export function setHeaderTip(element: HTMLElement, text: string): void {
  element.dataset.optizzzTip = text;
  element.tabIndex = 0;
  for (const event of ["mouseover", "focusin"]) element.addEventListener(event, (e) => e.stopPropagation());
}
