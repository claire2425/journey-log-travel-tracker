import type { Place } from "@/lib/types";

/**
 * GeoNames supplies a stable record ID for many stations, but there is no
 * single worldwide rail-station code namespace.  The generated ID is useful
 * internally for persistence, not as a label travellers should be asked to
 * recognize.
 */
export function isReferenceStationIdentifier(place: Pick<Place, "code" | "kind">): boolean {
  return place.kind === "station" && /^STN-\d+$/.test(place.code);
}

/** Returns a human-facing code only when the source provides one. */
export function displayPlaceCode(place: Pick<Place, "code" | "kind">): string | undefined {
  return isReferenceStationIdentifier(place) ? undefined : place.code;
}
