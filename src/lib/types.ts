import { z } from "zod";

export const placeKinds = ["airport", "station", "custom"] as const;
export const tripModes = ["flight", "hsr", "rail", "other"] as const;

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
