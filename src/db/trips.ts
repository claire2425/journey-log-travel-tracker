import { db as defaultDb, type JourneyDatabase } from "@/db/index";
import { getDemoTrips } from "@/lib/demo-trips";
import { TripSchema, type Trip, type TripMode } from "@/lib/types";

export type TripFilters = {
  mode?: TripMode;
  year?: number;
  search?: string;
};

export async function addTrip(input: Trip, database: JourneyDatabase = defaultDb): Promise<string> {
  const trip = TripSchema.parse(input);
  await database.trips.add(trip);
  return trip.id;
}

export async function updateTrip(input: Trip, database: JourneyDatabase = defaultDb): Promise<void> {
  const trip = TripSchema.parse(input);
  const count = await database.trips.update(trip.id, trip);
  if (count === 0) throw new Error(`Trip not found: ${trip.id}`);
}

export async function deleteTrip(id: string, database: JourneyDatabase = defaultDb): Promise<void> {
  await database.trips.delete(id);
}

export async function getTrip(id: string, database: JourneyDatabase = defaultDb): Promise<Trip | undefined> {
  const trip = await database.trips.get(id);
  return trip ? TripSchema.parse(trip) : undefined;
}

export async function listTrips(filters: TripFilters = {}, database: JourneyDatabase = defaultDb): Promise<Trip[]> {
  const trips = (await database.trips.orderBy("departure").reverse().toArray()).map((trip) => TripSchema.parse(trip));
  const needle = filters.search?.trim().toLocaleLowerCase();
  return trips.filter((trip) => {
    if (filters.mode && trip.mode !== filters.mode) return false;
    if (filters.year && new Date(trip.departure).getUTCFullYear() !== filters.year) return false;
    if (!needle) return true;
    return [trip.origin.code, trip.origin.name_zh, trip.origin.name_en, trip.destination.code, trip.destination.name_zh, trip.destination.name_en, trip.carrier, trip.service_number, ...trip.tags]
      .join(" ").toLocaleLowerCase().includes(needle);
  });
}

export async function clearDemoTrips(database: JourneyDatabase = defaultDb): Promise<void> {
  await database.trips.filter((trip) => trip.is_demo).delete();
}

export async function loadDemoTrips(database: JourneyDatabase = defaultDb): Promise<number> {
  const trips = getDemoTrips().map((trip) => TripSchema.parse(trip));
  await database.trips.bulkPut(trips);
  return trips.length;
}
