import { greatCircleDistanceKm, type Coordinate } from "@/lib/geo";
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
  /** Antimeridian-split paths for the legacy equirectangular sketch. */
  paths: Coordinate[][];
  /** The unsplit great-circle points used by the fitted report map. */
  coordinates: Coordinate[];
  origin_id: string;
  destination_id: string;
  journeys: number;
};

export type SchematicJourneyStop = {
  id: string;
  coordinate: Coordinate;
  code: string;
  name_zh: string;
  name_en: string;
  city?: string;
  kind: Trip["origin"]["kind"];
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
      existing.journeys += 1;
      // A return journey should remain visibly thicker even when an extra
      // one-way record shares the same visual path.
      if (properties.route_pattern === "paired_return") existing.route_pattern = "paired_return";
      continue;
    }
    routes.set(key, {
      mode: properties.mode,
      route_pattern: properties.route_pattern,
      paths: splitPathAtDateLine(coordinates),
      coordinates,
      origin_id: properties.origin_id,
      destination_id: properties.destination_id,
      journeys: 1,
    });
  }

  return {
    routes: [...routes.values()],
    stops: mapData.stops.features.map((feature) => ({
      id: feature.properties.id,
      coordinate: feature.geometry.coordinates as Coordinate,
      code: feature.properties.code,
      name_zh: feature.properties.name_zh,
      name_en: feature.properties.name_en,
      city: feature.properties.city,
      kind: feature.properties.kind,
      country: feature.properties.country,
      country_color: feature.properties.country_color,
      visits: feature.properties.visits,
    })),
    country_legend: mapData.countryLegend,
  };
}

/* -------------------------------------------------------------------------- */
/* Fitted Web-Mercator view for the PNG report                                */
/* -------------------------------------------------------------------------- */

export type MercatorView = {
  frame: SchematicMapFrame;
  centerLongitude: number;
  /** Pixels per radian of longitude. */
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type ProjectedPoint = { x: number; y: number };

const MERCATOR_MIN_LATITUDE = -78;
const MERCATOR_MAX_LATITUDE = 82;
const toRadians = (value: number) => (value * Math.PI) / 180;

function normaliseLongitude(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** Longitude relative to a map centre, always within [-180, 180). */
export function relativeLongitude(longitude: number, centerLongitude: number) {
  return normaliseLongitude(longitude - centerLongitude);
}

export function mercatorY(latitude: number) {
  const radians = toRadians(clamp(latitude, MERCATOR_MIN_LATITUDE, MERCATOR_MAX_LATITUDE));
  return -Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

/**
 * Chooses the map's central meridian opposite the largest empty longitude
 * gap, so a Tokyo–Honolulu–Los Angeles footprint is drawn across the Pacific
 * rather than split at the anti-meridian.
 */
export function chooseCentralLongitude(longitudes: number[]): number {
  const sorted = [...new Set(longitudes.map((value) => Number(normaliseLongitude(value).toFixed(6))))].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0]!;

  let largestGap = -1;
  let occupiedStart = sorted[0]!;
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    const next = index === sorted.length - 1 ? sorted[0]! + 360 : sorted[index + 1]!;
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      occupiedStart = normaliseLongitude(next);
    }
  }
  return normaliseLongitude(occupiedStart + (360 - largestGap) / 2);
}

/**
 * Fits a Mercator view around the supplied coordinates. The minimum span keeps
 * a single short rail journey from becoming an unreadably close street-level
 * view, and padding leaves room for stop labels.
 */
export function fitMercatorView(
  coordinates: Coordinate[],
  frame: SchematicMapFrame,
  options: { padding?: number; minSpanDegrees?: number; centerLongitude?: number; zoomOut?: number } = {},
): MercatorView {
  const padding = options.padding ?? 48;
  const minSpan = toRadians(options.minSpanDegrees ?? 6);
  const zoomOut = options.zoomOut ?? 1;
  const points = coordinates.length ? coordinates : [[0, 20] as Coordinate];
  const centerLongitude = options.centerLongitude ?? chooseCentralLongitude(points.map(([longitude]) => longitude));

  const xs = points.map(([longitude]) => toRadians(relativeLongitude(longitude, centerLongitude)));
  const ys = points.map(([, latitude]) => mercatorY(latitude));
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  const growTo = (minimum: number, maximum: number, span: number): [number, number] => {
    if (maximum - minimum >= span) return [minimum, maximum];
    const middle = (minimum + maximum) / 2;
    return [middle - span / 2, middle + span / 2];
  };
  [minX, maxX] = growTo(minX, maxX, minSpan);
  [minY, maxY] = growTo(minY, maxY, minSpan * 0.55);

  const usableWidth = Math.max(1, frame.width - padding * 2);
  const usableHeight = Math.max(1, frame.height - padding * 2);
  const scale = Math.min(usableWidth / (maxX - minX), usableHeight / (maxY - minY)) / zoomOut;
  const middleX = (minX + maxX) / 2;
  const middleY = (minY + maxY) / 2;

  return {
    frame,
    centerLongitude,
    scale,
    offsetX: frame.x + frame.width / 2 - middleX * scale,
    offsetY: frame.y + frame.height / 2 - middleY * scale,
  };
}

/** Projects one coordinate into the fitted view, wrapping its longitude near the centre. */
export function projectMercator([longitude, latitude]: Coordinate, view: MercatorView, longitudeShift = 0): ProjectedPoint {
  return {
    x: view.offsetX + toRadians(relativeLongitude(longitude, view.centerLongitude) + longitudeShift) * view.scale,
    y: view.offsetY + mercatorY(latitude) * view.scale,
  };
}

/**
 * Projects a continuous path without wrapping each vertex independently, so a
 * route crossing the anti-meridian stays one unbroken line.
 */
export function projectMercatorPath(coordinates: Coordinate[], view: MercatorView): ProjectedPoint[] {
  const output: ProjectedPoint[] = [];
  let previousRelative: number | undefined;
  let previousLongitude: number | undefined;
  for (const [longitude, latitude] of coordinates) {
    let relative: number;
    if (previousRelative === undefined || previousLongitude === undefined) {
      relative = relativeLongitude(longitude, view.centerLongitude);
    } else {
      relative = previousRelative + normaliseLongitude(longitude - previousLongitude);
    }
    previousRelative = relative;
    previousLongitude = longitude;
    output.push({
      x: view.offsetX + toRadians(relative) * view.scale,
      y: view.offsetY + mercatorY(latitude) * view.scale,
    });
  }
  return output;
}

/** Kilometres represented by one pixel at a latitude in this view. */
export function kilometresPerPixel(view: MercatorView, latitude: number) {
  return (6371.0088 * Math.cos(toRadians(latitude))) / view.scale;
}

/** Inverse of the Mercator y projection, used to find a view's middle latitude. */
export function latitudeAtY(y: number, view: MercatorView) {
  const mercator = (y - view.offsetY) / view.scale;
  return (Math.atan(Math.exp(-mercator)) * 2 - Math.PI / 2) * (180 / Math.PI);
}

/* -------------------------------------------------------------------------- */
/* Regional detail panels                                                      */
/* -------------------------------------------------------------------------- */

export type FootprintRegion = {
  stops: SchematicJourneyStop[];
  routes: SchematicJourneyRoute[];
  coordinates: Coordinate[];
  countries: string[];
  journeys: number;
};

/** Groups stops whose nearest neighbour is within the threshold (single linkage). */
export function clusterStops(stops: SchematicJourneyStop[], thresholdKm = 1000): SchematicJourneyStop[][] {
  const parent = stops.map((_, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]!]!;
      index = parent[index]!;
    }
    return index;
  };
  for (let first = 0; first < stops.length; first += 1) {
    for (let second = first + 1; second < stops.length; second += 1) {
      if (greatCircleDistanceKm(stops[first]!.coordinate, stops[second]!.coordinate) <= thresholdKm) {
        parent[find(first)] = find(second);
      }
    }
  }
  const groups = new Map<number, SchematicJourneyStop[]>();
  stops.forEach((stop, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), stop]);
  });
  return [...groups.values()];
}

/**
 * Picks up to `maxRegions` compact clusters that would be cramped on the
 * overview map. Each becomes a zoomed panel so short rail and domestic routes
 * remain readable next to long-haul flights.
 */
export function planFootprintRegions(
  map: SchematicJourneyMap,
  overview: MercatorView,
  options: { thresholdKm?: number; maxRegions?: number; crampedFraction?: number } = {},
): FootprintRegion[] {
  const clusters = clusterStops(map.stops, options.thresholdKm ?? 1000);
  // A single cluster is already fitted by the overview itself.
  if (clusters.length < 2) return [];
  const crampedFraction = options.crampedFraction ?? 0.22;
  const maxRegions = options.maxRegions ?? 3;

  const regions: FootprintRegion[] = [];
  for (const stops of clusters) {
    if (stops.length < 2) continue;
    const ids = new Set(stops.map((stop) => stop.id));
    const routes = map.routes.filter((route) => ids.has(route.origin_id) && ids.has(route.destination_id));
    const coordinates = [...stops.map((stop) => stop.coordinate), ...routes.flatMap((route) => route.coordinates)];
    const projected = stops.map((stop) => projectMercator(stop.coordinate, overview));
    const width = Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x));
    const height = Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y));
    const cramped = width < overview.frame.width * crampedFraction && height < overview.frame.height * crampedFraction * 1.6;
    if (!cramped) continue;
    const countries = [...new Set(stops.map((stop) => stop.country))];
    const journeys = routes.reduce((sum, route) => sum + route.journeys, 0) + stops.reduce((sum, stop) => sum + stop.visits, 0) / 10;
    regions.push({ stops, routes, coordinates, countries, journeys });
  }

  return regions
    .sort((first, second) => second.journeys - first.journeys)
    .slice(0, maxRegions)
    .sort((first, second) => {
      const firstX = Math.min(...first.stops.map((stop) => projectMercator(stop.coordinate, overview).x));
      const secondX = Math.min(...second.stops.map((stop) => projectMercator(stop.coordinate, overview).x));
      return firstX - secondX;
    });
}
