import type { Coordinate } from "@/lib/geo";
import { createJourneyMapData } from "@/lib/map-data";
import type { CountryLegendEntry } from "@/lib/map-data";
import type { RoutePattern } from "@/lib/route-patterns";
import type { Trip, TripMode } from "@/lib/types";

export type SchematicMapFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SchematicJourneyRoute = {
  mode: TripMode;
  route_pattern: RoutePattern;
  paths: Coordinate[][];
};

export type SchematicJourneyStop = {
  coordinate: Coordinate;
  code: string;
  country: string;
  country_color: string;
  visits: number;
};

export type SchematicJourneyMap = {
  routes: SchematicJourneyRoute[];
  stops: SchematicJourneyStop[];
  country_legend: CountryLegendEntry[];
};

/**
 * Compact, deliberately schematic continent silhouettes for a local report
 * backdrop. They are not country boundaries, a navigation map, or a source of
 * geographic measurements; the journey coordinates and routes remain exact
 * to the records supplied by the person.
 */
export const SCHEMATIC_WORLD_LANDMASSES: Coordinate[][] = [
  // North America, Central America, Greenland, South America
  [[-168, 72], [-158, 65], [-154, 58], [-145, 56], [-138, 52], [-134, 56], [-128, 53], [-124, 48], [-124, 43], [-119, 38], [-116, 32], [-110, 28], [-103, 24], [-97, 20], [-91, 18], [-86, 20], [-88, 25], [-82, 27], [-80, 32], [-77, 37], [-73, 42], [-68, 46], [-61, 51], [-59, 57], [-64, 62], [-72, 68], [-79, 73], [-93, 77], [-110, 79], [-131, 79], [-151, 76]],
  [[-97, 20], [-91, 18], [-86, 16], [-84, 12], [-80, 10], [-78, 8], [-80, 7], [-84, 9], [-88, 13], [-92, 15]],
  [[-73, 59], [-60, 60], [-46, 65], [-38, 72], [-39, 79], [-50, 83], [-62, 80], [-69, 72]],
  [[-81, 12], [-75, 10], [-72, 4], [-69, -4], [-65, -12], [-61, -20], [-58, -31], [-60, -42], [-66, -53], [-73, -55], [-78, -47], [-76, -36], [-79, -24], [-81, -12], [-80, 0]],
  // Europe, Africa, Asia, India, South-East Asia and island groups
  [[-11, 36], [-9, 43], [-5, 50], [2, 54], [9, 58], [17, 63], [28, 68], [37, 68], [39, 61], [32, 55], [27, 49], [20, 45], [13, 42], [4, 43], [-3, 40]],
  [[-17, 36], [-5, 37], [6, 35], [15, 32], [26, 30], [33, 24], [40, 12], [42, 2], [39, -10], [33, -19], [26, -29], [18, -35], [10, -34], [3, -26], [-5, -18], [-12, -6], [-17, 8], [-15, 21]],
  [[27, 72], [42, 75], [60, 75], [82, 76], [103, 73], [121, 67], [140, 58], [154, 52], [163, 49], [160, 43], [151, 40], [146, 35], [139, 32], [132, 28], [124, 22], [119, 14], [113, 6], [105, 2], [100, 8], [96, 18], [91, 23], [84, 27], [78, 30], [72, 28], [66, 30], [60, 33], [53, 36], [45, 37], [36, 42], [29, 48]],
  [[68, 24], [76, 27], [83, 23], [88, 20], [90, 14], [86, 8], [80, 7], [76, 12], [73, 18]],
  [[98, 7], [105, 6], [110, 2], [116, -1], [121, -4], [124, -8], [121, -10], [115, -7], [109, -5], [104, 0]],
  [[130, 33], [135, 36], [141, 43], [145, 42], [143, 37], [139, 34]],
  [[138, -3], [145, -5], [151, -6], [154, -9], [150, -10], [143, -8]],
  // Oceania and Antarctica
  [[112, -11], [117, -17], [123, -23], [132, -27], [141, -28], [151, -34], [153, -40], [148, -44], [137, -43], [128, -38], [119, -34], [114, -27], [111, -19]],
  [[166, -34], [173, -39], [177, -45], [174, -47], [169, -42]],
  [[-180, -72], [-162, -75], [-142, -77], [-118, -75], [-94, -79], [-70, -77], [-47, -80], [-20, -78], [5, -81], [32, -79], [57, -82], [83, -80], [108, -82], [136, -78], [160, -80], [180, -73], [180, -85], [-180, -85]],
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Projects longitude/latitude into a compact equirectangular report map. */
export function projectSchematicWorldCoordinate([longitude, latitude]: Coordinate, frame: SchematicMapFrame) {
  const safeLongitude = clamp(longitude, -180, 180);
  const safeLatitude = clamp(latitude, -85, 85);
  return {
    x: frame.x + ((safeLongitude + 180) / 360) * frame.width,
    y: frame.y + ((85 - safeLatitude) / 170) * frame.height,
  };
}

/**
 * Splits a great-circle route where its normalised longitudes cross the
 * anti-meridian, preventing a short Pacific journey from becoming a line
 * across the entire world drawing.
 */
export function splitPathAtDateLine(coordinates: Coordinate[]): Coordinate[][] {
  if (coordinates.length < 2) return coordinates.length ? [coordinates] : [];

  const paths: Coordinate[][] = [];
  let current: Coordinate[] = [coordinates[0]!];

  for (const next of coordinates.slice(1)) {
    const previous = current[current.length - 1]!;
    const longitudeDelta = next[0] - previous[0];

    if (Math.abs(longitudeDelta) <= 180) {
      current.push(next);
      continue;
    }

    const crossesEastward = longitudeDelta < 0;
    const unwrappedNextLongitude = crossesEastward ? next[0] + 360 : next[0] - 360;
    const edgeLongitude = crossesEastward ? 180 : -180;
    const oppositeEdgeLongitude = crossesEastward ? -180 : 180;
    const progress = (edgeLongitude - previous[0]) / (unwrappedNextLongitude - previous[0]);
    const edgeLatitude = previous[1] + (next[1] - previous[1]) * progress;

    current.push([edgeLongitude, edgeLatitude]);
    paths.push(current);
    current = [[oppositeEdgeLongitude, edgeLatitude], next];
  }

  paths.push(current);
  return paths.filter((path) => path.length >= 2);
}

function pointKey([longitude, latitude]: Coordinate) {
  return `${longitude.toFixed(4)},${latitude.toFixed(4)}`;
}

function routeKey(mode: TripMode, coordinates: Coordinate[]) {
  const origin = coordinates[0];
  const destination = coordinates.at(-1);
  if (!origin || !destination) return `${mode}\u0000empty`;
  const originKey = pointKey(origin);
  const destinationKey = pointKey(destination);
  const endpoints = originKey > destinationKey
    ? `${destinationKey}\u0000${originKey}`
    : `${originKey}\u0000${destinationKey}`;
  return `${mode}\u0000${endpoints}`;
}

/**
 * Reuses the interactive-map data pipeline, then removes duplicate visual
 * routes for the compact PNG. Route totals remain available in the report's
 * statistics; this only keeps overlapping strokes easy to read.
 */
export function createSchematicJourneyMap(trips: Trip[]): SchematicJourneyMap {
  const mapData = createJourneyMapData(trips);
  const routes = new Map<string, SchematicJourneyRoute>();

  for (const feature of mapData.routes.features) {
    const coordinates = feature.geometry.coordinates as Coordinate[];
    const properties = feature.properties;
    const key = routeKey(properties.mode, coordinates);
    const existing = routes.get(key);
    if (existing) {
      // A return journey should remain visibly thicker even when an extra
      // one-way record shares the same visual path.
      if (properties.route_pattern === "paired_return") existing.route_pattern = "paired_return";
      continue;
    }
    routes.set(key, {
      mode: properties.mode,
      route_pattern: properties.route_pattern,
      paths: splitPathAtDateLine(coordinates),
    });
  }

  return {
    routes: [...routes.values()],
    stops: mapData.stops.features.map((feature) => ({
      coordinate: feature.geometry.coordinates as Coordinate,
      code: feature.properties.code,
      country: feature.properties.country,
      country_color: feature.properties.country_color,
      visits: feature.properties.visits,
    })),
    country_legend: mapData.countryLegend,
  };
}
