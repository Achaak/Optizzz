import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Settings of a view, stored per server: null until read, then each `update` is saved. The write happens in an
 * effect, not in the state updater, which React may call twice.
 */
export function useStoredSettings<T>(
  host: string,
  read: (host: string) => Promise<T>,
  write: (host: string, settings: T) => Promise<void>,
): [T | null, (update: (current: T) => T) => void] {
  const [settings, setSettings] = useState<T | null>(null);
  const changed = useRef(false);

  useEffect(() => {
    void read(host).then(setSettings);
  }, [host, read]);

  useEffect(() => {
    if (!changed.current || settings === null) return;
    changed.current = false;
    write(host, settings).catch((error: unknown) => {
      console.error("[Optizzz] saving settings failed", error);
    });
  }, [host, write, settings]);

  const update = useCallback((change: (current: T) => T) => {
    setSettings((current) => {
      if (current === null) return current;
      changed.current = true;
      return change(current);
    });
  }, []);

  return [settings, update];
}
