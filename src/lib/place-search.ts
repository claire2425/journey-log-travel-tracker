import type { Place } from "@/lib/types";

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function searchableValues(place: Place): string[] {
  return [
    place.code,
    place.name_zh,
    place.name_en,
    place.city ?? "",
    place.country,
  ].map(normalize);
}

/**
 * Finds locally known places for the journey form. The caller supplies an
 * already mode-filtered list, so flights can expose airports and rail can
 * expose stations without sending the typed route to an external service.
 */
export function searchPlaces(places: readonly Place[], query: string, limit = 8): Place[] {
  const needle = normalize(query);
  if (!needle) return [];

  const exactCodeMatches = places.filter((place) => normalize(place.code) === needle);
  if (exactCodeMatches.length) return exactCodeMatches.slice(0, limit);

  return places
    .map((place, index) => ({ place, index, score: placeScore(place, needle) }))
    .filter((candidate): candidate is { place: Place; index: number; score: number } => candidate.score !== undefined)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      const codeOrder = left.place.code.localeCompare(right.place.code, "en");
      return codeOrder || left.index - right.index;
    })
    .slice(0, limit)
    .map((candidate) => candidate.place);
}

function placeScore(place: Place, needle: string): number | undefined {
  const [code, nameZh, nameEn, city, country] = searchableValues(place);
  if (code.startsWith(needle)) return 1;
  if ([nameZh, nameEn, city].some((value) => value.startsWith(needle))) return 2;
  if (country.startsWith(needle)) return 3;
  if ([code, nameZh, nameEn, city, country].some((value) => value.includes(needle))) return 4;
  return undefined;
}
