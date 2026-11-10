import type { Continent, DistanceBand, Place, Trip } from "@/lib/types";

/**
 * Country fallback source note: the aliases below are a deliberately small,
 * curated subset of the United Nations M49 Standard Country or Area Codes for
 * Statistical Use (https://unstats.un.org/unsd/methodology/m49/), checked
 * 2026-11-10. They supplement explicit user-selected continents and are not a
 * comprehensive geopolitical dataset.
 */
export const COUNTRY_CONTINENT_SOURCE_NOTE =
  "Limited country-to-continent fallback: curated from the UN M49 statistical regions (checked 2026-11-10).";

const countryAliasesByContinent: Record<Continent, readonly string[]> = {
  africa: [
    "algeria", "botswana", "egypt", "ethiopia", "kenya", "madagascar", "mauritius", "morocco", "namibia", "nigeria",
    "rwanda", "seychelles", "south africa", "tanzania", "tunisia", "uganda", "zambia", "zimbabwe",
  ],
  antarctica: ["antarctica"],
  asia: [
    "bangladesh", "brunei", "cambodia", "china", "hong kong", "india", "indonesia", "japan", "laos", "macau", "macao",
    "malaysia", "maldives", "mongolia", "nepal", "philippines", "singapore", "south korea", "korea", "sri lanka", "taiwan",
    "thailand", "united arab emirates", "uae", "vietnam", "viet nam", "台灣", "臺灣", "日本", "中國", "香港", "澳門", "南韓", "韓國", "新加坡", "泰國", "越南", "馬來西亞", "菲律賓", "印度",
  ],
  europe: [
    "austria", "belgium", "bulgaria", "croatia", "czechia", "czech republic", "denmark", "estonia", "finland", "france",
    "germany", "greece", "hungary", "iceland", "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands",
    "norway", "poland", "portugal", "romania", "slovakia", "slovenia", "spain", "sweden", "switzerland", "united kingdom", "uk",
    "england", "scotland", "wales", "英國", "法國", "德國", "義大利", "西班牙", "荷蘭", "瑞士", "瑞典", "挪威", "丹麥", "芬蘭", "愛爾蘭",
  ],
  north_america: [
    "canada", "costa rica", "mexico", "panama", "united states", "united states of america", "usa", "us", "canada", "美國", "加拿大", "墨西哥",
  ],
  oceania: [
    "australia", "fiji", "new zealand", "papua new guinea", "samoa", "solomon islands", "tonga", "vanuatu", "澳洲", "紐西蘭", "新西蘭",
  ],
  south_america: [
    "argentina", "bolivia", "brazil", "chile", "colombia", "ecuador", "peru", "uruguay", "venezuela", "阿根廷", "巴西", "智利", "哥倫比亞", "秘魯",
  ],
};

const continentByCountry = new Map<string, Continent>(
  (Object.entries(countryAliasesByContinent) as Array<[Continent, readonly string[]]>).flatMap(([continent, countries]) =>
    countries.map((country) => [normalizeCountry(country), continent] as const),
  ),
);

function normalizeCountry(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns a saved explicit continent where available, then only falls back to
 * the small country list above. An unknown country deliberately stays unknown
 * rather than being guessed from a coordinate or an ambiguous name.
 */
export function getPlaceContinent(place: Pick<Place, "continent" | "country">): Continent | undefined {
  return place.continent ?? continentByCountry.get(normalizeCountry(place.country));
}

/** Returns all known endpoint continents for a journey, without duplicates. */
export function getTripContinents(trip: Pick<Trip, "origin" | "destination">): Continent[] {
  return [...new Set([getPlaceContinent(trip.origin), getPlaceContinent(trip.destination)].filter((continent): continent is Continent => Boolean(continent)))];
}

/**
 * Journey-distance bands are based on recorded route distance in kilometres:
 * short < 800, medium 800–3,499.9, and long >= 3,500.
 */
export function getTripDistanceBand(trip: Pick<Trip, "distance_km">): DistanceBand {
  if (trip.distance_km < 800) return "short";
  if (trip.distance_km < 3500) return "medium";
  return "long";
}

