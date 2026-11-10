import type { Place } from "@/lib/types";

export type SearchablePlace = Place & {
  aliases?: readonly string[];
  /** Prioritizes records such as scheduled passenger airports on score ties. */
  scheduled_service?: boolean;
};

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

function searchableValues(place: SearchablePlace): string[] {
  return [
    place.code,
    place.name_zh,
    place.name_en,
    place.city ?? "",
    place.country,
    ...(place.aliases ?? []),
  ].map(normalize);
}

/**
 * Finds locally known places for the journey form. The caller supplies an
 * already mode-filtered list, so flights can expose airports and rail can
 * expose stations without sending the typed route to an external service.
 */
export function searchPlaces<T extends SearchablePlace>(places: readonly T[], query: string, limit = 8): T[] {
  const needle = normalize(query);
  if (!needle) return [];

  const exactCodeMatches = places.filter((place) => normalize(place.code) === needle);
  if (exactCodeMatches.length) return exactCodeMatches.slice(0, limit);

  return places
    .map((place, index) => ({ place, index, score: placeScore(place, needle) }))
    .filter((candidate): candidate is { place: T; index: number; score: number } => candidate.score !== undefined)
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score;
      if (left.place.scheduled_service !== right.place.scheduled_service) {
        return Number(right.place.scheduled_service) - Number(left.place.scheduled_service);
      }
      const codeOrder = left.place.code.localeCompare(right.place.code, "en");
      return codeOrder || left.index - right.index;
    })
    .slice(0, limit)
    .map((candidate) => candidate.place);
}

function placeScore(place: SearchablePlace, needle: string): number | undefined {
  const [code, nameZh, nameEn, city, country] = searchableValues(place);
  const aliases = (place.aliases ?? []).map(normalize);
  if (aliases.includes(needle)) return 0;
  if ([code, ...aliases].some((value) => value.startsWith(needle))) return 1;
  if ([nameZh, nameEn, city].some((value) => value.startsWith(needle))) return 2;
  if (country.startsWith(needle)) return 3;
  if ([code, nameZh, nameEn, city, country].some((value) => value.includes(needle))) return 4;
  return undefined;
}
