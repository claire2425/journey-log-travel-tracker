import { z } from "zod";

const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

export const AutomaticExchangeRateQuoteSchema = z.object({
  source_currency: CurrencyCodeSchema,
  target_currency: CurrencyCodeSchema,
  rate: z.string().regex(/^\d+(?:\.\d+)?$/),
  rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provider: z.literal("Frankfurter"),
  quoted_at: z.string().datetime({ offset: true }),
});

export type AutomaticExchangeRateQuote = z.infer<typeof AutomaticExchangeRateQuoteSchema>;
