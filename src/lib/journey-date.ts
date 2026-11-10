import type { Trip } from "@/lib/types";

type DepartureJourney = Pick<Trip, "departure" | "origin">;

type LocalDateTimeFields = {
  year: string;
  month: string;
  day: string;
  hour?: string;
  minute?: string;
};

function utcDatePart(instant: string): string {
  const date = new Date(instant);
  if (Number.isFinite(date.getTime())) return date.toISOString().slice(0, 10);
  return instant.slice(0, 10);
}

/**
 * Returns the calendar date at the journey's departure point. Journey instants
 * are stored in UTC, but a travel log's date and year should reflect the local
 * date the traveller departed, not the UTC calendar.
 *
 * An invalid legacy time zone falls back to the stored UTC date so one corrupt
 * local place cannot prevent the rest of the journey log from loading.
 */
export function getJourneyDepartureLocalDate(trip: DepartureJourney): string {
  const instant = new Date(trip.departure);
  if (!Number.isFinite(instant.getTime())) return utcDatePart(trip.departure);

  try {
    const fields = readLocalDateTimeFields(instant, trip.origin.time_zone);
    const year = fields.year;
    const month = fields.month;
    const day = fields.day;
    if (!/^\d{4}$/.test(year ?? "") || !/^\d{2}$/.test(month ?? "") || !/^\d{2}$/.test(day ?? "")) {
      return utcDatePart(trip.departure);
    }
    return `${year}-${month}-${day}`;
  } catch {
    return utcDatePart(trip.departure);
  }
}

export function getJourneyDepartureLocalYear(trip: DepartureJourney): number {
  return Number(getJourneyDepartureLocalDate(trip).slice(0, 4));
}

function readLocalDateTimeFields(instant: Date, timeZone: string): LocalDateTimeFields {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      calendar: "iso8601",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      numberingSystem: "latn",
      timeZone,
      year: "numeric",
    }).formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as LocalDateTimeFields;
}

/**
 * Formats a stored instant for an HTML datetime-local input at a place's local
 * time. This preserves the traveller-facing wall-clock time while editing a
 * journey, rather than exposing the stored UTC instant.
 */
export function getLocalDateTimeInputValue(instantValue: string, timeZone: string): string | undefined {
  const instant = new Date(instantValue);
  if (!Number.isFinite(instant.getTime())) return undefined;

  try {
    const fields = readLocalDateTimeFields(instant, timeZone);
    if (
      !/^\d{4}$/.test(fields.year)
      || !/^\d{2}$/.test(fields.month)
      || !/^\d{2}$/.test(fields.day)
      || !/^\d{2}$/.test(fields.hour ?? "")
      || !/^\d{2}$/.test(fields.minute ?? "")
    ) return undefined;
    return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
  } catch {
    return undefined;
  }
}
