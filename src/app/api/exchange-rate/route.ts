import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AutomaticExchangeRateQuoteSchema } from "@/lib/exchange-rates";

const CurrencyCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const requestSchema = z.object({
  from: CurrencyCodeSchema,
  to: CurrencyCodeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const frankfurterResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: CurrencyCodeSchema,
  quote: CurrencyCodeSchema,
  rate: z.number().finite().positive(),
});

function unavailable() {
  return NextResponse.json({ error: "rate_unavailable" }, { status: 502 });
}

/**
 * Fetches a historical reference rate on demand. The external request contains
 * only currency codes and the selected date; no expense details leave the app.
 */
export async function GET(request: NextRequest) {
  const parsed = requestSchema.safeParse({
    from: request.nextUrl.searchParams.get("from") ?? "",
    to: request.nextUrl.searchParams.get("to") ?? "",
    date: request.nextUrl.searchParams.get("date") ?? "",
  });

  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { from, to, date } = parsed.data;
  const quotedAt = new Date().toISOString();
  if (from === to) {
    return NextResponse.json(AutomaticExchangeRateQuoteSchema.parse({
      source_currency: from,
      target_currency: to,
      rate: "1",
      rate_date: date,
      provider: "Frankfurter",
      quoted_at: quotedAt,
    }));
  }

  try {
    // Expenses are often logged ahead of a trip (a prepaid hotel, a rail
    // pass). No reference rate exists for a future date yet, so use the latest
    // published one; its own rate_date is returned and shown with the quote.
    const isFutureDate = date > new Date().toISOString().slice(0, 10);
    const query = isFutureDate ? "" : `?date=${encodeURIComponent(date)}`;
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return unavailable();
    const data = frankfurterResponseSchema.safeParse(await response.json());
    if (!data.success || data.data.base !== from || data.data.quote !== to) return unavailable();

    return NextResponse.json(AutomaticExchangeRateQuoteSchema.parse({
      source_currency: from,
      target_currency: to,
      rate: String(data.data.rate),
      rate_date: data.data.date,
      provider: "Frankfurter",
      quoted_at: quotedAt,
    }));
  } catch {
    return unavailable();
  }
}
