import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Coordinate } from "@/lib/geo";

/**
 * Source note: country shapes come from Natural Earth 1:50m Admin 0 countries
 * (public domain, https://www.naturalearthdata.com/), packaged as TopoJSON by
 * the `world-atlas` project (ISC licence). They are a display backdrop for the
 * locally generated PNG only — not authoritative borders or navigation data.
 */
export const WORLD_BASEMAP_URL = "/reference-data/world-countries-50m.json";
export const WORLD_BASEMAP_SOURCE_NOTE = "Natural Earth (public domain)";

export type BasemapCountry = {
  name: string;
  /** Every ring (outer and holes) of every polygon; fill with the even-odd rule. */
  rings: Coordinate[][];
  /** [west, south, east, north] in degrees. */
  bbox: [number, number, number, number];
};

export type WorldBasemap = {
  countries: BasemapCountry[];
};

type CountryProperties = { name?: string };

function ringBox(rings: Coordinate[][]): [number, number, number, number] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      if (longitude < west) west = longitude;
      if (longitude > east) east = longitude;
      if (latitude < south) south = latitude;
      if (latitude > north) north = latitude;
    }
  }
  return [west, south, east, north];
}

/** Converts world-atlas TopoJSON into flat ring lists that canvas can draw quickly. */
export function basemapFromTopology(topology: Topology): WorldBasemap {
  const objects = topology.objects as Record<string, GeometryCollection<CountryProperties>>;
  const countriesObject = objects.countries;
  if (!countriesObject) return { countries: [] };
  const collection = feature(topology, countriesObject);
  const features = "features" in collection ? collection.features : [collection];
  const countries: BasemapCountry[] = [];

  for (const item of features) {
    const geometry = item.geometry;
    if (!geometry) continue;
    let rings: Coordinate[][] = [];
    if (geometry.type === "Polygon") rings = geometry.coordinates as Coordinate[][];
    else if (geometry.type === "MultiPolygon") rings = (geometry.coordinates as Coordinate[][][]).flat();
    if (!rings.length) continue;
    countries.push({ name: (item.properties as CountryProperties | null)?.name ?? "", rings, bbox: ringBox(rings) });
  }
  return { countries };
}

let basemapPromise: Promise<WorldBasemap | null> | undefined;

/**
 * Fetches the bundled same-origin basemap once per page. A failure (for
 * example while offline before the file was cached) resolves to `null`, and
 * the report falls back to its schematic continents.
 */
export function loadWorldBasemap(fetcher: typeof fetch = fetch): Promise<WorldBasemap | null> {
  basemapPromise ??= fetcher(WORLD_BASEMAP_URL)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Basemap ${response.status}`))))
    .then((topology: Topology) => basemapFromTopology(topology))
    .catch(() => {
      basemapPromise = undefined;
      return null;
    });
  return basemapPromise;
}

function pointInRings([longitude, latitude]: Coordinate, rings: Coordinate[][]) {
  let inside = false;
  for (const ring of rings) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const [x1, y1] = ring[index]!;
      const [x2, y2] = ring[previous]!;
      if ((y1 > latitude) !== (y2 > latitude) && longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1) {
        inside = !inside;
      }
    }
  }
  return inside;
}

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "united states": "united states of america",
  usa: "united states of america",
  us: "united states of america",
  uk: "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",
  wales: "united kingdom",
  korea: "south korea",
  "republic of korea": "south korea",
  "czech republic": "czechia",
  "viet nam": "vietnam",
  macao: "macao",
  macau: "macao",
};

/**
 * Finds the basemap country a stop belongs to: first by containing polygon,
 * then by its recorded country name (airports built on reclaimed islands can
 * sit just outside a 1:50m coastline).
 */
export function findBasemapCountry(basemap: WorldBasemap, coordinate: Coordinate, countryName: string): BasemapCountry | undefined {
  const [longitude, latitude] = coordinate;
  for (const country of basemap.countries) {
    const [west, south, east, north] = country.bbox;
    if (longitude < west || longitude > east || latitude < south || latitude > north) continue;
    if (pointInRings(coordinate, country.rings)) return country;
  }
  const key = countryName.trim().toLocaleLowerCase();
  const target = COUNTRY_NAME_ALIASES[key] ?? key;
  return basemap.countries.find((country) => country.name.toLocaleLowerCase() === target);
}
