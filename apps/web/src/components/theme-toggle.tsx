"use client";

import { MoonIcon, SunIcon, SystemIcon } from "~/components/icons";
import { setThemePreference, THEME_PREFERENCES, useThemePreference, type ThemePreference } from "~/lib/theme";

const LABELS: Record<ThemePreference, string> = {
  system: "Thème du système",
  light: "Thème clair",
  dark: "Thème sombre",
};

const ICONS = { system: SystemIcon, light: SunIcon, dark: MoonIcon };

/** One button that goes round system → clair → sombre, remembered in this browser. */
export function ThemeToggle() {
  const preference = useThemePreference();
  const next = THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length] ?? "system";
  const Current = ICONS[preference];
  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`${LABELS[preference]} : passer au ${LABELS[next].toLowerCase()}`}
      title={LABELS[preference]}
      className="grid size-10 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Current />
    </button>
  );
}
