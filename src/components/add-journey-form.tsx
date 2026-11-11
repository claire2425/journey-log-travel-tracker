"use client";

import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { OperatorCombobox } from "@/components/operator-combobox";
import { PlaceCombobox } from "@/components/place-combobox";
import { displayPlaceCode } from "@/lib/place-display";
import { buildManualTrip } from "@/lib/journey-entry";
import { getLocalDateTimeInputValue } from "@/lib/journey-date";
import { identifyOperator, lookupOperator, type OperatorDirectoryEntry } from "@/lib/operator-directory";
import { continents, PlaceSchema, tripPurposes, type Continent, type Place, type Trip, type TripMode, type TripPurpose } from "@/lib/types";

type Language = "zh" | "en";
type Endpoint = "origin" | "destination";
type PurposeChoice = TripPurpose | "unclassified" | "";
type FormMessageKind = "error" | "success" | null;

type JourneyFormState = {
  purpose: PurposeChoice;
  serviceNumber: string;
  carrier: string;
  carrierCode: string;
  departureLocal: string;
  arrivalLocal: string;
  seatClass: string;
  seat: string;
  vehicleType: string;
  notes: string;
  tags: string;
};

type PlaceDraft = {
  nameZh: string;
  nameEn: string;
  code: string;
  country: string;
  city: string;
  continent: Continent | "";
  timeZone: string;
  latitude: string;
  longitude: string;
};

type AddJourneyFormProps = {
  language: Language;
  places: Place[];
  existingTrips: Trip[];
  editingTrip?: Trip | null;
  isSaving: boolean;
  onCancelEdit?: () => void;
  onSave: (trip: Trip, newPlaces: Place[], operation: "create" | "update") => Promise<void>;
};

const modeLabels: Record<Language, Record<TripMode, string>> = {
  zh: { flight: "飛行", rail: "火車／高鐵", cruise: "郵輪", other: "其他" },
  en: { flight: "Flight", rail: "Rail / high-speed rail", cruise: "Cruise", other: "Other" },
};

const modeOrder: TripMode[] = ["flight", "rail", "cruise", "other"];
const purposeOrder = [...tripPurposes, "unclassified"] as const;
const continentOrder = continents;

const purposeLabels: Record<Language, Record<Exclude<PurposeChoice, "">, string>> = {
  zh: { leisure: "旅遊／休閒", business: "出差", personal: "個人事務", other: "其他", unclassified: "未設定" },
  en: { leisure: "Leisure", business: "Business", personal: "Personal", other: "Other", unclassified: "Not specified" },
};

const continentLabels: Record<Language, Record<Continent, string>> = {
  zh: {
    africa: "非洲",
    antarctica: "南極洲",
    asia: "亞洲",
    europe: "歐洲",
    north_america: "北美洲",
    oceania: "大洋洲",
    south_america: "南美洲",
  },
  en: {
    africa: "Africa",
    antarctica: "Antarctica",
    asia: "Asia",
    europe: "Europe",
    north_america: "North America",
    oceania: "Oceania",
    south_america: "South America",
  },
};

const emptyForm = (): JourneyFormState => ({
  purpose: "",
  serviceNumber: "",
  carrier: "",
  carrierCode: "",
  departureLocal: "",
  arrivalLocal: "",
  seatClass: "",
  seat: "",
  vehicleType: "",
  notes: "",
  tags: "",
});

const emptyPlaceDraft = (): PlaceDraft => ({
  nameZh: "",
  nameEn: "",
  code: "",
  country: "",
  city: "",
  continent: "",
  timeZone: "Asia/Taipei",
  latitude: "",
  longitude: "",
});

function formForTrip(trip: Trip): JourneyFormState {
  return {
    purpose: trip.purpose ?? "unclassified",
    serviceNumber: trip.service_number,
    carrier: trip.carrier,
    carrierCode: trip.carrier_code ?? "",
    departureLocal: getLocalDateTimeInputValue(trip.departure, trip.origin.time_zone) ?? "",
    arrivalLocal: getLocalDateTimeInputValue(trip.arrival, trip.destination.time_zone) ?? "",
    seatClass: trip.seat_class,
    seat: trip.seat,
    vehicleType: trip.vehicle_type ?? "",
    notes: trip.notes,
    tags: trip.tags.join(", "),
  };
}

function placeLabel(place: Place, language: Language): string {
  const name = language === "zh" ? place.name_zh : place.name_en;
  const location = [place.city, place.country].filter(Boolean).join(", ");
  const code = displayPlaceCode(place);
  return `${code ? `${code} · ` : ""}${name} (${location})`;
}

function stablePlaceLabel(place: Place): string {
  const location = [place.city, place.country].filter(Boolean).join(", ");
  const code = displayPlaceCode(place);
  return `${code ? `${code} · ` : ""}${place.name_en} (${location})`;
}

function operatorName(operator: OperatorDirectoryEntry, language: Language): string {
  return language === "zh" ? operator.label_zh : operator.label;
}

function OperatorMark({ operator, fallback }: { operator?: OperatorDirectoryEntry; fallback?: string }) {
  const text = operator?.logo_text ?? fallback?.slice(0, 4).toUpperCase() ?? "—";
  const backgroundColor = operator?.brand_color ?? "#475569";

  return (
    <span
      aria-hidden="true"
      className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-xs font-black tracking-wide text-white shadow-sm"
      style={{ backgroundColor }}
    >
      {text}
    </span>
  );
}

function modePlaceKind(mode: TripMode): Place["kind"] | undefined {
  if (mode === "flight") return "airport";
  if (mode === "rail") return "station";
  return undefined;
}

function deduplicatePlaces(places: Place[]): Place[] {
  return [...new Map(places.map((place) => [place.id, place])).values()];
}

function finiteCoordinate(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const coordinate = Number(trimmed);
  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function hasJourneyDetails(form: JourneyFormState): boolean {
  return Boolean(
    form.purpose
    || form.serviceNumber.trim()
    || form.carrier.trim()
    || form.carrierCode.trim()
    || form.departureLocal
    || form.arrivalLocal
    || form.seatClass.trim()
    || form.seat.trim()
    || form.vehicleType.trim()
    || form.notes.trim()
    || form.tags.trim(),
  );
}

function hasPlaceDetails(placeDraft: PlaceDraft): boolean {
  return Boolean(
    placeDraft.nameZh.trim()
    || placeDraft.nameEn.trim()
    || placeDraft.code.trim()
    || placeDraft.country.trim()
    || placeDraft.city.trim()
    || placeDraft.continent
    || placeDraft.timeZone.trim() !== "Asia/Taipei"
    || placeDraft.latitude.trim()
    || placeDraft.longitude.trim(),
  );
}

export function AddJourneyForm({
  language,
  places,
  existingTrips,
  editingTrip = null,
  isSaving,
  onCancelEdit,
  onSave,
}: AddJourneyFormProps) {
  const [mode, setMode] = useState<TripMode | null>(() => editingTrip?.mode ?? null);
  const [form, setForm] = useState<JourneyFormState>(() => editingTrip ? formForTrip(editingTrip) : emptyForm());
  const [originId, setOriginId] = useState(() => editingTrip?.origin.id ?? "");
  const [destinationId, setDestinationId] = useState(() => editingTrip?.destination.id ?? "");
  const [originQuery, setOriginQuery] = useState(() => editingTrip ? stablePlaceLabel(editingTrip.origin) : "");
  const [destinationQuery, setDestinationQuery] = useState(() => editingTrip ? stablePlaceLabel(editingTrip.destination) : "");
  const [customFor, setCustomFor] = useState<Endpoint | null>(null);
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft>(emptyPlaceDraft);
  const [pendingPlaces, setPendingPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<FormMessageKind>(null);
  const [customPlaceError, setCustomPlaceError] = useState("");
  const [purposeError, setPurposeError] = useState(false);
  const customPlaceErrorId = useId();
  const purposeErrorId = useId();

  const c = language === "zh" ? {
    eyebrow: "旅程輸入",
    title: "新增旅程",
    editTitle: "編輯旅程",
    description: "先選交通方式，再輸入路線與班號／車次。預設儲存在這個裝置；登入私有同步後可跨裝置同步。",
    editDescription: "更新這趟旅程的本機資料；原始建立時間會保留不變，登入私有同步後會安全同步。",
    stepOne: "1. 選擇交通方式",
    stepTwo: "2. 輸入旅程資料",
    origin: "出發地",
    destination: "目的地",
    locationPlaceholder: "輸入代碼、機場、車站或城市",
    locationHint: "輸入至少兩個字元，即時搜尋內建的全球機場或車站資料。飛行只顯示機場；火車／高鐵只顯示車站。",
    noPlaceMatches: "找不到符合的地點；可使用下方按鈕新增自訂地點。",
    searchingPlaces: "正在搜尋全球參考資料…",
    placeSearchFailed: "全球參考資料暫時無法使用；請稍後再試或新增自訂地點。",
    placeDataNote: "機場資料來自 OurAirports（公共領域）；車站資料來自 GeoNames（CC BY 4.0）。此為參考資料，並非即時班表。",
    addPlace: "找不到地點？新增自訂地點",
    addingPlace: "新增自訂地點",
    nameZh: "中文名稱",
    nameEn: "英文名稱",
    placeCode: "地點代碼／簡稱",
    country: "國家／地區",
    city: "城市（選填）",
    continent: "洲別",
    continentPlaceholder: "選擇洲別",
    timeZone: "IANA 時區",
    coordinates: "座標（經度、緯度）",
    longitude: "經度",
    latitude: "緯度",
    savePlace: "使用這個地點",
    cancel: "取消",
    service: "航班／車次",
    servicePlaceholder: "例如 BR198、THSR 615、Nozomi 21",
    serviceHint: "先選交通方式後輸入；若辨識到常見營運商，會在下方顯示本機識別標記。",
    company: "營運公司（選填）",
    companyCode: "公司代碼（選填）",
    companyPlaceholder: "輸入公司名稱或代碼，例如 ANA、Eurostar、MSC",
    noOperators: "找不到這個常見營運商；仍可自行輸入。",
    detected: "辨識到的營運商",
    useOperator: "套用到旅程",
    logoNote: "目前顯示的是本機生成的名稱／代碼標記，不是從公司網站抓取的官方圖案。日後若接入授權時刻資料，才會顯示供應商回傳的官方圖案。",
    purpose: "旅程目的",
    purposeHint: "請選擇這趟旅程的主要目的，方便之後篩選與統計。",
    departure: "出發當地時間",
    arrival: "抵達當地時間",
    class: "艙等／座位等級（選填）",
    seat: "座位（選填）",
    vehicle: "交通工具／車型（選填）",
    notes: "備註（選填）",
    tags: "標籤（選填，以逗號分隔）",
    saveJourney: "儲存旅程",
    updateJourney: "更新旅程",
    cancelEdit: "取消編輯",
    saving: "正在儲存⋯",
    routeSuggestions: "你已儲存的同路線紀錄",
    routeSuggestionHint: "這些是你自己的本機紀錄，不是即時班次；點一下可帶入營運公司與班號。",
    noRouteSuggestions: "尚無本機同路線紀錄。仍可直接手動新增。",
    liveLookupTitle: "即時班次查詢",
    liveLookupBody: "目前不會假裝顯示即時航班或車次。全球航班、鐵路和高鐵需要各地資料供應商與授權；新增旅程不會因此被阻擋。",
    chooseMode: "請先選擇交通方式。",
    choosePlaces: "請從建議清單選擇出發地與目的地，或新增自訂地點。",
    choosePurpose: "請選擇旅程目的，或明確選擇「未設定」。",
    samePlace: "出發地與目的地不能相同。",
    invalidPlace: "請完整填寫自訂地點，並使用有效的 IANA 時區和座標。",
    invalidCoordinates: "請輸入有效的經度與緯度；兩者都不能留白。",
    invalidJourney: "請確認出發與抵達時間；抵達時間必須晚於出發時間。",
    saveFailed: "無法儲存旅程。請確認這個瀏覽器允許本機儲存後再試一次。",
    discardModeChange: "變更交通方式會清除尚未儲存的旅程資料。要繼續嗎？",
    cancelEditConfirm: "取消編輯會捨棄這次尚未儲存的變更。要繼續嗎？",
    saved: "已儲存旅程。",
    updated: "已更新旅程。",
  } : {
    eyebrow: "Journey entry",
    title: "Add a journey",
    editTitle: "Edit journey",
    description: "Choose a travel mode first, then record the route and service. It stays on this device until you sign in to private sync.",
    editDescription: "Update this local journey while preserving when it was originally created; private sync safely replicates it after sign-in.",
    stepOne: "1. Choose a travel mode",
    stepTwo: "2. Enter journey details",
    origin: "Origin",
    destination: "Destination",
    locationPlaceholder: "Type a code, airport, station, or city",
    locationHint: "Type at least two characters to search the bundled global airport or station data. Flights show airports; rail shows stations.",
    noPlaceMatches: "No matching place. Use the button below to add a custom place.",
    searchingPlaces: "Searching global reference data…",
    placeSearchFailed: "Global reference data is temporarily unavailable. Try again or add a custom place.",
    placeDataNote: "Airport data: OurAirports (Public Domain). Station data: GeoNames (CC BY 4.0). This is reference data, not a live timetable.",
    addPlace: "Can’t find it? Add a custom place",
    addingPlace: "Add a custom place",
    nameZh: "Chinese name",
    nameEn: "English name",
    placeCode: "Place code / short name",
    country: "Country / region",
    city: "City (optional)",
    continent: "Continent",
    continentPlaceholder: "Choose a continent",
    timeZone: "IANA time zone",
    coordinates: "Coordinates (longitude, latitude)",
    longitude: "Longitude",
    latitude: "Latitude",
    savePlace: "Use this place",
    cancel: "Cancel",
    service: "Flight / train number",
    servicePlaceholder: "For example BR198, THSR 615, Nozomi 21",
    serviceHint: "Enter it after choosing a mode. Recognised operators show a local visual mark below.",
    company: "Operating company (optional)",
    companyCode: "Company code (optional)",
    companyPlaceholder: "Type a company or code, e.g. ANA, Eurostar, MSC",
    noOperators: "This common operator was not found; you can still enter it manually.",
    detected: "Recognised operator",
    useOperator: "Use for this journey",
    logoNote: "This is a locally rendered name/code mark, not an official logo scraped from a company site. A licensed timetable provider can later return approved official artwork.",
    purpose: "Journey purpose",
    purposeHint: "Choose the main purpose of this journey for future filtering and statistics.",
    departure: "Departure local time",
    arrival: "Arrival local time",
    class: "Cabin / class (optional)",
    seat: "Seat (optional)",
    vehicle: "Vehicle / train type (optional)",
    notes: "Notes (optional)",
    tags: "Tags (optional, comma-separated)",
    saveJourney: "Save journey",
    updateJourney: "Update journey",
    cancelEdit: "Cancel editing",
    saving: "Saving…",
    routeSuggestions: "Your saved journeys on this route",
    routeSuggestionHint: "These are your local saved records, not a live timetable. Choose one to bring in its carrier and service number.",
    noRouteSuggestions: "No saved services on this route yet. You can still add it manually.",
    liveLookupTitle: "Live timetable lookup",
    liveLookupBody: "The app will not pretend a result is live. Worldwide flight, rail, and high-speed rail results require licensed providers; this never prevents manual journey entry.",
    chooseMode: "Choose a travel mode first.",
    choosePlaces: "Choose both endpoints from the suggestions, or add a custom place.",
    choosePurpose: "Choose a journey purpose, or explicitly choose Not specified.",
    samePlace: "Origin and destination cannot be the same.",
    invalidPlace: "Complete the custom place with a valid IANA time zone and coordinates.",
    invalidCoordinates: "Enter valid longitude and latitude values; neither can be blank.",
    invalidJourney: "Check the departure and arrival times; arrival must be after departure.",
    saveFailed: "The journey could not be saved. Check that this browser allows local storage and try again.",
    discardModeChange: "Changing travel mode will clear this unsaved journey. Continue?",
    cancelEditConfirm: "Cancel editing and discard the unsaved changes?",
    saved: "Journey saved.",
    updated: "Journey updated.",
  };

  const allPlaces = useMemo(() => deduplicatePlaces([
    ...places,
    ...(editingTrip ? [editingTrip.origin, editingTrip.destination] : []),
    ...pendingPlaces,
  ]), [editingTrip, places, pendingPlaces]);
  const availablePlaces = useMemo(() => {
    if (!mode) return [];
    const kind = modePlaceKind(mode);
    return allPlaces.filter((place) => !kind || place.kind === kind);
  }, [allPlaces, mode]);
  const placeById = useMemo(() => new Map(allPlaces.map((place) => [place.id, place])), [allPlaces]);
  const origin = placeById.get(originId);
  const destination = placeById.get(destinationId);
  const detectedOperator = useMemo(() => mode ? identifyOperator(mode, form.serviceNumber) : undefined, [form.serviceNumber, mode]);
  const selectedCodeOperator = useMemo(() => {
    if (mode !== "flight" && mode !== "rail" && mode !== "cruise") return undefined;
    return lookupOperator(form.carrierCode, mode);
  }, [form.carrierCode, mode]);
  const shownOperator = detectedOperator ?? selectedCodeOperator;
  const routeSuggestions = useMemo(() => {
    if (!mode || !origin || !destination) return [];
    return existingTrips.filter((trip) => (
      trip.mode === mode
      && trip.origin.id === origin.id
      && trip.destination.id === destination.id
    )).slice(0, 5);
  }, [destination, existingTrips, mode, origin]);

  function clearMessage() {
    setMessage("");
    setMessageKind(null);
  }

  function showMessage(nextMessage: string, kind: Exclude<FormMessageKind, null>) {
    setMessage(nextMessage);
    setMessageKind(kind);
  }

  function resetEntry() {
    setForm(emptyForm());
    setOriginId("");
    setDestinationId("");
    setOriginQuery("");
    setDestinationQuery("");
    setPendingPlaces([]);
    setCustomFor(null);
    setPlaceDraft(emptyPlaceDraft());
    setCustomPlaceError("");
    setPurposeError(false);
    clearMessage();
  }

  function hasUnsavedEntry(): boolean {
    return Boolean(
      originId
      || destinationId
      || originQuery.trim()
      || destinationQuery.trim()
      || pendingPlaces.length
      || hasJourneyDetails(form)
      || hasPlaceDetails(placeDraft),
    );
  }

  function selectMode(nextMode: TripMode) {
    if (nextMode === mode) return;
    if (mode && hasUnsavedEntry() && !window.confirm(c.discardModeChange)) return;

    setMode(nextMode);
    resetEntry();
  }

  function cancelEditing() {
    if (!editingTrip) return;
    if (hasUnsavedEntry() && !window.confirm(c.cancelEditConfirm)) return;
    resetEntry();
    setMode(null);
    onCancelEdit?.();
  }

  function findPlace(value: string): Place | undefined {
    const normalized = value.normalize("NFKC").trim().toLocaleLowerCase();
    if (!normalized) return undefined;
    return availablePlaces.find((place) => (
      placeLabel(place, language).normalize("NFKC").toLocaleLowerCase() === normalized
      || place.code.normalize("NFKC").toLocaleLowerCase() === normalized
    ));
  }

  function updateEndpointQuery(endpoint: Endpoint, value: string) {
    const place = findPlace(value);
    const setId = endpoint === "origin" ? setOriginId : setDestinationId;
    const setQuery = endpoint === "origin" ? setOriginQuery : setDestinationQuery;
    setQuery(value);
    setId(place?.id ?? "");
  }

  function selectEndpointPlace(endpoint: Endpoint, place: Place) {
    const setId = endpoint === "origin" ? setOriginId : setDestinationId;
    const setQuery = endpoint === "origin" ? setOriginQuery : setDestinationQuery;
    setId(place.id);
    setQuery(placeLabel(place, language));
    if (!allPlaces.some((existing) => existing.id === place.id)) {
      setPendingPlaces((current) => deduplicatePlaces([...current, place]));
    }
  }

  function updateDraft(field: keyof PlaceDraft, value: string) {
    setPlaceDraft((current) => ({ ...current, [field]: value }));
    setCustomPlaceError("");
  }

  function beginCustomPlace(endpoint: Endpoint) {
    setCustomFor(endpoint);
    setPlaceDraft(emptyPlaceDraft());
    setCustomPlaceError("");
    clearMessage();
  }

  function addCustomPlace() {
    if (!mode || !customFor) return;
    if (!placeDraft.continent) return setCustomPlaceError(c.invalidPlace);
    const latitude = finiteCoordinate(placeDraft.latitude);
    const longitude = finiteCoordinate(placeDraft.longitude);
    if (latitude === undefined || longitude === undefined) {
      return setCustomPlaceError(c.invalidCoordinates);
    }

    const kind = modePlaceKind(mode) ?? "custom";
    const parsed = PlaceSchema.safeParse({
      id: `custom-${crypto.randomUUID()}`,
      name_zh: placeDraft.nameZh.trim(),
      name_en: placeDraft.nameEn.trim(),
      code: placeDraft.code.trim().toUpperCase(),
      kind,
      latitude,
      longitude,
      country: placeDraft.country.trim(),
      city: placeDraft.city.trim(),
      continent: placeDraft.continent,
      time_zone: placeDraft.timeZone.trim(),
    });
    if (!parsed.success) return setCustomPlaceError(c.invalidPlace);
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: parsed.data.time_zone }).format();
    } catch {
      return setCustomPlaceError(c.invalidPlace);
    }

    const place = parsed.data;
    setPendingPlaces((current) => [...current, place]);
    if (customFor === "origin") {
      setOriginId(place.id);
      setOriginQuery(placeLabel(place, language));
    } else {
      setDestinationId(place.id);
      setDestinationQuery(placeLabel(place, language));
    }
    setCustomFor(null);
    setPlaceDraft(emptyPlaceDraft());
    setCustomPlaceError("");
    clearMessage();
  }

  function handleCustomPlaceKeyDown(event: KeyboardEvent<HTMLFieldSetElement>) {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName !== "INPUT") return;

    event.preventDefault();
    addCustomPlace();
  }

  function applyOperator(operator: OperatorDirectoryEntry) {
    setForm((current) => ({
      ...current,
      carrier: operator.label,
      carrierCode: operator.code,
    }));
  }

  function applySavedJourney(trip: Trip) {
    setForm((current) => ({
      ...current,
      carrier: trip.carrier,
      carrierCode: trip.carrier_code ?? "",
      serviceNumber: trip.service_number,
      purpose: trip.purpose ?? "unclassified",
      vehicleType: trip.vehicle_type ?? "",
      seatClass: trip.seat_class,
    }));
    setPurposeError(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return showMessage(c.chooseMode, "error");
    if (!origin || !destination) return showMessage(c.choosePlaces, "error");
    if (origin.id === destination.id) return showMessage(c.samePlace, "error");
    const purpose = form.purpose;
    if (!purpose) {
      setPurposeError(true);
      clearMessage();
      return;
    }

    let trip: Trip;
    try {
      trip = buildManualTrip({
        id: editingTrip?.id ?? crypto.randomUUID(),
        mode,
        purpose: purpose === "unclassified" ? undefined : purpose,
        origin,
        destination,
        departureLocal: form.departureLocal,
        arrivalLocal: form.arrivalLocal,
        carrier: form.carrier,
        carrierCode: form.carrierCode,
        carrierLogoUrl: editingTrip?.carrier_logo_url,
        serviceNumber: form.serviceNumber,
        seatClass: form.seatClass,
        seat: form.seat,
        vehicleType: form.vehicleType,
        notes: form.notes,
        tags: form.tags.split(","),
        createdAt: editingTrip?.created_at,
      });
    } catch {
      return showMessage(c.invalidJourney, "error");
    }

    try {
      await onSave(trip, pendingPlaces, editingTrip ? "update" : "create");
      showMessage(editingTrip ? c.updated : c.saved, "success");
      setMode(null);
      setForm(emptyForm());
      setOriginId("");
      setDestinationId("");
      setOriginQuery("");
      setDestinationQuery("");
      setPendingPlaces([]);
      setCustomFor(null);
      setPlaceDraft(emptyPlaceDraft());
      setCustomPlaceError("");
      setPurposeError(false);
      if (editingTrip) onCancelEdit?.();
    } catch {
      showMessage(c.saveFailed, "error");
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30 sm:p-6" aria-labelledby="add-journey-title">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">{c.eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white" id="add-journey-title">{editingTrip ? c.editTitle : c.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{editingTrip ? c.editDescription : c.description}</p>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{c.stepOne}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={c.stepOne}>
          {modeOrder.map((item) => (
            <button
              aria-pressed={mode === item}
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${mode === item ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
              disabled={isSaving}
              key={item}
              onClick={() => selectMode(item)}
              type="button"
            >
              {modeLabels[language][item]}
            </button>
          ))}
        </div>
      </div>

      {mode ? (
        <form className="mt-6" onSubmit={(event) => void submit(event)}>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{c.stepTwo} · {modeLabels[language][mode]}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(["origin", "destination"] as Endpoint[]).map((endpoint) => {
              const label = endpoint === "origin" ? c.origin : c.destination;
              const query = endpoint === "origin" ? originQuery : destinationQuery;
              return (
                <div key={endpoint}>
                  <PlaceCombobox
                    globalKind={mode === "flight" ? "airport" : mode === "rail" ? "station" : undefined}
                    label={label}
                    language={language}
                    noMatches={c.noPlaceMatches}
                    searchFailed={c.placeSearchFailed}
                    searching={c.searchingPlaces}
                    onChange={(value) => updateEndpointQuery(endpoint, value)}
                    onSelect={(place) => selectEndpointPlace(endpoint, place)}
                    placeholder={c.locationPlaceholder}
                    places={availablePlaces}
                    value={query}
                  />
                  <button className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300" onClick={() => beginCustomPlace(endpoint)} type="button">{c.addPlace}</button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{c.locationHint}</p>
          {(mode === "flight" || mode === "rail") ? <p className="mt-1 text-xs leading-5 text-slate-500">{c.placeDataNote}</p> : null}

          {customFor ? <fieldset className="mt-5 rounded-2xl border border-teal-200 bg-white p-4 dark:border-teal-900 dark:bg-slate-950" onKeyDown={handleCustomPlaceKeyDown}>
            <legend className="px-1 text-sm font-bold text-slate-800 dark:text-slate-100">{c.addingPlace} · {customFor === "origin" ? c.origin : c.destination}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={c.nameZh} onChange={(value) => updateDraft("nameZh", value)} required value={placeDraft.nameZh} />
              <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={c.nameEn} onChange={(value) => updateDraft("nameEn", value)} required value={placeDraft.nameEn} />
              <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={c.placeCode} onChange={(value) => updateDraft("code", value)} required value={placeDraft.code} />
              <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={c.country} onChange={(value) => updateDraft("country", value)} required value={placeDraft.country} />
              <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={c.city} onChange={(value) => updateDraft("city", value)} value={placeDraft.city} />
              <SelectField
                ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined}
                invalid={Boolean(customPlaceError)}
                label={c.continent}
                onChange={(value) => updateDraft("continent", value as Continent | "")}
                options={continentOrder.map((continent) => ({ label: continentLabels[language][continent], value: continent }))}
                placeholder={c.continentPlaceholder}
                required
                value={placeDraft.continent}
              />
              <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={c.timeZone} onChange={(value) => updateDraft("timeZone", value)} placeholder="Asia/Taipei" required value={placeDraft.timeZone} />
              <div className="grid grid-cols-2 gap-2">
                <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={`${c.coordinates} — ${c.longitude}`} onChange={(value) => updateDraft("longitude", value)} placeholder="121.5654" required type="number" value={placeDraft.longitude} />
                <InputField ariaDescribedBy={customPlaceError ? customPlaceErrorId : undefined} invalid={Boolean(customPlaceError)} label={`${c.coordinates} — ${c.latitude}`} onChange={(value) => updateDraft("latitude", value)} placeholder="25.0330" required type="number" value={placeDraft.latitude} />
              </div>
            </div>
            {customPlaceError ? <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300" id={customPlaceErrorId} role="alert">{customPlaceError}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800" onClick={addCustomPlace} type="button">{c.savePlace}</button>
              <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200" onClick={() => { setCustomFor(null); setCustomPlaceError(""); }} type="button">{c.cancel}</button>
            </div>
          </fieldset> : null}

          <fieldset aria-describedby={purposeError ? purposeErrorId : undefined} className="mt-6">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.purpose}</legend>
            <p className="mt-1 text-xs leading-5 text-slate-500">{c.purposeHint}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {purposeOrder.map((purpose) => (
                <label className="cursor-pointer" key={purpose}>
                  <input
                    aria-describedby={purposeError ? purposeErrorId : undefined}
                    checked={form.purpose === purpose}
                    className="peer sr-only"
                    name="journey-purpose"
                    onChange={() => {
                      setForm((current) => ({ ...current, purpose }));
                      setPurposeError(false);
                    }}
                    type="radio"
                    value={purpose}
                  />
                  <span className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500 peer-focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:peer-checked:border-teal-500 dark:peer-checked:bg-teal-600">
                    {purposeLabels[language][purpose]}
                  </span>
                </label>
              ))}
            </div>
            {purposeError ? <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300" id={purposeErrorId} role="alert">{c.choosePurpose}</p> : null}
          </fieldset>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {c.service}
              <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => setForm((current) => ({ ...current, serviceNumber: event.target.value }))} placeholder={c.servicePlaceholder} value={form.serviceNumber} />
            </label>
            <p className="self-end pb-1 text-xs leading-5 text-slate-500">{c.serviceHint}</p>
          </div>

          {shownOperator ? <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
            <OperatorMark operator={shownOperator} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{c.detected}</p>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">{operatorName(shownOperator, language)} <span className="text-slate-500">· {shownOperator.code}</span></p>
            </div>
            <button className="rounded-xl border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-950" onClick={() => applyOperator(shownOperator)} type="button">{c.useOperator}</button>
          </div> : null}
          {(mode === "flight" || mode === "rail" || mode === "cruise") ? <p className="mt-2 text-xs leading-5 text-slate-500">{c.logoNote}</p> : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {mode === "flight" || mode === "rail" || mode === "cruise" ? <OperatorCombobox
              label={c.company}
              language={language}
              mode={mode}
              noMatches={c.noOperators}
              onChange={(value) => setForm((current) => ({ ...current, carrier: value, carrierCode: "" }))}
              onSelect={applyOperator}
              placeholder={c.companyPlaceholder}
              value={form.carrier}
            /> : <InputField label={c.company} onChange={(value) => setForm((current) => ({ ...current, carrier: value }))} value={form.carrier} />}
            <InputField label={c.companyCode} onChange={(value) => setForm((current) => ({ ...current, carrierCode: value.toUpperCase() }))} value={form.carrierCode} />
            <InputField label={c.departure} onChange={(value) => setForm((current) => ({ ...current, departureLocal: value }))} type="datetime-local" value={form.departureLocal} />
            <InputField label={c.arrival} onChange={(value) => setForm((current) => ({ ...current, arrivalLocal: value }))} type="datetime-local" value={form.arrivalLocal} />
            <InputField label={c.class} onChange={(value) => setForm((current) => ({ ...current, seatClass: value }))} value={form.seatClass} />
            <InputField label={c.seat} onChange={(value) => setForm((current) => ({ ...current, seat: value }))} value={form.seat} />
            <InputField label={c.vehicle} onChange={(value) => setForm((current) => ({ ...current, vehicleType: value }))} value={form.vehicleType} />
            <InputField label={c.tags} onChange={(value) => setForm((current) => ({ ...current, tags: value }))} value={form.tags} />
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            {c.notes}
            <textarea className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes} />
          </label>

          {origin && destination ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950" aria-label={c.routeSuggestions}>
            <h3 className="font-bold text-slate-900 dark:text-white">{c.routeSuggestions}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{c.routeSuggestionHint}</p>
            {routeSuggestions.length ? <div className="mt-3 flex flex-wrap gap-2">{routeSuggestions.map((trip) => (
              <button className="rounded-xl border border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:border-teal-500 hover:bg-teal-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-teal-950" key={trip.id} onClick={() => applySavedJourney(trip)} type="button">
                {trip.carrier || "—"}{trip.service_number ? ` · ${trip.service_number}` : ""}
              </button>
            ))}</div> : <p className="mt-3 text-sm text-slate-500">{c.noRouteSuggestions}</p>}
          </section> : null}

          <aside className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            <h3 className="font-bold text-amber-950 dark:text-amber-100">{c.liveLookupTitle}</h3>
            <p className="mt-1 leading-6 text-amber-900/80 dark:text-amber-200/80">{c.liveLookupBody}</p>
          </aside>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? c.saving : (editingTrip ? c.updateJourney : c.saveJourney)}</button>
            {editingTrip ? <button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-200" disabled={isSaving} onClick={cancelEditing} type="button">{c.cancelEdit}</button> : null}
            <p aria-live={messageKind === "error" ? "assertive" : "polite"} className={`text-sm font-medium ${messageKind === "error" ? "text-red-700 dark:text-red-300" : "text-teal-800 dark:text-teal-200"}`} role={messageKind === "error" ? "alert" : undefined}>{message}</p>
          </div>
        </form>
      ) : <p className="mt-5 text-sm text-slate-500">{c.chooseMode}</p>}
    </section>
  );
}

function InputField({ ariaDescribedBy, invalid = false, label, onChange, placeholder, required = false, type = "text", value }: {
  ariaDescribedBy?: string;
  invalid?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "number" | "datetime-local";
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <input aria-describedby={ariaDescribedBy} aria-invalid={invalid || undefined} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} step={type === "number" ? "any" : undefined} type={type} value={value} />
    </label>
  );
}

function SelectField({ ariaDescribedBy, invalid = false, label, onChange, options, placeholder, required = false, value }: {
  ariaDescribedBy?: string;
  invalid?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <select
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option disabled value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
