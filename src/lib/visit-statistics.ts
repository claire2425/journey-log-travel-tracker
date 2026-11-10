import { getPlaceContinent } from "@/lib/geography";
import { getJourneyDepartureLocalYear } from "@/lib/journey-date";
import type { Place, Trip } from "@/lib/types";

export type AnnualVisitStatistics = {
  year: number;
  continents: number;
  countries: number;
  cities: number;
};

type VisitSets = {
  continents: Set<string>;
  countries: Set<string>;
  cities: Set<string>;
};

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function cityKey(place: Place): string {
  // A city is optional because an endpoint can be an airport or a station.
  // Existing records without it remain useful by falling back to the endpoint.
  const cityOrPlace = place.city ?? place.name_en;
  return `${normalise(place.country)}\u0000${normalise(cityOrPlace)}`;
}

function addPlace(sets: VisitSets, place: Place) {
  const continent = getPlaceContinent(place);
  if (continent) sets.continents.add(continent);
  sets.countries.add(normalise(place.country));
  sets.cities.add(cityKey(place));
}

/**
 * Counts unique continents, countries/regions, and cities/places for each
 * origin-local departure year. Both endpoints count as visited that year.
 */
export function calculateAnnualVisitStatistics(trips: Trip[]): AnnualVisitStatistics[] {
  const byYear = new Map<number, VisitSets>();

  for (const trip of trips) {
    const year = getJourneyDepartureLocalYear(trip);
    const sets = byYear.get(year) ?? { continents: new Set(), countries: new Set(), cities: new Set() };
    addPlace(sets, trip.origin);
    addPlace(sets, trip.destination);
    byYear.set(year, sets);
  }

  return [...byYear.entries()]
    .map(([year, sets]) => ({
      year,
      continents: sets.continents.size,
      countries: sets.countries.size,
      cities: sets.cities.size,
    }))
    .sort((left, right) => right.year - left.year);
}
