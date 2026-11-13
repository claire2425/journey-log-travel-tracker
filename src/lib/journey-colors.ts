import type { TripMode } from "@/lib/types";

/** Shared transport colours for map routes, legends, and journey cards. */
export const MODE_COLORS: Record<TripMode, string> = {
  flight: "#4a6f8f",
  rail: "#5e7f4e",
  cruise: "#b06f4e",
  other: "#7e6c9a",
};

const KNOWN_COUNTRY_COLORS: Record<string, string> = {
  taiwan: "#b85c68",
  japan: "#8268a0",
  "united kingdom": "#3d7a8a",
  france: "#7f8f3a",
};

function countryKey(country: string) {
  return country.trim().toLocaleLowerCase();
}

function colorHash(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const [red, green, blue] = hueSection < 1
    ? [chroma, secondary, 0]
    : hueSection < 2
      ? [secondary, chroma, 0]
      : hueSection < 3
        ? [0, chroma, secondary]
        : hueSection < 4
          ? [0, secondary, chroma]
          : hueSection < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const match = lightness - chroma / 2;
  const toHex = (component: number) => Math.round((component + match) * 255).toString(16).padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

export function modeColor(mode: TripMode) {
  return MODE_COLORS[mode];
}

/**
 * Gives each country a stable, display-only colour. Known demo countries use a
 * curated palette; all other country names receive a deterministic fallback.
 */
export function countryColor(country: string) {
  const key = countryKey(country);
  const knownColor = KNOWN_COUNTRY_COLORS[key];
  if (knownColor) return knownColor;

  const hash = colorHash(key || "unknown");
  // Muted, mid-dark tones to match the low-saturation palette while staying
  // distinguishable on maps and legible as small dots.
  return hslToHex(hash % 360, (32 + ((hash >>> 9) % 16)) / 100, (38 + ((hash >>> 15) % 10)) / 100);
}
