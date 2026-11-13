#!/usr/bin/env node

/**
 * Builds the offline global place indexes consumed by /api/places/search.
 *
 * Inputs are deliberately supplied as local files so the shipped application
 * never fetches a user's search text from a third-party place service.
 *
 * Usage:
 *   node scripts/build-global-place-index.mjs \
 *     --airports /path/to/airports.csv \
 *     --airport-countries /path/to/countries.csv \
 *     --stations /path/to/allCountries.txt \
 *     --station-countries /path/to/countryInfo.txt
 */

import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import timezoneAt from "tz-lookup";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const outputDirectory = resolve(projectRoot, "public/reference-data");

const continentByCode = {
  AF: "africa",
  AN: "antarctica",
  AS: "asia",
  EU: "europe",
  NA: "north_america",
  OC: "oceania",
  SA: "south_america",
};

// These names and aliases are sourced from the linked Wikidata items. They
// supplement the source datasets where a commonly used Traditional-Chinese
// name is absent, without inventing translations.
const airportAliasOverlays = {
  TSA: {
    name_zh: "臺北松山機場",
    aliases: ["台北松山機場", "臺北松山機場"],
    wikidata: "Q702019",
  },
  HND: {
    name_zh: "羽田機場",
    aliases: ["東京羽田機場", "羽田國際機場", "羽田機場"],
    wikidata: "Q204853",
  },
};

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return resolve(process.argv[index + 1]);
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

async function readCsv(path) {
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let headers = [];
  const records = [];
  for await (const line of lines) {
    if (!headers.length) {
      headers = parseCsvLine(line);
      continue;
    }
    if (!line) continue;
    const values = parseCsvLine(line);
    records.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }
  return records;
}

function normalizedUnique(values) {
  const seen = new Set();
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= 180)
    .filter((value) => {
      const key = value.normalize("NFKC").toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Returns a usable Chinese display name from a source name, or undefined.
 * Source keyword fields sometimes join several names ("Dayuan District.
 * 臺灣桃園國際機場") or mix a Latin place name with Japanese ("Bridgend駅").
 * A segment is accepted when it has Han text and Latin letters, if any, are
 * only short upper-case abbreviations such as JR or TGV.
 */
function cleanChineseName(value) {
  return value
    .split(/[.;；。]\s*/)
    .map((segment) => segment.trim())
    .find((segment) => /[\u3400-\u9fff]/.test(segment) && !/[a-z]/.test(segment) && !/[A-Z]{5,}/.test(segment));
}

function firstChineseName(values) {
  for (const value of values) {
    const cleaned = cleanChineseName(value);
    if (cleaned) return cleaned;
  }
  return undefined;
}

function continentFor(code) {
  return continentByCode[code] ?? undefined;
}

function airportRecord(row, countries) {
  const iata = row.iata_code.trim().toUpperCase();
  const icao = row.gps_code.trim().toUpperCase();
  const ident = row.ident.trim().toUpperCase();
  const type = row.type.trim();
  const latitude = Number(row.latitude_deg);
  const longitude = Number(row.longitude_deg);
  if (
    type === "closed"
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || (!iata && !["large_airport", "medium_airport"].includes(type))
  ) return undefined;

  const country = countries.get(row.iso_country.trim()) ?? row.iso_country.trim();
  if (!country) return undefined;

  const aliases = normalizedUnique([
    iata,
    icao,
    ident,
    row.local_code,
    row.name,
    row.municipality,
    row.keywords,
  ]);
  const overlay = airportAliasOverlays[iata];
  if (overlay) aliases.push(...overlay.aliases);
  const deduplicatedAliases = normalizedUnique(aliases);
  const nameEn = row.name.trim();
  if (!nameEn) return undefined;

  return {
    id: `airport:ourairports:${ident || iata || icao}`,
    name_zh: overlay?.name_zh ?? firstChineseName(deduplicatedAliases) ?? nameEn,
    name_en: nameEn,
    code: iata || icao,
    aliases: deduplicatedAliases,
    kind: "airport",
    latitude,
    longitude,
    country,
    city: row.municipality.trim() || undefined,
    continent: continentFor(row.continent.trim()),
    time_zone: timezoneAt(latitude, longitude),
    scheduled_service: row.scheduled_service.trim() === "yes",
  };
}

async function readStationCountries(path) {
  const countries = new Map();
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const values = line.split("\t");
    if (values.length < 9 || values[0] === "ISO") continue;
    countries.set(values[0], { name: values[4], continent: continentFor(values[8]) });
  }
  return countries;
}

async function readStations(path, countries) {
  const stations = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of lines) {
    const values = line.split("\t");
    const id = values[0];
    const name = values[1];
    const asciiName = values[2];
    const alternateNames = values[3];
    const latitudeValue = values[4];
    const longitudeValue = values[5];
    const featureClass = values[6];
    const featureCode = values[7];
    const countryCode = values[8];
    const timezone = values[17];
    if (featureClass !== "S" || !["RSTN", "RSTP"].includes(featureCode)) continue;
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    const country = countries.get(countryCode);
    if (!id || !name || !country || !timezone || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const aliases = normalizedUnique([name, asciiName, alternateNames]);
    stations.push({
      id: `station:geonames:${id}`,
      name_zh: firstChineseName(aliases) ?? name,
      name_en: asciiName || name,
      // GeoNames does not provide a single global station-code namespace.
      // This stable source identifier is deliberately hidden by the UI.
      code: `STN-${id}`,
      aliases,
      kind: "station",
      latitude,
      longitude,
      country: country.name,
      continent: country.continent,
      time_zone: timezone,
    });
  }
  return stations;
}

function comparePlaces(left, right) {
  if (left.scheduled_service !== right.scheduled_service) return Number(right.scheduled_service) - Number(left.scheduled_service);
  return left.code.localeCompare(right.code, "en");
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

const airportsPath = argumentValue("--airports");
const airportCountriesPath = argumentValue("--airport-countries");
const stationsPath = argumentValue("--stations");
const stationCountriesPath = argumentValue("--station-countries");

const airportCountries = new Map((await readCsv(airportCountriesPath)).map((country) => [country.code, country.name]));
const airports = (await readCsv(airportsPath))
  .map((row) => airportRecord(row, airportCountries))
  .filter(Boolean)
  .sort(comparePlaces);
const stationCountries = await readStationCountries(stationCountriesPath);
const stations = await readStations(stationsPath, stationCountries);
stations.sort((left, right) => left.name_en.localeCompare(right.name_en, "en"));

const generatedAt = new Date().toISOString();
await writeJson(resolve(outputDirectory, "global-airports.json"), airports);
await writeJson(resolve(outputDirectory, "global-stations.json"), stations);
await writeJson(resolve(outputDirectory, "global-place-metadata.json"), {
  generated_at: generatedAt,
  airports: {
    count: airports.length,
    source: "OurAirports airports.csv",
    source_url: "https://ourairports.com/data/",
    license: "Public Domain",
  },
  stations: {
    count: stations.length,
    source: "GeoNames allCountries.txt; feature codes RSTN and RSTP",
    source_url: "https://www.geonames.org/export/",
    license: "CC BY 4.0",
  },
  chinese_airport_alias_overlays: Object.fromEntries(
    Object.entries(airportAliasOverlays).map(([code, value]) => [code, { wikidata: value.wikidata }]),
  ),
});

console.log(`Wrote ${airports.length.toLocaleString("en")} airports and ${stations.length.toLocaleString("en")} stations.`);
