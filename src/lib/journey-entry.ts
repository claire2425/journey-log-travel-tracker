import { greatCircleDistanceKm } from "@/lib/geo";
import { TripSchema, type Place, type Trip, type TripMode, type TripPurpose } from "@/lib/types";

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type ManualJourneyInput = {
  id: string;
  mode: TripMode;
  origin: Place;
  destination: Place;
  departureLocal: string;
  arrivalLocal: string;
  carrier?: string;
  carrierCode?: string;
  carrierLogoUrl?: string;
  serviceNumber?: string;
  purpose?: TripPurpose;
  seatClass?: string;
  seat?: string;
  vehicleType?: string;
  notes?: string;
  tags?: string[];
  /** Preserved when an existing journey is edited. */
  createdAt?: string;
  now?: string;
};

const localDateTimePattern = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/;

function parseWallClock(value: string): WallClock | undefined {
  const match = localDateTimePattern.exec(value);
  if (!match?.groups) return undefined;

  const wallClock = {
    year: Number(match.groups.year),
    month: Number(match.groups.month),
    day: Number(match.groups.day),
    hour: Number(match.groups.hour),
    minute: Number(match.groups.minute),
  };
  const validationDate = new Date(Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
  ));

  if (
    validationDate.getUTCFullYear() !== wallClock.year
    || validationDate.getUTCMonth() !== wallClock.month - 1
    || validationDate.getUTCDate() !== wallClock.day
    || validationDate.getUTCHours() !== wallClock.hour
    || validationDate.getUTCMinutes() !== wallClock.minute
  ) return undefined;

  return wallClock;
}

function wallClockAsUtc(wallClock: WallClock): number {
  return Date.UTC(wallClock.year, wallClock.month - 1, wallClock.day, wallClock.hour, wallClock.minute);
}

function readWallClockAt(instant: number, timeZone: string): WallClock | undefined {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const fields = Object.fromEntries(
      formatter.formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );

    return {
      year: Number(fields.year),
      month: Number(fields.month),
      day: Number(fields.day),
      hour: Number(fields.hour),
      minute: Number(fields.minute),
    };
  } catch {
    return undefined;
  }
}

function isSameWallClock(left: WallClock, right: WallClock): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

/**
 * Turns a datetime-local value into an ISO instant in an IANA time zone.
 * A non-existent wall-clock time (during a daylight-saving jump) returns
 * undefined so the form can ask the user to choose a valid time.
 */
export function localDateTimeToIso(value: string, timeZone: string): string | undefined {
  const target = parseWallClock(value);
  if (!target) return undefined;

  const targetAsUtc = wallClockAsUtc(target);
  let instant = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const inZone = readWallClockAt(instant, timeZone);
    if (!inZone) return undefined;
    const offset = wallClockAsUtc(inZone) - instant;
    const candidate = targetAsUtc - offset;
    const confirmed = readWallClockAt(candidate, timeZone);

    if (confirmed && isSameWallClock(confirmed, target)) return new Date(candidate).toISOString();
    instant = candidate;
  }

  return undefined;
}

function roundedDistanceKm(origin: Place, destination: Place): number {
  const distance = greatCircleDistanceKm(
    [origin.longitude, origin.latitude],
    [destination.longitude, destination.latitude],
  );
  return Math.round(distance * 10) / 10;
}

/**
 * Builds a local-first trip record from the add-journey form. The distance is a
 * great-circle estimate between the saved endpoints, not a provider itinerary.
 */
export function buildManualTrip(input: ManualJourneyInput): Trip {
  const departure = localDateTimeToIso(input.departureLocal, input.origin.time_zone);
  const arrival = localDateTimeToIso(input.arrivalLocal, input.destination.time_zone);
  if (!departure || !arrival) {
    throw new Error("Choose valid local departure and arrival times.");
  }

  const duration = Math.round((Date.parse(arrival) - Date.parse(departure)) / 60_000);
  if (duration <= 0) throw new Error("Arrival must be after departure.");

  const now = input.now ?? new Date().toISOString();
  return TripSchema.parse({
    id: input.id,
    mode: input.mode,
    origin: input.origin,
    destination: input.destination,
    departure,
    arrival,
    carrier: input.carrier?.trim() ?? "",
    carrier_code: input.carrierCode,
    carrier_logo_url: input.carrierLogoUrl,
    service_number: input.serviceNumber?.trim() ?? "",
    purpose: input.purpose,
    seat_class: input.seatClass?.trim() ?? "",
    seat: input.seat?.trim() ?? "",
    vehicle_type: input.vehicleType?.trim() || undefined,
    distance_km: roundedDistanceKm(input.origin, input.destination),
    distance_is_estimate: true,
    duration_min: duration,
    notes: input.notes?.trim() ?? "",
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    is_demo: false,
    created_at: input.createdAt ?? now,
    updated_at: now,
  });
}
