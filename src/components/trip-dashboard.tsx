"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clearDemoTrips, listTrips, loadDemoTrips, type TripFilters } from "@/db/trips";
import { calculateJourneyStatistics } from "@/lib/statistics";
import type { Trip, TripMode } from "@/lib/types";

type Language = "zh" | "en";

const copy = {
  zh: {
    eyebrow: "你的旅程，你的裝置",
    title: "Journey Log",
    subtitle: "私密、以裝置為先的飛行與鐵路旅程紀錄。資料只儲存在這個瀏覽器。",
    sample: "載入示範旅程",
    clear: "清除示範資料",
    loading: "正在讀取旅程⋯",
    searchLabel: "搜尋旅程",
    searchPlaceholder: "城市、代碼、航空公司或標籤",
    yearLabel: "年份",
    allYears: "所有年份",
    modeLabel: "交通方式",
    allModes: "所有方式",
    visible: "目前顯示",
    journeys: "趟旅程",
    distance: "總距離",
    duration: "旅途時間",
    countries: "到訪國家／地區",
    emptyTitle: "還沒有旅程",
    emptyBody: "先載入示範資料，看看 Journey Log 將如何整理你的移動軌跡。",
    noResultsTitle: "沒有符合的旅程",
    noResultsBody: "調整搜尋字詞或篩選條件後再試一次。",
    sampleNote: "示範旅程皆為虛構；地點座標為公開、近似的位置資訊，僅供展示使用。",
    local: "只儲存在這個裝置",
    demo: "示範資料",
    trip: "旅程",
    filterCount: "個篩選條件",
    clearFilters: "清除篩選",
    loadSuccess: "已載入示範旅程。",
    clearSuccess: "已清除示範旅程。",
  },
  en: {
    eyebrow: "YOUR TRAVEL, YOUR DEVICE",
    title: "Journey Log",
    subtitle: "Private, local-first records for flights and rail journeys. Your data stays in this browser.",
    sample: "Load sample journeys",
    clear: "Clear sample data",
    loading: "Loading journeys…",
    searchLabel: "Search journeys",
    searchPlaceholder: "City, code, carrier, or tag",
    yearLabel: "Year",
    allYears: "All years",
    modeLabel: "Travel mode",
    allModes: "All modes",
    visible: "Showing",
    journeys: "journeys",
    distance: "Distance",
    duration: "Travel time",
    countries: "Countries / regions",
    emptyTitle: "No journeys yet",
    emptyBody: "Load the sample journeys to see how Journey Log can organise your travel story.",
    noResultsTitle: "No matching journeys",
    noResultsBody: "Try changing the search or filters.",
    sampleNote: "All sample journeys are fictional. Place coordinates are public, approximate display data only.",
    local: "Saved on this device",
    demo: "Sample data",
    trip: "journey",
    filterCount: "active filters",
    clearFilters: "Clear filters",
    loadSuccess: "Sample journeys loaded.",
    clearSuccess: "Sample journeys cleared.",
  },
} as const;

const modeLabels: Record<Language, Record<TripMode, string>> = {
  zh: { flight: "飛行", hsr: "高鐵", rail: "鐵路", other: "其他" },
  en: { flight: "Flight", hsr: "High-speed rail", rail: "Rail", other: "Other" },
};

const modeOrder: TripMode[] = ["flight", "hsr", "rail", "other"];

function formatDate(value: string, language: Language) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat(language === "zh" ? "zh-TW" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDuration(minutes: number, language: Language) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return language === "zh" ? `${hours} 小時 ${remainder} 分` : `${hours}h ${remainder}m`;
}

function StatsCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}

function TripCard({ trip, language }: { trip: Trip; language: Language }) {
  const c = copy[language];
  const number = new Intl.NumberFormat(language === "zh" ? "zh-TW" : "en-GB").format(Math.round(trip.distance_km));
  const names = language === "zh" ? { origin: trip.origin.name_zh, destination: trip.destination.name_zh } : { origin: trip.origin.name_en, destination: trip.destination.name_en };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">{modeLabels[language][trip.mode]}</span>
          {trip.is_demo ? <span className="text-xs font-medium text-slate-500">{c.demo}</span> : null}
        </div>
        <time className="text-sm font-medium text-slate-500">{formatDate(trip.departure, language)}</time>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-slate-950 dark:text-white">{names.origin}</p>
          <p className="mt-1 text-sm text-slate-500">{trip.origin.code}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center text-teal-700 dark:text-teal-300" aria-hidden="true">
          <span className="text-lg">→</span>
          <span className="mt-1 h-px w-8 bg-teal-300" />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-xl font-bold text-slate-950 dark:text-white">{names.destination}</p>
          <p className="mt-1 text-sm text-slate-500">{trip.destination.code}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
        <div><p className="text-slate-500">{trip.carrier}</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{trip.service_number}</p></div>
        <div><p className="text-slate-500">{language === "zh" ? "距離" : "Distance"}</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{number} km</p></div>
        <div><p className="text-slate-500">{language === "zh" ? "時間" : "Time"}</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{formatDuration(trip.duration_min, language)}</p></div>
      </div>

      {trip.tags.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{trip.tags.map((tag) => <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300" key={tag}>{tag}</span>)}</div> : null}
    </article>
  );
}

export function TripDashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [filters, setFilters] = useState<TripFilters>({});
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const c = copy[language];

  const readTrips = useCallback((activeFilters: TripFilters) => Promise.all([listTrips(), listTrips(activeFilters)]), []);

  useEffect(() => {
    let cancelled = false;

    void readTrips(filters).then(([all, filtered]) => {
      if (cancelled) return;
      setAllTrips(all);
      setTrips(filtered);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filters, readTrips]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-Hant" : "en";
  }, [language]);

  const years = useMemo(() => [...new Set(allTrips.map((trip) => new Date(trip.departure).getUTCFullYear()))].sort((a, b) => b - a), [allTrips]);
  const statistics = useMemo(() => calculateJourneyStatistics(trips), [trips]);
  const activeFilterCount = Number(Boolean(filters.search)) + Number(Boolean(filters.mode)) + Number(Boolean(filters.year));
  const hasDemoTrips = allTrips.some((trip) => trip.is_demo);

  const updateFilters = (next: TripFilters) => {
    setIsLoading(true);
    setFilters(next);
  };

  async function handleLoadSample() {
    setIsSaving(true);
    const nextFilters: TripFilters = {};
    setIsLoading(true);
    setFilters(nextFilters);
    await loadDemoTrips();
    const [all, filtered] = await readTrips(nextFilters);
    setAllTrips(all);
    setTrips(filtered);
    setIsLoading(false);
    setStatus(c.loadSuccess);
    setIsSaving(false);
  }

  async function handleClearSample() {
    setIsSaving(true);
    setIsLoading(true);
    await clearDemoTrips();
    const [all, filtered] = await readTrips(filters);
    setAllTrips(all);
    setTrips(filtered);
    setIsLoading(false);
    setStatus(c.clearSuccess);
    setIsSaving(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex flex-col gap-7 border-b border-slate-200 pb-8 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.22em] text-teal-700 dark:text-teal-300">{c.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{c.title}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{c.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 self-start">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200">{c.local}</span>
            <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700" aria-label="Language">
              {(["zh", "en"] as Language[]).map((item) => <button className={`rounded-lg px-2.5 py-1 text-xs font-bold ${language === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500"}`} key={item} onClick={() => setLanguage(item)} type="button">{item === "zh" ? "繁中" : "EN"}</button>)}
            </div>
          </div>
        </header>

        <section className="mt-8 flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-300">{c.visible} {allTrips.length} {allTrips.length === 1 ? c.trip : c.journeys}</p>
            <p className="mt-1 text-sm text-slate-300">{c.sampleNote}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-teal-950 transition hover:bg-teal-300 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} onClick={() => void handleLoadSample()} type="button">{isSaving ? c.loading : c.sample}</button>
            {hasDemoTrips ? <button className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold text-white transition hover:border-slate-400 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} onClick={() => void handleClearSample()} type="button">{c.clear}</button> : null}
          </div>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={c.visible}>
          <StatsCard label={c.journeys} value={String(statistics.totalTrips)} />
          <StatsCard label={c.distance} value={`${new Intl.NumberFormat(language === "zh" ? "zh-TW" : "en-GB").format(Math.round(statistics.totalDistanceKm))} km`} />
          <StatsCard label={c.duration} value={formatDuration(statistics.totalDurationMin, language)} />
          <StatsCard label={c.countries} value={String(statistics.countriesVisited)} />
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-[1.5fr_0.7fr_0.8fr_auto] md:items-end">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {c.searchLabel}
              <input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => updateFilters({ ...filters, search: event.target.value || undefined })} placeholder={c.searchPlaceholder} value={filters.search ?? ""} />
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {c.yearLabel}
              <select className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => updateFilters({ ...filters, year: event.target.value ? Number(event.target.value) : undefined })} value={filters.year ?? ""}>
                <option value="">{c.allYears}</option>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {c.modeLabel}
              <select className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => updateFilters({ ...filters, mode: (event.target.value || undefined) as TripMode | undefined })} value={filters.mode ?? ""}>
                <option value="">{c.allModes}</option>
                {modeOrder.map((mode) => <option key={mode} value={mode}>{modeLabels[language][mode]}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-3 pb-0.5">
              {activeFilterCount > 0 ? <><span className="text-sm text-slate-500">{activeFilterCount} {c.filterCount}</span><button className="text-sm font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300" onClick={() => updateFilters({})} type="button">{c.clearFilters}</button></> : null}
            </div>
          </div>
        </section>

        <p aria-live="polite" className="mt-4 min-h-5 text-sm font-medium text-teal-700 dark:text-teal-300">{status}</p>

        <section className="mt-3" aria-live="polite">
          {isLoading ? <p className="py-14 text-center text-slate-500">{c.loading}</p> : null}
          {!isLoading && allTrips.length === 0 ? <EmptyState title={c.emptyTitle} body={c.emptyBody} /> : null}
          {!isLoading && allTrips.length > 0 && trips.length === 0 ? <EmptyState title={c.noResultsTitle} body={c.noResultsBody} /> : null}
          {!isLoading && trips.length > 0 ? <div className="grid gap-4 lg:grid-cols-2">{trips.map((trip) => <TripCard key={trip.id} language={language} trip={trip} />)}</div> : null}
        </section>
      </div>
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-bold">{title}</h2><p className="mx-auto mt-3 max-w-md leading-7 text-slate-500">{body}</p></div>;
}
