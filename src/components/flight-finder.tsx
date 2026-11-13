"use client";

import { useEffect, useMemo, useState } from "react";
import { airlinesInResults, type FlightOption } from "@/lib/flight-schedules";
import { lookupOperator } from "@/lib/operator-directory";
import type { Place } from "@/lib/types";

type Language = "zh" | "en";

const copy = {
  zh: {
    title: "查詢這天的航班",
    hint: "不記得班號也沒關係：選日期後列出這條航線當天的航班，點一班就會帶入班號、航空公司與起降時間。仍可手動修改。",
    privacy: "只會送出兩個機場代碼與日期給 AeroDataBox，不會送出你的旅程資料。",
    date: "飛行日期",
    search: "查詢航班",
    searching: "查詢中⋯",
    allAirlines: "全部航空公司",
    pick: "帶入",
    picked: "已帶入",
    codeshare: "共掛",
    empty: "這天沒有找到這條航線的直飛航班。太久以前的航班可能查不到，仍可手動輸入。",
    quota: "本月航班查詢額度已用完，請先手動輸入班號或航空公司。",
    unavailable: "暫時查不到航班資料，請稍後再試，或直接手動輸入。",
    chooseDate: "請先選擇日期。",
    count: "班",
  },
  en: {
    title: "Find flights on this day",
    hint: "Don't remember the flight number? Pick the date to list flights on this route that day; choosing one fills in the number, airline and times. You can still edit them.",
    privacy: "Only the two airport codes and the date are sent to AeroDataBox — never your journey details.",
    date: "Flight date",
    search: "Find flights",
    searching: "Searching…",
    allAirlines: "All airlines",
    pick: "Use",
    picked: "Used",
    codeshare: "Codeshare",
    empty: "No direct flights found on this route that day. Very old flights may be unavailable; you can still enter it manually.",
    quota: "This month's flight lookup quota is used up. Enter the flight number or airline manually for now.",
    unavailable: "Flight data isn't available right now. Try again later or enter it manually.",
    chooseDate: "Choose a date first.",
    count: "flights",
  },
} as const;

let configuredPromise: Promise<boolean> | undefined;

/** Asks the server once per page whether a flight data key is configured. */
function isFlightLookupConfigured(): Promise<boolean> {
  configuredPromise ??= fetch("/api/flights/search?status=1")
    .then((response) => (response.ok ? response.json() : { configured: false }))
    .then((body: { configured?: boolean }) => body.configured === true)
    .catch(() => false);
  return configuredPromise;
}

function hasIataCode(place: Place) {
  return place.kind === "airport" && /^[A-Z0-9]{3}$/.test(place.code.trim().toUpperCase());
}

/** Uses the app's own airline names (e.g. 長榮航空) when the operator is known. */
function airlineLabel(flight: Pick<FlightOption, "airline_name" | "airline_iata">, language: Language) {
  const operator = flight.airline_iata ? lookupOperator(flight.airline_iata, "flight") : undefined;
  if (!operator) return flight.airline_name;
  return language === "zh" ? operator.label_zh : operator.label;
}

function timeOf(value: string | undefined) {
  return value?.slice(11, 16) ?? "—";
}

export function FlightFinder({ destination, initialDate, language, onPick, origin }: {
  destination: Place;
  initialDate: string;
  language: Language;
  onPick: (flight: FlightOption) => void;
  origin: Place;
}) {
  const c = copy[language];
  const [configured, setConfigured] = useState(false);
  const [date, setDate] = useState(initialDate);
  const [flights, setFlights] = useState<FlightOption[] | null>(null);
  const [airline, setAirline] = useState("");
  const [status, setStatus] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pickedNumber, setPickedNumber] = useState("");

  useEffect(() => {
    let active = true;
    void isFlightLookupConfigured().then((value) => { if (active) setConfigured(value); });
    return () => { active = false; };
  }, []);

  // A new route or departure date invalidates earlier results.
  const routeKey = `${origin.code}-${destination.code}`;
  const [lastRouteKey, setLastRouteKey] = useState(routeKey);
  if (routeKey !== lastRouteKey) {
    setLastRouteKey(routeKey);
    setFlights(null);
    setAirline("");
    setStatus("");
    setPickedNumber("");
  }
  const [lastInitialDate, setLastInitialDate] = useState(initialDate);
  if (initialDate !== lastInitialDate) {
    setLastInitialDate(initialDate);
    if (initialDate) setDate(initialDate);
  }

  const airlines = useMemo(() => (flights ? airlinesInResults(flights) : []), [flights]);
  const shown = useMemo(() => (flights ?? []).filter((flight) => !airline || flight.airline_name === airline), [airline, flights]);

  if (!configured || !hasIataCode(origin) || !hasIataCode(destination)) return null;

  async function search() {
    if (!date) return setStatus(c.chooseDate);
    setIsSearching(true);
    setStatus("");
    setPickedNumber("");
    try {
      const params = new URLSearchParams({ from: origin.code.trim().toUpperCase(), to: destination.code.trim().toUpperCase(), date });
      const response = await fetch(`/api/flights/search?${params}`);
      const body = await response.json().catch(() => ({})) as { flights?: FlightOption[]; error?: string };
      if (!response.ok || !Array.isArray(body.flights)) {
        setFlights(null);
        setStatus(body.error === "quota_exceeded" ? c.quota : c.unavailable);
        return;
      }
      setFlights(body.flights);
      setAirline("");
      if (!body.flights.length) setStatus(c.empty);
    } catch {
      setFlights(null);
      setStatus(c.unavailable);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <section aria-label={c.title} className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-900 dark:bg-teal-950/30">
      <h3 className="font-bold text-slate-900 dark:text-white">{c.title} · {origin.code} → {destination.code}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{c.hint}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
          {c.date}
          <input className="mt-2 block rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal text-slate-900 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60" disabled={isSearching} onClick={() => void search()} type="button">{isSearching ? c.searching : c.search}</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{c.privacy}</p>
      {status ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200" role="status">{status}</p> : null}

      {flights && flights.length ? <>
        {airlines.length > 1 ? <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={c.allAirlines}>
          {["", ...airlines].map((name) => <button aria-pressed={airline === name} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${airline === name ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`} key={name || "all"} onClick={() => setAirline(name)} type="button">{name ? airlineLabel({ airline_name: name, airline_iata: flights.find((flight) => flight.airline_name === name)?.airline_iata }, language) : c.allAirlines}</button>)}
        </div> : null}
        <p className="mt-3 text-xs font-semibold text-slate-500">{shown.length} {c.count}</p>
        <ul className="mt-2 grid gap-2">
          {shown.map((flight) => {
            const isPicked = pickedNumber === `${flight.flight_number}-${flight.departure_local}`;
            return <li key={`${flight.flight_number}-${flight.departure_local}`}>
              <button className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3 py-2.5 text-left text-sm transition ${isPicked ? "border-teal-700 bg-teal-100 dark:bg-teal-900" : "border-slate-200 bg-white hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900"}`} onClick={() => { onPick(flight); setPickedNumber(`${flight.flight_number}-${flight.departure_local}`); }} type="button">
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{timeOf(flight.departure_local)} → {timeOf(flight.arrival_local)}</span>
                <span className="font-bold text-teal-800 dark:text-teal-200">{flight.flight_number}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{airlineLabel(flight, language)}{flight.aircraft ? ` · ${flight.aircraft}` : ""}{flight.departure_terminal ? ` · T${flight.departure_terminal}` : ""}</span>
                {flight.codeshares.length ? <span className="w-full text-xs text-slate-500 sm:w-auto">{c.codeshare}: {flight.codeshares.join(", ")}</span> : null}
                <span className="text-xs font-bold text-teal-700 dark:text-teal-300">{isPicked ? c.picked : c.pick}</span>
              </button>
            </li>;
          })}
        </ul>
      </> : null}
    </section>
  );
}
