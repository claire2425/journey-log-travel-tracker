import { z } from "zod";

export const placeKinds = ["airport", "station", "custom"] as const;
export const tripModes = ["flight", "hsr", "rail", "other"] as const;

const CurrencyCodeSchema = z.string().trim().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");

export const ExpenseMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
});

export const ExpenseLedgerSettingsSchema = z.object({
  id: z.literal("expense-ledger"),
  members: z.array(ExpenseMemberSchema),
  categories: z.array(z.string().trim().min(1).max(40)),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).superRefine((settings, ctx) => {
  const memberIds = settings.members.map((member) => member.id);
  if (new Set(memberIds).size !== memberIds.length) {
    ctx.addIssue({ code: "custom", path: ["members"], message: "Member IDs must be unique." });
  }
  const categoryKeys = settings.categories.map((category) => category.toLocaleLowerCase());
  if (new Set(categoryKeys).size !== categoryKeys.length) {
    ctx.addIssue({ code: "custom", path: ["categories"], message: "Categories must be unique." });
  }
});

export const ExpenseSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40),
  amount_minor: z.number().int().positive().lte(Number.MAX_SAFE_INTEGER),
  currency: CurrencyCodeSchema,
  fraction_digits: z.number().int().gte(0).lte(3),
  paid_by: z.string().min(1),
  shares: z.array(z.object({
    member_id: z.string().min(1),
    amount_minor: z.number().int().nonnegative().lte(Number.MAX_SAFE_INTEGER),
  })).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).superRefine((expense, ctx) => {
  const memberIds = expense.shares.map((share) => share.member_id);
  if (new Set(memberIds).size !== memberIds.length) {
    ctx.addIssue({ code: "custom", path: ["shares"], message: "Participants must be unique." });
  }
  if (expense.shares.reduce((sum, share) => sum + share.amount_minor, 0) !== expense.amount_minor) {
    ctx.addIssue({ code: "custom", path: ["shares"], message: "Shares must add up to the expense amount." });
  }
});

export const PlaceSchema = z.object({
  id: z.string().min(1),
  name_zh: z.string().min(1),
  name_en: z.string().min(1),
  code: z.string().min(1),
  kind: z.enum(placeKinds),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  country: z.string().min(1),
  time_zone: z.string().min(1),
});

export const TripSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(tripModes),
  origin: PlaceSchema,
  destination: PlaceSchema,
  departure: z.string().datetime({ offset: true }),
  arrival: z.string().datetime({ offset: true }),
  carrier: z.string().trim(),
  service_number: z.string().trim(),
  seat_class: z.string().trim(),
  seat: z.string().trim(),
  vehicle_type: z.string().trim().optional(),
  distance_km: z.number().nonnegative(),
  distance_is_estimate: z.boolean(),
  duration_min: z.number().int().positive(),
  notes: z.string().trim(),
  tags: z.array(z.string().trim()).default([]),
  is_demo: z.boolean().default(false),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).superRefine((trip, ctx) => {
  if (Date.parse(trip.arrival) <= Date.parse(trip.departure)) {
    ctx.addIssue({ code: "custom", path: ["arrival"], message: "Arrival must be after departure." });
  }
});

export type Place = z.infer<typeof PlaceSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type TripMode = Trip["mode"];
export type ExpenseMember = z.infer<typeof ExpenseMemberSchema>;
export type ExpenseLedgerSettings = z.infer<typeof ExpenseLedgerSettingsSchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
