import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { searchPlaces, type SearchablePlace } from "@/lib/place-search";
import type { Place } from "@/lib/types";

export type GlobalPlaceKind = "airport" | "station";

export type GlobalPlaceRecord = SearchablePlace & {
  aliases: string[];
  scheduled_service?: boolean;
};

const fileNameByKind: Record<GlobalPlaceKind, string> = {
  airport: "global-airports.json",
  station: "global-stations.json",
};

const datasetCache = new Map<GlobalPlaceKind, Promise<GlobalPlaceRecord[]>>();

function dataPath(kind: GlobalPlaceKind) {
  return join(process.cwd(), "public", "reference-data", fileNameByKind[kind]);
}

async function loadDataset(kind: GlobalPlaceKind): Promise<GlobalPlaceRecord[]> {
  const existing = datasetCache.get(kind);
  if (existing) return existing;

  const loading = readFile(dataPath(kind), "utf8")
    .then((content) => JSON.parse(content) as GlobalPlaceRecord[]);
  datasetCache.set(kind, loading);
  try {
    return await loading;
  } catch (error) {
    datasetCache.delete(kind);
    throw error;
  }
}

function toPlace(record: GlobalPlaceRecord): Place {
  return {
    id: record.id,
    name_zh: record.name_zh,
    name_en: record.name_en,
    code: record.code,
    kind: record.kind,
    latitude: record.latitude,
    longitude: record.longitude,
    country: record.country,
    city: record.city,
    continent: record.continent,
    time_zone: record.time_zone,
  };
}

/**
 * Searches the bundled global reference index. This performs no third-party
 * network request; the search text reaches only this application's own route.
 */
export async function searchGlobalPlaces(kind: GlobalPlaceKind, query: string, limit = 8): Promise<Place[]> {
  const records = await loadDataset(kind);
  return searchPlaces(records, query, limit).map(toPlace);
}

export function clearGlobalPlaceDirectoryCacheForTest() {
  datasetCache.clear();
}
