"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddJourneyForm } from "@/components/add-journey-form";
import { AppNavigation } from "@/components/app-navigation";
import { TripMap } from "@/components/trip-map";
import { TravelRecapExport } from "@/components/travel-recap-export";
import { listCustomPlaces } from "@/db/places";
import { CustomPlaceInUseError, deleteCustomPlace, saveJourneyWithCustomPlaces, updateCustomPlaceAndJourneyReferences } from "@/db/journey-storage";
import { clearDemoTrips, deleteTrip, listTrips, loadDemoTrips, type TripFilters } from "@/db/trips";
import { REFERENCE_PLACES } from "@/lib/demo-trips";
import { getPlaceContinent, getTripDistanceBand } from "@/lib/geography";
import { hasAllSelections, toggleAllSelections, toggleSelection } from "@/lib/filter-selection";
import { modeColor } from "@/lib/journey-colors";
import { getJourneyDepartureLocalDate, getJourneyDepartureLocalYear } from "@/lib/journey-date";
import { lookupOperator } from "@/lib/operator-directory";
import { displayPlaceCode } from "@/lib/place-display";
import { calculateJourneyStatistics, earthLapsForDistance } from "@/lib/statistics";
import { buildTravelRecap } from "@/lib/travel-recap";
import { continentFilters, journeyDistanceBands, tripPurposes, type Continent, type ContinentFilter, type DistanceBand, type Place, type Trip, type TripMode, type TripPurposeFilter } from "@/lib/types";
import { calculateAnnualVisitStatistics } from "@/lib/visit-statistics";

type Language = "zh" | "en";

const copy = {
  zh: {
    eyebrow: "你的旅程，你的裝置",
    title: "Journey Log",
    subtitle: "私密、以裝置為先的飛行、火車／高鐵與郵輪旅程紀錄。資料只儲存在這個瀏覽器。",
    sample: "載入示範旅程",
    clear: "清除示範資料",
    addJourneySuccess: "已儲存你的旅程。",
    loading: "正在讀取旅程⋯",
    searchLabel: "搜尋旅程",
    searchPlaceholder: "城市、代碼、航空公司或標籤",
    filterHint: "同一類條件可複選；不同類別會同時套用。",
    yearLabel: "年份",
    allYears: "所有年份",
    modeLabel: "交通方式",
    allModes: "所有方式",
    continentLabel: "洲別（起點或終點）",
    distanceBandLabel: "旅程距離",
    purposeLabel: "旅程目的",
    visible: "目前顯示",
    journeys: "趟旅程",
    distance: "總距離",
    duration: "旅途時間",
    countries: "到訪國家／地區",
    emptyTitle: "還沒有旅程",
    emptyBody: "使用上方的新增旅程表單，或載入示範資料來看看 Journey Log 如何整理你的移動軌跡。",
    noResultsTitle: "沒有符合的旅程",
    noResultsBody: "調整搜尋字詞或篩選條件後再試一次。",
    sampleNote: "示範旅程皆為虛構；地點座標為公開、近似的位置資訊，僅供展示使用。",
    local: "只儲存在這個裝置",
    demo: "示範資料",
    trip: "旅程",
    filterCount: "個篩選條件",
    clearFilters: "清除篩選",
    selectAll: "全選",
    clearAll: "取消全選",
    loadSuccess: "已載入示範旅程。",
    clearSuccess: "已清除示範旅程。",
    mapTitle: "你的旅行足跡",
    mapBody: "依目前顯示的旅程，以起訖點的近似連線繪製路線與站點；對向路線會以較粗線標示，點選路線或站點可查看資訊。",
    mapEmpty: "載入示範資料後，或新增自己的旅程後，路線與站點會出現在這裡。",
    storageError: "無法讀取這個瀏覽器的本機資料。請重新整理後再試一次。",
    updateJourneySuccess: "已更新旅程。",
    addJourneyHidden: "已儲存旅程，但它不符合目前套用的篩選條件。",
    deleteJourney: "刪除旅程",
    editJourney: "編輯旅程",
    deleteJourneyConfirm: "確定要刪除這趟旅程嗎？此動作無法復原。",
    journeyDeleted: "已刪除旅程。",
    savedPlaces: "已儲存的地點",
    savedPlacesHint: "手動新增的地點與已選擇的全球參考地點都會保存在這裡。可補上舊地點的洲別；仍被旅程使用的地點不能刪除，以保留歷史紀錄。",
    noSavedPlaces: "尚未儲存任何地點。",
    deletePlace: "刪除地點",
    deletePlaceConfirm: "確定要刪除這個未使用的地點嗎？此動作無法復原。",
    placeDeleted: "已刪除地點。",
    placeInUse: "這個地點正在被旅程使用，因此不能刪除。",
    placeContinent: "洲別",
    placeContinentSaved: "已更新地點洲別和相關旅程。",
    unclassifiedContinent: "未分類",
    mapConsentTitle: "載入互動地圖",
    mapConsentBody: "互動底圖來自 OpenStreetMap。按下後，瀏覽器會向該服務請求地圖圖磚（服務可看到 IP 位址和檢視範圍）；Journey Log 不會把旅程資料上傳給它。",
    mapConsentButton: "載入地圖",
    mapPrivacy: "尚未載入底圖，因此目前沒有向地圖服務提出網路請求。",
    languageLabel: "語言",
    annualVisits: "年度足跡統計",
    annualVisitsHint: "依目前顯示的旅程與出發地當地年份計算；同一年中，起點和終點都會列入造訪。城市採自訂城市欄位，舊紀錄未填時會以地點名稱計算。",
    annualYear: "年份",
    annualContinents: "洲別",
    annualCountries: "國家／地區",
    annualCities: "城市／地點",
  },
  en: {
    eyebrow: "YOUR TRAVEL, YOUR DEVICE",
    title: "Journey Log",
    subtitle: "Private, local-first records for flights, rail journeys including high-speed rail, and cruises. Your data stays in this browser.",
    sample: "Load sample journeys",
    clear: "Clear sample data",
    addJourneySuccess: "Your journey has been saved.",
    loading: "Loading journeys…",
    searchLabel: "Search journeys",
    searchPlaceholder: "City, code, carrier, or tag",
    filterHint: "Select multiple values in a group; different groups are combined together.",
    yearLabel: "Year",
    allYears: "All years",
    modeLabel: "Travel mode",
    allModes: "All modes",
    continentLabel: "Continent (origin or destination)",
    distanceBandLabel: "Journey distance",
    purposeLabel: "Journey purpose",
    visible: "Showing",
    journeys: "journeys",
    distance: "Distance",
    duration: "Travel time",
    countries: "Countries / regions",
    emptyTitle: "No journeys yet",
    emptyBody: "Use the add-journey form above, or load sample journeys to see how Journey Log can organise your travel story.",
    noResultsTitle: "No matching journeys",
    noResultsBody: "Try changing the search or filters.",
    sampleNote: "All sample journeys are fictional. Place coordinates are public, approximate display data only.",
    local: "Saved on this device",
    demo: "Sample data",
    trip: "journey",
    filterCount: "active filters",
    clearFilters: "Clear filters",
    selectAll: "Select all",
    clearAll: "Clear all",
    loadSuccess: "Sample journeys loaded.",
    clearSuccess: "Sample journeys cleared.",
    mapTitle: "Your travel footprint",
    mapBody: "Approximate endpoint connections and stops are drawn from the journeys currently shown. Reverse routes use thicker lines; select a route or stop for details.",
    mapEmpty: "Load the sample data or add your own journey to see routes and stops here.",
    storageError: "This browser could not read its local data. Refresh the page and try again.",
    updateJourneySuccess: "Journey updated.",
    addJourneyHidden: "Journey saved, but it does not match the filters currently applied.",
    deleteJourney: "Delete journey",
    editJourney: "Edit journey",
    deleteJourneyConfirm: "Delete this journey? This cannot be undone.",
    journeyDeleted: "Journey deleted.",
    savedPlaces: "Saved places",
    savedPlacesHint: "Both manually added places and selected global reference places are saved here. You can add a continent to older places; a place still used by a journey cannot be deleted, so history remains intact.",
    noSavedPlaces: "No saved places yet.",
    deletePlace: "Delete place",
    deletePlaceConfirm: "Delete this unused place? This cannot be undone.",
    placeDeleted: "Place deleted.",
    placeInUse: "This place is still used by a journey, so it cannot be deleted.",
    placeContinent: "Continent",
    placeContinentSaved: "The place continent and related journeys were updated.",
    unclassifiedContinent: "Unclassified",
    mapConsentTitle: "Load interactive map",
    mapConsentBody: "The interactive basemap comes from OpenStreetMap. Loading it asks that service for map tiles (which can reveal your IP address and viewport); Journey Log does not upload your journey records to it.",
    mapConsentButton: "Load map",
    mapPrivacy: "The basemap is not loaded, so no request has been made to a map service.",
    languageLabel: "Language",
    annualVisits: "Yearly travel footprint",
    annualVisitsHint: "Uses the journeys currently shown and the departure location's calendar year. Both endpoints count as visited; a legacy place without a city uses its place name instead.",
    annualYear: "Year",
    annualContinents: "Continents",
    annualCountries: "Countries / regions",
    annualCities: "Cities / places",
  },
} as const;

const modeLabels: Record<Language, Record<TripMode, string>> = {
  zh: { flight: "飛行", rail: "火車／高鐵", cruise: "郵輪", other: "其他" },
  en: { flight: "Flight", rail: "Rail / high-speed rail", cruise: "Cruise", other: "Other" },
};

const modeOrder: TripMode[] = ["flight", "rail", "cruise", "other"];

const continentLabels: Record<string, Record<Language, string>> = {
  africa: { zh: "非洲", en: "Africa" },
  antarctica: { zh: "南極洲", en: "Antarctica" },
  asia: { zh: "亞洲", en: "Asia" },
  europe: { zh: "歐洲", en: "Europe" },
  north_america: { zh: "北美洲", en: "North America" },
  oceania: { zh: "大洋洲", en: "Oceania" },
  south_america: { zh: "南美洲", en: "South America" },
  unclassified: { zh: "未分類", en: "Unclassified" },
};

const distanceBandLabels: Record<DistanceBand, Record<Language, string>> = {
  short: { zh: "短程（少於 800 km）", en: "Short (under 800 km)" },
  medium: { zh: "中程（800–3,499 km）", en: "Medium (800–3,499 km)" },
  long: { zh: "長途（3,500 km 以上）", en: "Long-haul (3,500 km+)" },
};

const purposeLabels: Record<TripPurposeFilter, Record<Language, string>> = {
  leisure: { zh: "旅遊", en: "Leisure" },
  business: { zh: "出差", en: "Business" },
  personal: { zh: "探親／私人", en: "Personal" },
  other: { zh: "其他", en: "Other" },
  unclassified: { zh: "未設定", en: "Unclassified" },
};

const purposeFilterOrder = [...tripPurposes, "unclassified"] as const satisfies readonly TripPurposeFilter[];

function continentLabel(continent: ContinentFilter, language: Language): string {
  return continentLabels[continent]?.[language] ?? continent;
}

function distanceBandLabel(distanceBand: DistanceBand, language: Language): string {
  return distanceBandLabels[distanceBand][language];
}

function purposeLabel(purpose: TripPurposeFilter, language: Language): string {
  return purposeLabels[purpose][language];
}

function FilterChipGroup<T extends string | number>({
  clearAllLabel,
  label,
  onToggleAll,
  options,
  selected,
  selectAllLabel,
  onToggle,
  getLabel,
}: {
  clearAllLabel: string;
  label: string;
  onToggleAll: () => void;
  options: readonly T[];
  selected: readonly T[];
  selectAllLabel: string;
  onToggle: (value: T) => void;
  getLabel: (value: T) => string;
}) {
  const allSelected = hasAllSelections(selected, options);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.length ? <button
          aria-label={`${label}：${allSelected ? clearAllLabel : selectAllLabel}`}
          aria-pressed={allSelected}
          className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${allSelected ? "border-teal-700 bg-teal-700 text-white" : "border-slate-400 bg-white text-slate-800 hover:border-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"}`}
          onClick={onToggleAll}
          type="button"
        >
          {allSelected ? clearAllLabel : selectAllLabel}
        </button> : null}
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return <button aria-pressed={isSelected} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${isSelected ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-slate-50 text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"}`} key={String(option)} onClick={() => onToggle(option)} type="button">{getLabel(option)}</button>;
        })}
      </div>
    </fieldset>
  );
}

function formatDate(trip: Trip, language: Language) {
  const [year, month, day] = getJourneyDepartureLocalDate(trip).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
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

function formatDistance(distanceKm: number, language: Language) {
  return new Intl.NumberFormat(language === "zh" ? "zh-TW" : "en-GB").format(Math.round(distanceKm));
}

function formatJourneyDistance(distanceKm: number, language: Language) {
  return new Intl.NumberFormat(language === "zh" ? "zh-TW" : "en-GB", {
    maximumFractionDigits: 1,
  }).format(distanceKm);
}

function formatEarthLaps(distanceKm: number, language: Language) {
  const laps = earthLapsForDistance(distanceKm);

  if (laps === 0) return "0";
  if (laps < 0.01) return language === "zh" ? "少於 0.01" : "< 0.01";

  return new Intl.NumberFormat(language === "zh" ? "zh-TW" : "en-GB", {
    maximumFractionDigits: laps >= 10 ? 1 : 2,
    minimumFractionDigits: laps < 10 ? 2 : 0,
  }).format(laps);
}

function formatDistanceDetail(
  modeDistanceKm: Record<TripMode, number>,
  totalDistanceKm: number,
  language: Language,
) {
  const lapLabel = language === "zh" ? "圈" : "laps";
  const total = language === "zh"
    ? `約環繞地球 ${formatEarthLaps(totalDistanceKm, language)} ${lapLabel}`
    : `≈ ${formatEarthLaps(totalDistanceKm, language)} Earth ${lapLabel}`;
  const byMode = modeOrder
    .filter((mode) => modeDistanceKm[mode] > 0)
    .map((mode) => {
      const distance = formatDistance(modeDistanceKm[mode], language);
      const laps = formatEarthLaps(modeDistanceKm[mode], language);
      return language === "zh"
        ? `${modeLabels.zh[mode]} ${distance} km（${laps} ${lapLabel}）`
        : `${modeLabels.en[mode]} ${distance} km (${laps} ${lapLabel})`;
    });

  return [total, ...byMode].join(" · ");
}

function withTimeout<T>(task: Promise<T>, timeoutMs = 6000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Timed out while reading local data.")), timeoutMs);
    task.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    }, (error: unknown) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
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

function CarrierMark({ trip }: { trip: Trip }) {
  const operator = (trip.mode === "flight" || trip.mode === "rail" || trip.mode === "cruise") ? lookupOperator(trip.carrier_code ?? "", trip.mode) : undefined;
  const text = operator?.logo_text ?? trip.carrier_code ?? (trip.carrier.slice(0, 4).toUpperCase() || "—");
  // Do not fetch arbitrary carrier-logo URLs. A future licensed provider can
  // supply vetted local assets after the user has chosen to use that service.
  return <span aria-hidden="true" className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-xs font-black tracking-wide text-white" style={{ backgroundColor: operator?.brand_color ?? "#475569" }}>{text}</span>;
}

function TripCard({ trip, language, onDelete, onEdit }: { trip: Trip; language: Language; onDelete: (trip: Trip) => void; onEdit: (trip: Trip) => void }) {
  const c = copy[language];
  const transportColor = modeColor(trip.mode);
  const number = formatJourneyDistance(trip.distance_km, language);
  const names = language === "zh" ? { origin: trip.origin.name_zh, destination: trip.destination.name_zh } : { origin: trip.origin.name_en, destination: trip.destination.name_en };
  const originCode = displayPlaceCode(trip.origin);
  const destinationCode = displayPlaceCode(trip.destination);
  const distanceBand = getTripDistanceBand(trip);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold dark:bg-slate-950" style={{ borderColor: transportColor, color: transportColor }}>{modeLabels[language][trip.mode]}</span>
          {trip.is_demo ? <span className="text-xs font-medium text-slate-500">{c.demo}</span> : null}
        </div>
        <time className="text-sm font-medium text-slate-500">{formatDate(trip, language)}</time>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-slate-950 dark:text-white">{names.origin}</p>
          {originCode ? <p className="mt-1 text-sm text-slate-500">{originCode}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-center" style={{ color: transportColor }} aria-hidden="true">
          <span className="text-lg">→</span>
          <span className="mt-1 h-px w-8" style={{ backgroundColor: transportColor }} />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-xl font-bold text-slate-950 dark:text-white">{names.destination}</p>
          {destinationCode ? <p className="mt-1 text-sm text-slate-500">{destinationCode}</p> : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
        <div className="flex min-w-0 gap-2"><CarrierMark trip={trip} /><div className="min-w-0"><p className="truncate text-slate-500">{trip.carrier || "—"}</p><p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-200">{trip.service_number || "—"}</p></div></div>
        <div><p className="text-slate-500">{language === "zh" ? "距離" : "Distance"}</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{number} km</p></div>
        <div><p className="text-slate-500">{language === "zh" ? "時間" : "Time"}</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{formatDuration(trip.duration_min, language)}</p></div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-200">{distanceBandLabel(distanceBand, language)}</span>
        {trip.purpose ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{purposeLabel(trip.purpose, language)}</span> : null}
        {trip.tags.map((tag) => <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300" key={tag}>{tag}</span>)}
      </div>
      {!trip.is_demo ? <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button className="rounded-xl border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800 transition hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-950" onClick={() => onEdit(trip)} type="button">{c.editJourney}</button>
        <button className="rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30" onClick={() => onDelete(trip)} type="button">{c.deleteJourney}</button>
      </div> : null}
    </article>
  );
}

export function TripDashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [filters, setFilters] = useState<TripFilters>({});
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [customPlaces, setCustomPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [storageIssue, setStorageIssue] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [mapNetworkEnabled, setMapNetworkEnabled] = useState(false);
  const c = copy[language];

  const readTrips = useCallback((activeFilters: TripFilters) => withTimeout(Promise.all([listTrips(), listTrips(activeFilters), listCustomPlaces()])), []);

  useEffect(() => {
    let cancelled = false;

    void readTrips(filters).then(([all, filtered, savedPlaces]) => {
      if (cancelled) return;
      setAllTrips(all);
      setTrips(filtered);
      setCustomPlaces(savedPlaces);
      setIsLoading(false);
      setStorageIssue(false);
    }).catch(() => {
      if (cancelled) return;
      setStorageIssue(true);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filters, readTrips]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-Hant" : "en";
  }, [language]);

  const years = useMemo(() => [...new Set(allTrips.map((trip) => getJourneyDepartureLocalYear(trip)))].sort((a, b) => b - a), [allTrips]);
  const statistics = useMemo(() => calculateJourneyStatistics(trips), [trips]);
  const annualVisits = useMemo(() => calculateAnnualVisitStatistics(trips), [trips]);
  const travelRecap = useMemo(() => buildTravelRecap(trips), [trips]);
  const selectedModes = [...new Set([filters.mode, ...(filters.modes ?? [])].filter((mode): mode is TripMode => Boolean(mode)))];
  const selectedYears = [...new Set([filters.year, ...(filters.years ?? [])].filter((year): year is number => typeof year === "number"))];
  const selectedContinents = filters.continents ?? [];
  const selectedDistanceBands = filters.distance_bands ?? [];
  const selectedPurposes = filters.purposes ?? [];
  const activeFilterCount = Number(Boolean(filters.search))
    + selectedModes.length
    + selectedYears.length
    + selectedContinents.length
    + selectedDistanceBands.length
    + selectedPurposes.length;
  const hasDemoTrips = allTrips.some((trip) => trip.is_demo);

  const updateFilters = (next: TripFilters) => {
    setIsLoading(true);
    setFilters(next);
  };

  function toggleMode(mode: TripMode) {
    updateFilters({ ...filters, mode: undefined, modes: toggleSelection(selectedModes, mode) });
  }

  function toggleYear(year: number) {
    updateFilters({ ...filters, year: undefined, years: toggleSelection(selectedYears, year) });
  }

  function toggleContinent(continent: ContinentFilter) {
    updateFilters({ ...filters, continents: toggleSelection(selectedContinents, continent) });
  }

  function toggleDistanceBand(distanceBand: DistanceBand) {
    updateFilters({ ...filters, distance_bands: toggleSelection(selectedDistanceBands, distanceBand) });
  }

  function togglePurpose(purpose: TripPurposeFilter) {
    updateFilters({ ...filters, purposes: toggleSelection(selectedPurposes, purpose) });
  }

  function toggleAllModes() {
    updateFilters({ ...filters, mode: undefined, modes: toggleAllSelections(selectedModes, modeOrder) });
  }

  function toggleAllYears() {
    updateFilters({ ...filters, year: undefined, years: toggleAllSelections(selectedYears, years) });
  }

  function toggleAllContinents() {
    updateFilters({ ...filters, continents: toggleAllSelections(selectedContinents, continentFilters) });
  }

  function toggleAllDistanceBands() {
    updateFilters({ ...filters, distance_bands: toggleAllSelections(selectedDistanceBands, journeyDistanceBands) });
  }

  function toggleAllPurposes() {
    updateFilters({ ...filters, purposes: toggleAllSelections(selectedPurposes, purposeFilterOrder) });
  }

  async function handleLoadSample() {
    setIsSaving(true);
    const nextFilters: TripFilters = {};
    setIsLoading(true);
    setFilters(nextFilters);
    try {
      await loadDemoTrips();
      const [all, filtered, savedPlaces] = await readTrips(nextFilters);
      setAllTrips(all);
      setTrips(filtered);
      setCustomPlaces(savedPlaces);
      setStorageIssue(false);
      setStatus(c.loadSuccess);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
    } finally {
      setIsLoading(false);
      setIsSaving(false);
    }
  }

  async function handleClearSample() {
    setIsSaving(true);
    setIsLoading(true);
    try {
      await clearDemoTrips();
      const [all, filtered, savedPlaces] = await readTrips(filters);
      setAllTrips(all);
      setTrips(filtered);
      setCustomPlaces(savedPlaces);
      setStorageIssue(false);
      setStatus(c.clearSuccess);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
    } finally {
      setIsLoading(false);
      setIsSaving(false);
    }
  }

  async function refreshAfterMutation(activeFilters = filters) {
    const [all, filtered, savedPlaces] = await readTrips(activeFilters);
    setAllTrips(all);
    setTrips(filtered);
    setCustomPlaces(savedPlaces);
  }

  async function handleSaveJourney(trip: Trip, newPlaces: Place[], operation: "create" | "update") {
    setIsSaving(true);
    try {
      await saveJourneyWithCustomPlaces({ trip, customPlaces: newPlaces, operation });
      const [all, filtered, savedPlaces] = await readTrips(filters);
      setAllTrips(all);
      setTrips(filtered);
      setCustomPlaces(savedPlaces);
      setEditingTrip(null);
      const isVisible = filtered.some((item) => item.id === trip.id);
      setStatus(operation === "update"
        ? (isVisible ? c.updateJourneySuccess : c.addJourneyHidden)
        : (isVisible ? c.addJourneySuccess : c.addJourneyHidden));
      setStorageIssue(false);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
      throw new Error("Could not save journey.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditJourney(trip: Trip) {
    setEditingTrip(trip);
    window.setTimeout(() => document.getElementById("add-journey-title")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function handleDeleteJourney(trip: Trip) {
    if (!window.confirm(c.deleteJourneyConfirm)) return;
    setIsSaving(true);
    setIsLoading(true);
    try {
      await deleteTrip(trip.id);
      await refreshAfterMutation();
      if (editingTrip?.id === trip.id) setEditingTrip(null);
      setStorageIssue(false);
      setStatus(c.journeyDeleted);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
    } finally {
      setIsSaving(false);
      setIsLoading(false);
    }
  }

  async function handleDeletePlace(place: Place) {
    if (!window.confirm(c.deletePlaceConfirm)) return;
    setIsSaving(true);
    try {
      await deleteCustomPlace(place.id);
      await refreshAfterMutation();
      setStorageIssue(false);
      setStatus(c.placeDeleted);
    } catch (error) {
      if (error instanceof CustomPlaceInUseError || (error instanceof Error && error.name === "CustomPlaceInUseError")) {
        setStatus(c.placeInUse);
      } else {
        setStorageIssue(true);
        setStatus(c.storageError);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePlaceContinent(place: Place, continent: Continent) {
    setIsSaving(true);
    try {
      await updateCustomPlaceAndJourneyReferences({ ...place, continent });
      await refreshAfterMutation();
      setStorageIssue(false);
      setStatus(c.placeContinentSaved);
    } catch {
      setStorageIssue(true);
      setStatus(c.storageError);
    } finally {
      setIsSaving(false);
    }
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
            <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700" aria-label={c.languageLabel} role="group">
              {(["zh", "en"] as Language[]).map((item) => <button aria-pressed={language === item} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${language === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500"}`} key={item} onClick={() => setLanguage(item)} type="button">{item === "zh" ? "繁中" : "EN"}</button>)}
            </div>
          </div>
        </header>

        <div className="mt-6"><AppNavigation current="journeys" language={language} /></div>

        <section className="mt-8 flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-300">{c.visible} {trips.length} {trips.length === 1 ? c.trip : c.journeys}</p>
            <p className="mt-1 text-sm text-slate-300">{c.sampleNote}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-teal-950 transition hover:bg-teal-300 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} onClick={() => void handleLoadSample()} type="button">{isSaving ? c.loading : c.sample}</button>
            {hasDemoTrips ? <button className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-bold text-white transition hover:border-slate-400 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} onClick={() => void handleClearSample()} type="button">{c.clear}</button> : null}
          </div>
        </section>

        <AddJourneyForm
          editingTrip={editingTrip}
          existingTrips={allTrips}
          isSaving={isSaving}
          key={editingTrip?.id ?? "new-journey"}
          language={language}
          onCancelEdit={() => setEditingTrip(null)}
          onSave={handleSaveJourney}
          places={[...REFERENCE_PLACES, ...customPlaces]}
        />

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={c.visible}>
          <StatsCard label={c.journeys} value={String(statistics.totalTrips)} />
          <StatsCard
            label={c.distance}
            value={`${formatDistance(statistics.totalDistanceKm, language)} km`}
            detail={statistics.totalDistanceKm > 0 ? formatDistanceDetail(statistics.modeDistanceKm, statistics.totalDistanceKm, language) : undefined}
          />
          <StatsCard label={c.duration} value={formatDuration(statistics.totalDurationMin, language)} />
          <StatsCard label={c.countries} value={String(statistics.countriesVisited)} />
        </section>

        <TravelRecapExport language={language} recap={travelRecap} />

        {annualVisits.length ? <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="annual-visits-title">
          <div className="p-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white" id="annual-visits-title">{c.annualVisits}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{c.annualVisitsHint}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-t border-slate-100 text-left text-sm dark:border-slate-800">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300"><tr><th className="px-5 py-3 font-bold">{c.annualYear}</th><th className="px-5 py-3 font-bold">{c.annualContinents}</th><th className="px-5 py-3 font-bold">{c.annualCountries}</th><th className="px-5 py-3 font-bold">{c.annualCities}</th></tr></thead>
              <tbody>{annualVisits.map((visit) => <tr className="border-t border-slate-100 dark:border-slate-800" key={visit.year}><th className="px-5 py-3 font-bold text-slate-950 dark:text-white" scope="row">{visit.year}</th><td className="px-5 py-3">{visit.continents}</td><td className="px-5 py-3">{visit.countries}</td><td className="px-5 py-3">{visit.cities}</td></tr>)}</tbody>
            </table>
          </div>
        </section> : null}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_auto] md:items-end">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {c.searchLabel}
              <input className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => updateFilters({ ...filters, search: event.target.value || undefined })} placeholder={c.searchPlaceholder} value={filters.search ?? ""} />
            </label>
            <div className="pb-0.5 text-sm leading-6 text-slate-500">{c.filterHint}</div>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <FilterChipGroup clearAllLabel={c.clearAll} getLabel={(year) => String(year)} label={c.yearLabel} onToggle={toggleYear} onToggleAll={toggleAllYears} options={years} selectAllLabel={c.selectAll} selected={selectedYears} />
            <FilterChipGroup clearAllLabel={c.clearAll} getLabel={(mode) => modeLabels[language][mode]} label={c.modeLabel} onToggle={toggleMode} onToggleAll={toggleAllModes} options={modeOrder} selectAllLabel={c.selectAll} selected={selectedModes} />
            <FilterChipGroup clearAllLabel={c.clearAll} getLabel={(continent) => continentLabel(continent, language)} label={c.continentLabel} onToggle={toggleContinent} onToggleAll={toggleAllContinents} options={continentFilters} selectAllLabel={c.selectAll} selected={selectedContinents} />
            <FilterChipGroup clearAllLabel={c.clearAll} getLabel={(distanceBand) => distanceBandLabel(distanceBand, language)} label={c.distanceBandLabel} onToggle={toggleDistanceBand} onToggleAll={toggleAllDistanceBands} options={journeyDistanceBands} selectAllLabel={c.selectAll} selected={selectedDistanceBands} />
            <FilterChipGroup clearAllLabel={c.clearAll} getLabel={(purpose) => purposeLabel(purpose, language)} label={c.purposeLabel} onToggle={togglePurpose} onToggleAll={toggleAllPurposes} options={purposeFilterOrder} selectAllLabel={c.selectAll} selected={selectedPurposes} />
          </div>
          {activeFilterCount > 0 ? <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"><span className="text-sm text-slate-500">{activeFilterCount} {c.filterCount}</span><button className="text-sm font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300" onClick={() => updateFilters({})} type="button">{c.clearFilters}</button></div> : null}
        </section>

        <p aria-live="polite" className="mt-4 min-h-5 text-sm font-medium text-teal-700 dark:text-teal-300">{status || (storageIssue ? c.storageError : "")}</p>

        <section className="mt-3" aria-labelledby="journey-map-title">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Map</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight" id="journey-map-title">{c.mapTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{c.mapBody}</p>
          </div>
          {mapNetworkEnabled ? <TripMap language={language} trips={trips} /> : <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">{c.mapConsentTitle}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{c.mapConsentBody}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{c.mapPrivacy}</p>
            <button className="mt-4 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800" onClick={() => setMapNetworkEnabled(true)} type="button">{c.mapConsentButton}</button>
          </div>}
          {!isLoading && trips.length === 0 ? <p className="mt-3 text-sm text-slate-500">{c.mapEmpty}</p> : null}
        </section>

        <section className="mt-8">
          {isLoading ? <p className="py-14 text-center text-slate-500">{c.loading}</p> : null}
          {!isLoading && allTrips.length === 0 ? <EmptyState title={c.emptyTitle} body={c.emptyBody} /> : null}
          {!isLoading && allTrips.length > 0 && trips.length === 0 ? <EmptyState title={c.noResultsTitle} body={c.noResultsBody} /> : null}
          {!isLoading && trips.length > 0 ? <div className="grid gap-4 lg:grid-cols-2">{trips.map((trip) => <TripCard key={trip.id} language={language} onDelete={(item) => void handleDeleteJourney(item)} onEdit={handleEditJourney} trip={trip} />)}</div> : null}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="saved-places-title">
          <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white" id="saved-places-title">{c.savedPlaces}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{c.savedPlacesHint}</p>
          {customPlaces.length === 0 ? <p className="mt-5 text-sm text-slate-500">{c.noSavedPlaces}</p> : <ul className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
            {customPlaces.map((place) => <li className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between" key={place.id}>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{language === "zh" ? place.name_zh : place.name_en}{displayPlaceCode(place) ? <span className="font-medium text-slate-500"> · {displayPlaceCode(place)}</span> : null}</p>
                <p className="mt-1 text-sm text-slate-500">{place.country} · {place.kind === "airport" ? (language === "zh" ? "機場" : "Airport") : place.kind === "station" ? (language === "zh" ? "車站" : "Station") : (language === "zh" ? "自訂地點" : "Custom place")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`place-continent-${place.id}`}>{c.placeContinent}</label>
                <select className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-teal-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" disabled={isSaving} id={`place-continent-${place.id}`} onChange={(event) => { if (event.target.value) void handlePlaceContinent(place, event.target.value as Continent); }} value={getPlaceContinent(place) ?? ""}>
                  <option disabled value="">{c.unclassifiedContinent}</option>
                  {continentFilters.filter((continent): continent is Continent => continent !== "unclassified").map((continent) => <option key={continent} value={continent}>{continentLabel(continent, language)}</option>)}
                </select>
                <button className="rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30" disabled={isSaving} onClick={() => void handleDeletePlace(place)} type="button">{c.deletePlace}</button>
              </div>
            </li>)}
          </ul>}
        </section>
      </div>
    </main>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900"><h2 className="text-xl font-bold">{title}</h2><p className="mx-auto mt-3 max-w-md leading-7 text-slate-500">{body}</p></div>;
}
