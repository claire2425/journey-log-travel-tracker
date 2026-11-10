import type { Trip, TripMode } from "@/lib/types";

export type JourneyStatistics = {
  totalTrips: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  countriesVisited: number;
  modeCounts: Record<TripMode, number>;
  modeDistanceKm: Record<TripMode, number>;
};

/**
 * WGS-84 equatorial circumference in kilometres. This is a comparison scale,
 * rather than a claim that a trip followed the equator.
 * Source: https://imagine.gsfc.nasa.gov/ask_astro/earth.html
 */
export const EARTH_EQUATORIAL_CIRCUMFERENCE_KM = 40_075.036;

export function earthLapsForDistance(distanceKm: number) {
  return distanceKm / EARTH_EQUATORIAL_CIRCUMFERENCE_KM;
}

export function calculateJourneyStatistics(trips: Trip[]): JourneyStatistics {
  const modeCounts: Record<TripMode, number> = { flight: 0, rail: 0, cruise: 0, other: 0 };
  const modeDistanceKm: Record<TripMode, number> = { flight: 0, rail: 0, cruise: 0, other: 0 };
  const countries = new Set<string>();
  let totalDistanceKm = 0;
  let totalDurationMin = 0;

  for (const trip of trips) {
    totalDistanceKm += trip.distance_km;
    totalDurationMin += trip.duration_min;
    modeCounts[trip.mode] += 1;
    modeDistanceKm[trip.mode] += trip.distance_km;
    countries.add(trip.origin.country);
    countries.add(trip.destination.country);
  }

  return {
    totalTrips: trips.length,
    totalDistanceKm,
    totalDurationMin,
    countriesVisited: countries.size,
    modeCounts,
    modeDistanceKm,
  };
}
