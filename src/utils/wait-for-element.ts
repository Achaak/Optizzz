/**
 * Resolves with the first element matching `selector`, waiting for it to be inserted
 * (the game fills some pages over AJAX after load), or with null after `timeoutMs`.
 */
export function waitForElement<E extends Element = Element>(
  selector: string,
  timeoutMs: number,
  root: ParentNode & Node = document,
): Promise<E | null> {
  const existing = root.querySelector<E>(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const element = root.querySelector<E>(selector);
      if (element) finish(element);
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    function finish(element: E | null) {
      observer.disconnect();
      clearTimeout(timer);
      resolve(element);
    }
    observer.observe(root, { childList: true, subtree: true });
  });
}
