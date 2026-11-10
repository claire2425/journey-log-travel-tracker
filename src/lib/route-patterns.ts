import type { Trip } from "@/lib/types";

export type RoutePattern = "paired_return" | "one_way";

function directionKey(originId: string, destinationId: string) {
  return `${originId}\u0000${destinationId}`;
}

function routeGroupKey(originId: string, destinationId: string) {
  return originId < destinationId
    ? directionKey(originId, destinationId)
    : directionKey(destinationId, originId);
}

function tripOrder(first: Trip, second: Trip) {
  return Date.parse(first.departure) - Date.parse(second.departure)
    || Date.parse(first.arrival) - Date.parse(second.arrival)
    || first.id.localeCompare(second.id);
}

/**
 * Pairs visible journey legs only when opposite directions use the same stops
 * and the first leg has arrived before the second one departs. Every leg is
 * paired at most once, so unmatched duplicates remain one-way.
 */
export function classifyDisplayedTripLegs(trips: Trip[]) {
  const patterns = new Map<string, RoutePattern>(trips.map((trip) => [trip.id, "one_way"]));
  const tripsByRoute = new Map<string, Trip[]>();

  for (const trip of trips) {
    if (trip.origin.id === trip.destination.id) continue;
    const key = routeGroupKey(trip.origin.id, trip.destination.id);
    const group = tripsByRoute.get(key) ?? [];
    group.push(trip);
    tripsByRoute.set(key, group);
  }

  for (const routeTrips of tripsByRoute.values()) {
    const unmatchedByDirection = new Map<string, Trip[]>();

    for (const trip of [...routeTrips].sort(tripOrder)) {
      const direction = directionKey(trip.origin.id, trip.destination.id);
      const reverseDirection = directionKey(trip.destination.id, trip.origin.id);
      const reverseTrips = unmatchedByDirection.get(reverseDirection) ?? [];
      const departureTime = Date.parse(trip.departure);
      let matchIndex = -1;

      for (let index = reverseTrips.length - 1; index >= 0; index -= 1) {
        if (Date.parse(reverseTrips[index].arrival) <= departureTime) {
          matchIndex = index;
          break;
        }
      }

      if (matchIndex >= 0) {
        const [matchingTrip] = reverseTrips.splice(matchIndex, 1);
        patterns.set(trip.id, "paired_return");
        patterns.set(matchingTrip.id, "paired_return");
        continue;
      }

      const unmatchedTrips = unmatchedByDirection.get(direction) ?? [];
      unmatchedTrips.push(trip);
      unmatchedByDirection.set(direction, unmatchedTrips);
    }
  }

  return patterns;
}
