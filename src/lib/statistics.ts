import type { Trip, TripMode } from "@/lib/types";

export type JourneyStatistics = {
  totalTrips: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  countriesVisited: number;
  modeCounts: Record<TripMode, number>;
};

export function calculateJourneyStatistics(trips: Trip[]): JourneyStatistics {
  const modeCounts: Record<TripMode, number> = { flight: 0, hsr: 0, rail: 0, other: 0 };
  const countries = new Set<string>();
  let totalDistanceKm = 0;
  let totalDurationMin = 0;

  for (const trip of trips) {
    totalDistanceKm += trip.distance_km;
    totalDurationMin += trip.duration_min;
    modeCounts[trip.mode] += 1;
    countries.add(trip.origin.country);
    countries.add(trip.destination.country);
  }

  return {
    totalTrips: trips.length,
    totalDistanceKm,
    totalDurationMin,
    countriesVisited: countries.size,
    modeCounts,
  };
}
