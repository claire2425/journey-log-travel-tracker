import { getJourneyDepartureLocalDate } from "@/lib/journey-date";
import { calculateJourneyStatistics, earthLapsForDistance, type JourneyStatistics } from "@/lib/statistics";
import { calculateAnnualVisitStatistics, type AnnualVisitStatistics } from "@/lib/visit-statistics";
import type { Trip, TripMode } from "@/lib/types";

export type TravelModeRecap = {
  mode: TripMode;
  journeys: number;
  distance_km: number;
};

export type RecentJourneyRecap = {
  id: string;
  departure_date: string;
  origin_zh: string;
  origin_en: string;
  destination_zh: string;
  destination_en: string;
  mode: TripMode;
  distance_km: number;
};

export type TravelRecap = {
  total_journeys: number;
  statistics: JourneyStatistics;
  earth_laps: number;
  modes: TravelModeRecap[];
  annual_visits: AnnualVisitStatistics[];
  recent_journeys: RecentJourneyRecap[];
};

const modeOrder: TripMode[] = ["flight", "rail", "cruise", "other"];

/**
 * A presentation-ready view of the currently visible journeys. It deliberately
 * accepts the already-filtered list, so every statistic in a recap has the
 * same scope as the journey cards the person is looking at.
 */
export function buildTravelRecap(trips: Trip[]): TravelRecap {
  const statistics = calculateJourneyStatistics(trips);

  return {
    total_journeys: trips.length,
    statistics,
    earth_laps: earthLapsForDistance(statistics.totalDistanceKm),
    modes: modeOrder.map((mode) => ({
      mode,
      journeys: statistics.modeCounts[mode],
      distance_km: statistics.modeDistanceKm[mode],
    })),
    annual_visits: calculateAnnualVisitStatistics(trips),
    recent_journeys: [...trips]
      .sort((left, right) => Date.parse(right.departure) - Date.parse(left.departure))
      .slice(0, 5)
      .map((trip) => ({
        id: trip.id,
        departure_date: getJourneyDepartureLocalDate(trip),
        origin_zh: trip.origin.name_zh,
        origin_en: trip.origin.name_en,
        destination_zh: trip.destination.name_zh,
        destination_en: trip.destination.name_en,
        mode: trip.mode,
        distance_km: trip.distance_km,
      })),
  };
}
