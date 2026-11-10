import type { Trip } from "@/lib/types";

type DepartureJourney = Pick<Trip, "departure" | "origin">;

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
    const fields = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        calendar: "iso8601",
        day: "2-digit",
        month: "2-digit",
        numberingSystem: "latn",
        timeZone: trip.origin.time_zone,
        year: "numeric",
      }).formatToParts(instant)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
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
