/**
 * Returns today's calendar date in the requested IANA time zone. A date input
 * represents a human calendar day, so it must not be derived from UTC around
 * local midnight.
 */
export function getLocalCalendarDate(now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  try {
    const fields = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        calendar: "iso8601",
        day: "2-digit",
        month: "2-digit",
        numberingSystem: "latn",
        timeZone,
        year: "numeric",
      }).formatToParts(now)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    ) as { year?: string; month?: string; day?: string };

    if (/^\d{4}$/.test(fields.year ?? "") && /^\d{2}$/.test(fields.month ?? "") && /^\d{2}$/.test(fields.day ?? "")) {
      return `${fields.year}-${fields.month}-${fields.day}`;
    }
  } catch {
    // A malformed legacy browser time zone should not prevent a blank form.
  }

  return now.toISOString().slice(0, 10);
}
