"use client";

import type { MapPalette } from "@optizzz/map/palette";
import { useSyncExternalStore } from "react";

// ECharts draws on a canvas: one palette per colour scheme. Checked by simulating protanopia and deuteranopia
// (docs/adr/0003-daltonisme.md, 2026-10-22): two neighbouring colours, and the first three together, stay at least
// 10 apart (OKLab ×100, aim 8), and away from the background.

const LIGHT: MapPalette = {
  text: "#171717",
  holiday: "#a3a3a3",
  background: "rgba(64, 64, 64, 0.18)",
  selected: "#5b3a1e",
  halo: "#ffffff",
  chips: ["#0a5fa8", "#b88600", "#7d4800", "#2b86c4", "#b35900", "#5a3a9e", "#00785a", "#2e2e2e"],
  allies: ["#0a5fa8", "#9cc9ef", "#102a55", "#5aa9e6"],
  enemies: ["#c5130f", "#f5b090", "#5a1003", "#f07a40"],
};

const DARK: MapPalette = {
  text: "#ededed",
  holiday: "#6b6b6b",
  background: "rgba(220, 220, 220, 0.16)",
  selected: "#e0b080",
  halo: "#0a0a0a",
  chips: ["#5aa9e6", "#e0b030", "#c46a2a", "#8cd0f5", "#f08a3c", "#a990ea", "#3cc49a", "#e0e0e0"],
  allies: ["#5aa9e6", "#d6e8fa", "#2f6fb8", "#9cc9ef"],
  enemies: ["#ff5a4f", "#ffd6c0", "#a82808", "#ffa070"],
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** The map's palette for the system's colour scheme, following it when it changes. */
export function useMapPalette(): MapPalette {
  const dark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
  return dark ? DARK : LIGHT;
}
