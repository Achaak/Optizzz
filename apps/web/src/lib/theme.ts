"use client";

import { useSyncExternalStore } from "react";

/** The visitor's choice, in their browser only: the system's scheme, or one forced. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

const STORAGE_KEY = "optizzz-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Run in <head> before the first paint (src/app/layout.tsx), so a dark page never flashes white. Kept in step with
 * `applyTheme` by hand: it is a string, not this module.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,p;try{p=localStorage.getItem("${STORAGE_KEY}")}catch(e){}d.dataset.theme=p==="dark"||(p!=="light"&&matchMedia("${DARK_QUERY}").matches)?"dark":"light"})()`;

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

const listeners = new Set<() => void>();

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Private browsing: the choice holds until the page is left.
  }
  applyTheme(preference);
  for (const listener of listeners) listener();
}

function subscribePreference(onChange: () => void) {
  listeners.add(onChange);
  const query = window.matchMedia(DARK_QUERY);
  const onSystem = () => {
    if (readPreference() === "system") applyTheme("system");
  };
  query.addEventListener("change", onSystem);
  return () => {
    listeners.delete(onChange);
    query.removeEventListener("change", onSystem);
  };
}

/** The visitor's choice, « system » while the page is built on the server. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribePreference, readPreference, () => "system");
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Whether the page is dark right now, for what draws on a canvas (the map). */
export function useDarkTheme(): boolean {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
}
