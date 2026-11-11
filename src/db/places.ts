import { db as defaultDb, type JourneyDatabase } from "@/db/index";
import { notifyCloudSyncNeeded, queueSyncUpsert } from "@/db/sync";
import { PlaceSchema, type Place } from "@/lib/types";

export type CustomPlaceInput = Omit<Place, "id"> & { id?: string };

function newCustomPlaceId(): string {
  return `custom-${crypto.randomUUID()}`;
}

function normalizeCustomPlace(input: CustomPlaceInput): Place {
  return PlaceSchema.parse({
    ...input,
    id: input.id?.trim() || newCustomPlaceId(),
    name_zh: input.name_zh.trim(),
    name_en: input.name_en.trim(),
    code: input.code.trim().toUpperCase(),
    country: input.country.trim(),
    city: input.city?.trim() || undefined,
    time_zone: input.time_zone.trim(),
  });
}

/**
 * User-saved places can be airports, stations, or a generic custom place. They
 * deliberately live separately from any bundled lookup list so local edits are
 * never overwritten by a later app update.
 */
export async function listCustomPlaces(database: JourneyDatabase = defaultDb): Promise<Place[]> {
  const places = (await database.custom_places.toArray()).map((place) => normalizeCustomPlace(place));
  return places.sort((left, right) => (
    `${left.name_en}\u0000${left.name_zh}`.localeCompare(`${right.name_en}\u0000${right.name_zh}`, "en")
  ));
}

/**
 * Uses the place id as the upsert key. Input is normalized and validated before
 * IndexedDB is touched, so an invalid update cannot replace a valid saved place.
 */
export async function saveCustomPlace(
  input: CustomPlaceInput,
  database: JourneyDatabase = defaultDb,
  shouldNotify = true,
): Promise<Place> {
  const place = normalizeCustomPlace(input);
  await database.transaction(
    "rw",
    database.custom_places,
    database.sync_profile,
    database.sync_record_state,
    database.sync_outbox,
    async () => {
      await database.custom_places.put(place);
      await queueSyncUpsert("custom_place", place, database);
    },
  );
  if (shouldNotify) notifyCloudSyncNeeded();
  return place;
}
