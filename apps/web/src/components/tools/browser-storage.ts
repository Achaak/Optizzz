// The browser's localStorage, which can refuse (private browsing, storage blocked): the tools then work without it.

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Refused: the address still holds the tool's state.
  }
}
