import { db as defaultDb, type JourneyDatabase } from "@/db/index";
import { getDemoTrips } from "@/lib/demo-trips";
import { getJourneyDepartureLocalYear } from "@/lib/journey-date";
import { getPlaceContinent, getTripDistanceBand } from "@/lib/geography";
import { TripSchema, type Continent, type DistanceBand, type Trip, type TripMode, type TripPurposeFilter } from "@/lib/types";

export type TripFilters = {
  /** Legacy single-select mode filter. It is combined with `modes` when both are supplied. */
  mode?: TripMode;
  /** Legacy single-select year filter. It is combined with `years` when both are supplied. */
  year?: number;
  /** Multiple selected travel modes; matching any selected mode includes the trip. */
  modes?: TripMode[];
  /** Multiple selected departure years; matching any selected year includes the trip. */
  years?: number[];
  /** A trip matches when either endpoint belongs to a selected continent. */
  continents?: Continent[];
  /** Based on the recorded route distance: short <800, medium <3500, long >=3500 km. */
  distance_bands?: DistanceBand[];
  /** `unclassified` includes records created before a journey purpose was saved. */
  purposes?: TripPurposeFilter[];
  search?: string;
};

function normalizeTrip(input: Trip): Trip {
  return TripSchema.parse({
    ...input,
    carrier_code: input.carrier_code?.trim().toUpperCase(),
    carrier_logo_url: input.carrier_logo_url?.trim(),
  });
}

export async function addTrip(input: Trip, database: JourneyDatabase = defaultDb): Promise<string> {
  const trip = normalizeTrip(input);
  await database.trips.add(trip);
  return trip.id;
}

export async function updateTrip(input: Trip, database: JourneyDatabase = defaultDb): Promise<void> {
  const trip = normalizeTrip(input);
  const count = await database.trips.update(trip.id, trip);
  if (count === 0) throw new Error(`Trip not found: ${trip.id}`);
}

export async function deleteTrip(id: string, database: JourneyDatabase = defaultDb): Promise<void> {
  await database.trips.delete(id);
}

export async function getTrip(id: string, database: JourneyDatabase = defaultDb): Promise<Trip | undefined> {
  const trip = await database.trips.get(id);
  return trip ? normalizeTrip(trip) : undefined;
}

export async function listTrips(filters: TripFilters = {}, database: JourneyDatabase = defaultDb): Promise<Trip[]> {
  const trips = (await database.trips.orderBy("departure").reverse().toArray()).map((trip) => normalizeTrip(trip));
  const needle = filters.search?.trim().toLocaleLowerCase();
  const selectedModes = new Set([filters.mode, ...(filters.modes ?? [])].filter((mode): mode is TripMode => Boolean(mode)));
  const selectedYears = new Set([filters.year, ...(filters.years ?? [])].filter((year): year is number => typeof year === "number"));
  const selectedContinents = new Set(filters.continents ?? []);
  const selectedDistanceBands = new Set(filters.distance_bands ?? []);
  const selectedPurposes = new Set(filters.purposes ?? []);

  return trips.filter((trip) => {
    if (selectedModes.size > 0 && !selectedModes.has(trip.mode)) return false;
    if (selectedYears.size > 0 && !selectedYears.has(getJourneyDepartureLocalYear(trip))) return false;
    if (selectedContinents.size > 0) {
      const endpointContinents = [getPlaceContinent(trip.origin), getPlaceContinent(trip.destination)];
      if (!endpointContinents.some((continent) => continent && selectedContinents.has(continent))) return false;
    }
    if (selectedDistanceBands.size > 0 && !selectedDistanceBands.has(getTripDistanceBand(trip))) return false;
    if (selectedPurposes.size > 0 && !selectedPurposes.has(trip.purpose ?? "unclassified")) return false;
    if (!needle) return true;
    return [trip.origin.code, trip.origin.name_zh, trip.origin.name_en, trip.destination.code, trip.destination.name_zh, trip.destination.name_en, trip.carrier, trip.carrier_code ?? "", trip.service_number, ...trip.tags]
      .join(" ").toLocaleLowerCase().includes(needle);
  });
}

export async function clearDemoTrips(database: JourneyDatabase = defaultDb): Promise<void> {
  await database.trips.filter((trip) => trip.is_demo).delete();
}

export async function loadDemoTrips(database: JourneyDatabase = defaultDb): Promise<number> {
  const trips = getDemoTrips().map((trip) => normalizeTrip(trip));
  await database.trips.bulkPut(trips);
  return trips.length;
}
