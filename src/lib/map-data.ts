import { interpolateGreatCircle, type Coordinate } from "@/lib/geo";
import { getJourneyDepartureLocalDate } from "@/lib/journey-date";
import { countryColor } from "@/lib/journey-colors";
import { displayPlaceCode } from "@/lib/place-display";
import { classifyDisplayedTripLegs, type RoutePattern } from "@/lib/route-patterns";
import type { Trip } from "@/lib/types";

export type RouteProperties = {
  id: string;
  mode: Trip["mode"];
  date: string;
  origin_zh: string;
  destination_zh: string;
  origin_en: string;
  destination_en: string;
  is_demo: boolean;
  route_pattern: RoutePattern;
  origin_id: string;
  destination_id: string;
};

export type StopProperties = {
  id: string;
  code: string;
  name_zh: string;
  name_en: string;
  city?: string;
  kind: Trip["origin"]["kind"];
  country: string;
  country_color: string;
  visits: number;
};

export type CountryLegendEntry = {
  country: string;
  color: string;
};

export type JourneyMapData = {
  routes: GeoJSON.FeatureCollection<GeoJSON.LineString, RouteProperties>;
  stops: GeoJSON.FeatureCollection<GeoJSON.Point, StopProperties>;
  coordinates: Coordinate[];
  countryLegend: CountryLegendEntry[];
};

type Stop = StopProperties & { coordinate: Coordinate };

export function createJourneyMapData(trips: Trip[]): JourneyMapData {
  const routeFeatures: Array<GeoJSON.Feature<GeoJSON.LineString, RouteProperties>> = [];
  const stops = new Map<string, Stop>();
  const countries = new Map<string, CountryLegendEntry>();
  const coordinates: Coordinate[] = [];
  const routePatterns = classifyDisplayedTripLegs(trips);

  for (const trip of trips) {
    const origin: Coordinate = [trip.origin.longitude, trip.origin.latitude];
    const destination: Coordinate = [trip.destination.longitude, trip.destination.latitude];
    const routeCoordinates = interpolateGreatCircle(origin, destination);
    coordinates.push(...routeCoordinates);
    routeFeatures.push({
      type: "Feature",
      properties: {
        id: trip.id,
        mode: trip.mode,
        date: getJourneyDepartureLocalDate(trip),
        origin_zh: trip.origin.name_zh,
        destination_zh: trip.destination.name_zh,
        origin_en: trip.origin.name_en,
        destination_en: trip.destination.name_en,
        is_demo: trip.is_demo,
        route_pattern: routePatterns.get(trip.id) ?? "one_way",
        origin_id: trip.origin.id,
        destination_id: trip.destination.id,
      },
      geometry: { type: "LineString", coordinates: routeCoordinates },
    });

    for (const place of [trip.origin, trip.destination]) {
      const country = place.country.trim();
      const countryColorValue = countryColor(country);
      const countryKey = country.toLocaleLowerCase();
      if (!countries.has(countryKey)) countries.set(countryKey, { country, color: countryColorValue });

      const existing = stops.get(place.id);
      if (existing) {
        existing.visits += 1;
        continue;
      }
      stops.set(place.id, {
        id: place.id,
        code: displayPlaceCode(place) ?? "",
        name_zh: place.name_zh,
        name_en: place.name_en,
        city: place.city,
        kind: place.kind,
        country,
        country_color: countryColorValue,
        visits: 1,
        coordinate: [place.longitude, place.latitude],
      });
    }
  }

  return {
    routes: { type: "FeatureCollection", features: routeFeatures },
    stops: {
      type: "FeatureCollection",
      features: [...stops.values()].map(({ coordinate, ...properties }) => ({
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: coordinate },
      })),
    },
    coordinates,
    countryLegend: [...countries.values()].sort((first, second) => first.country.localeCompare(second.country, "en")),
  };
}
