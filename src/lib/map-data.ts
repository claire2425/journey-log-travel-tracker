import { interpolateGreatCircle, type Coordinate } from "@/lib/geo";
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
};

export type StopProperties = {
  id: string;
  code: string;
  name_zh: string;
  name_en: string;
  visits: number;
};

export type JourneyMapData = {
  routes: GeoJSON.FeatureCollection<GeoJSON.LineString, RouteProperties>;
  stops: GeoJSON.FeatureCollection<GeoJSON.Point, StopProperties>;
  coordinates: Coordinate[];
};

type Stop = StopProperties & { coordinate: Coordinate };

export function createJourneyMapData(trips: Trip[]): JourneyMapData {
  const routeFeatures: Array<GeoJSON.Feature<GeoJSON.LineString, RouteProperties>> = [];
  const stops = new Map<string, Stop>();
  const coordinates: Coordinate[] = [];

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
        date: trip.departure.slice(0, 10),
        origin_zh: trip.origin.name_zh,
        destination_zh: trip.destination.name_zh,
        origin_en: trip.origin.name_en,
        destination_en: trip.destination.name_en,
        is_demo: trip.is_demo,
      },
      geometry: { type: "LineString", coordinates: routeCoordinates },
    });

    for (const place of [trip.origin, trip.destination]) {
      const existing = stops.get(place.id);
      if (existing) {
        existing.visits += 1;
        continue;
      }
      stops.set(place.id, {
        id: place.id,
        code: place.code,
        name_zh: place.name_zh,
        name_en: place.name_en,
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
  };
}
