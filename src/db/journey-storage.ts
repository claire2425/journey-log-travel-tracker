import { db as defaultDb, type JourneyDatabase } from "@/db/index";
import { saveCustomPlace } from "@/db/places";
import { addTrip, updateTrip } from "@/db/trips";
import type { Place, Trip } from "@/lib/types";

export type SaveJourneyWithCustomPlacesInput = {
  trip: Trip;
  /** Newly created or updated locally saved places needed by this journey. */
  customPlaces?: readonly Place[];
  operation?: "create" | "update";
};

/**
 * Saves the journey and any locally saved places as one IndexedDB transaction.
 * A rejected place or trip write aborts the transaction, so no partial journey
 * setup remains in local storage.
 */
export async function saveJourneyWithCustomPlaces(
  input: SaveJourneyWithCustomPlacesInput,
  database: JourneyDatabase = defaultDb,
): Promise<string> {
  return database.transaction("rw", database.custom_places, database.trips, async () => {
    for (const place of input.customPlaces ?? []) {
      await saveCustomPlace(place, database);
    }

    if (input.operation === "update") {
      await updateTrip(input.trip, database);
      return input.trip.id;
    }

    return addTrip(input.trip, database);
  });
}

export class CustomPlaceInUseError extends Error {
  constructor(placeId: string) {
    super(`Cannot delete the saved place "${placeId}" because a journey still uses it.`);
    this.name = "CustomPlaceInUseError";
  }
}

export type DeleteCustomPlaceResult = "deleted" | "not_found";

/**
 * Deletes a saved place only when no stored journey refers to it. Both the
 * reference check and deletion happen in one read-write transaction.
 */
export async function deleteCustomPlace(
  id: string,
  database: JourneyDatabase = defaultDb,
): Promise<DeleteCustomPlaceResult> {
  const placeId = id.trim();
  if (!placeId) throw new Error("A saved place id is required.");

  return database.transaction("rw", database.custom_places, database.trips, async () => {
    const place = await database.custom_places.get(placeId);
    if (!place) return "not_found";

    const journeyUsingPlace = await database.trips
      .filter((trip) => trip.origin.id === placeId || trip.destination.id === placeId)
      .first();
    if (journeyUsingPlace) throw new CustomPlaceInUseError(placeId);

    await database.custom_places.delete(placeId);
    return "deleted";
  });
}

/**
 * Updates a saved place and every embedded journey endpoint that uses it in a
 * single transaction. Trips intentionally store endpoint snapshots, so without
 * this propagation an older trip would keep an outdated continent or name.
 */
export async function updateCustomPlaceAndJourneyReferences(
  input: Place,
  database: JourneyDatabase = defaultDb,
): Promise<Place> {
  return database.transaction("rw", database.custom_places, database.trips, async () => {
    const place = await saveCustomPlace(input, database);
    const affectedTrips = await database.trips
      .filter((trip) => trip.origin.id === place.id || trip.destination.id === place.id)
      .toArray();

    if (affectedTrips.length) {
      await database.trips.bulkPut(affectedTrips.map((trip) => ({
        ...trip,
        origin: trip.origin.id === place.id ? place : trip.origin,
        destination: trip.destination.id === place.id ? place : trip.destination,
      })));
    }

    return place;
  });
}
