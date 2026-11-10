"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { buildManualTrip } from "@/lib/journey-entry";
import { identifyOperator, lookupOperator, type OperatorDirectoryEntry } from "@/lib/operator-directory";
import { PlaceSchema, type Place, type Trip, type TripMode } from "@/lib/types";

type Language = "zh" | "en";
type Endpoint = "origin" | "destination";

type JourneyFormState = {
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
  timeZone: string;
  latitude: string;
  longitude: string;
};

type AddJourneyFormProps = {
  language: Language;
  places: Place[];
  existingTrips: Trip[];
  isSaving: boolean;
  onSave: (trip: Trip, newPlaces: Place[]) => Promise<void>;
};

const modeLabels: Record<Language, Record<TripMode, string>> = {
  zh: { flight: "飛行", rail: "火車／高鐵", cruise: "郵輪", other: "其他" },
  en: { flight: "Flight", rail: "Rail / high-speed rail", cruise: "Cruise", other: "Other" },
};

const modeOrder: TripMode[] = ["flight", "rail", "cruise", "other"];

const emptyForm = (): JourneyFormState => ({
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
  timeZone: "Asia/Taipei",
  latitude: "",
  longitude: "",
});

function placeLabel(place: Place, language: Language): string {
  const name = language === "zh" ? place.name_zh : place.name_en;
  return `${place.code} · ${name} (${place.country})`;
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

export function AddJourneyForm({ language, places, existingTrips, isSaving, onSave }: AddJourneyFormProps) {
  const [mode, setMode] = useState<TripMode | null>(null);
  const [form, setForm] = useState<JourneyFormState>(emptyForm);
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [customFor, setCustomFor] = useState<Endpoint | null>(null);
  const [placeDraft, setPlaceDraft] = useState<PlaceDraft>(emptyPlaceDraft);
  const [pendingPlaces, setPendingPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const originListId = useId();
  const destinationListId = useId();

  const c = language === "zh" ? {
    title: "新增旅程",
    description: "先選交通方式，再輸入路線與班號／車次。儲存後，資料只會留在這個瀏覽器。",
    stepOne: "1. 選擇交通方式",
    stepTwo: "2. 輸入旅程資料",
    origin: "出發地",
    destination: "目的地",
    locationPlaceholder: "輸入代碼、機場、車站或城市",
    locationHint: "開始輸入後可從本機地點清單選取。飛行只顯示機場；火車／高鐵只顯示車站。",
    addPlace: "找不到地點？新增自訂地點",
    addingPlace: "新增自訂地點",
    nameZh: "中文名稱",
    nameEn: "英文名稱",
    placeCode: "地點代碼／簡稱",
    country: "國家／地區",
    timeZone: "IANA 時區",
    coordinates: "座標（經度、緯度）",
    savePlace: "使用這個地點",
    cancel: "取消",
    service: "航班／車次",
    servicePlaceholder: "例如 BR198、THSR 615、Nozomi 21",
    serviceHint: "先選交通方式後輸入；若辨識到常見營運商，會在下方顯示本機識別標記。",
    company: "營運公司（選填）",
    companyCode: "公司代碼（選填）",
    detected: "辨識到的營運商",
    useOperator: "套用到旅程",
    logoNote: "目前顯示的是本機生成的名稱／代碼標記，不是從公司網站抓取的官方圖案。日後若接入授權時刻資料，才會顯示供應商回傳的官方圖案。",
    departure: "出發當地時間",
    arrival: "抵達當地時間",
    class: "艙等／座位等級（選填）",
    seat: "座位（選填）",
    vehicle: "交通工具／車型（選填）",
    notes: "備註（選填）",
    tags: "標籤（選填，以逗號分隔）",
    saveJourney: "儲存旅程",
    saving: "正在儲存⋯",
    routeSuggestions: "你已儲存的同路線紀錄",
    routeSuggestionHint: "這些是你自己的本機紀錄，不是即時班次；點一下可帶入營運公司與班號。",
    noRouteSuggestions: "尚無本機同路線紀錄。仍可直接手動新增。",
    liveLookupTitle: "即時班次查詢",
    liveLookupBody: "目前不會假裝顯示即時航班或車次。全球航班、鐵路和高鐵需要各地資料供應商與授權；新增旅程不會因此被阻擋。",
    chooseMode: "請先選擇交通方式。",
    choosePlaces: "請從建議清單選擇出發地與目的地，或新增自訂地點。",
    samePlace: "出發地與目的地不能相同。",
    invalidPlace: "請完整填寫自訂地點，並使用有效的 IANA 時區和座標。",
    invalidJourney: "請確認出發與抵達時間；抵達時間必須晚於出發時間。",
    saved: "已儲存旅程，也會立即出現在地圖和統計中。",
  } : {
    title: "Add a journey",
    description: "Choose a travel mode first, then record the route and service. It stays in this browser.",
    stepOne: "1. Choose a travel mode",
    stepTwo: "2. Enter journey details",
    origin: "Origin",
    destination: "Destination",
    locationPlaceholder: "Type a code, airport, station, or city",
    locationHint: "Start typing to choose from the local place list. Flights show airports; rail shows stations.",
    addPlace: "Can’t find it? Add a custom place",
    addingPlace: "Add a custom place",
    nameZh: "Chinese name",
    nameEn: "English name",
    placeCode: "Place code / short name",
    country: "Country / region",
    timeZone: "IANA time zone",
    coordinates: "Coordinates (longitude, latitude)",
    savePlace: "Use this place",
    cancel: "Cancel",
    service: "Flight / train number",
    servicePlaceholder: "For example BR198, THSR 615, Nozomi 21",
    serviceHint: "Enter it after choosing a mode. Recognised operators show a local visual mark below.",
    company: "Operating company (optional)",
    companyCode: "Company code (optional)",
    detected: "Recognised operator",
    useOperator: "Use for this journey",
    logoNote: "This is a locally rendered name/code mark, not an official logo scraped from a company site. A licensed timetable provider can later return approved official artwork.",
    departure: "Departure local time",
    arrival: "Arrival local time",
    class: "Cabin / class (optional)",
    seat: "Seat (optional)",
    vehicle: "Vehicle / train type (optional)",
    notes: "Notes (optional)",
    tags: "Tags (optional, comma-separated)",
    saveJourney: "Save journey",
    saving: "Saving…",
    routeSuggestions: "Your saved journeys on this route",
    routeSuggestionHint: "These are your local saved records, not a live timetable. Choose one to bring in its carrier and service number.",
    noRouteSuggestions: "No saved services on this route yet. You can still add it manually.",
    liveLookupTitle: "Live timetable lookup",
    liveLookupBody: "The app will not pretend a result is live. Worldwide flight, rail, and high-speed rail results require licensed providers; this never prevents manual journey entry.",
    chooseMode: "Choose a travel mode first.",
    choosePlaces: "Choose both endpoints from the suggestions, or add a custom place.",
    samePlace: "Origin and destination cannot be the same.",
    invalidPlace: "Complete the custom place with a valid IANA time zone and coordinates.",
    invalidJourney: "Check the departure and arrival times; arrival must be after departure.",
    saved: "Journey saved. It is now included in your map and statistics.",
  };

  const allPlaces = useMemo(() => deduplicatePlaces([...places, ...pendingPlaces]), [places, pendingPlaces]);
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
    if (mode !== "flight" && mode !== "rail") return undefined;
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

  function selectMode(nextMode: TripMode) {
    setMode(nextMode);
    setForm(emptyForm());
    setOriginId("");
    setDestinationId("");
    setOriginQuery("");
    setDestinationQuery("");
    setPendingPlaces([]);
    setCustomFor(null);
    setMessage("");
  }

  function findPlace(value: string): Place | undefined {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized) return undefined;
    return availablePlaces.find((place) => (
      placeLabel(place, language).toLocaleLowerCase() === normalized
      || place.code.toLocaleLowerCase() === normalized
    ));
  }

  function selectEndpoint(endpoint: Endpoint, value: string) {
    const place = findPlace(value);
    const setId = endpoint === "origin" ? setOriginId : setDestinationId;
    const setQuery = endpoint === "origin" ? setOriginQuery : setDestinationQuery;
    setQuery(value);
    setId(place?.id ?? "");
    if (place) setQuery(placeLabel(place, language));
  }

  function updateDraft(field: keyof PlaceDraft, value: string) {
    setPlaceDraft((current) => ({ ...current, [field]: value }));
  }

  function beginCustomPlace(endpoint: Endpoint) {
    setCustomFor(endpoint);
    setPlaceDraft(emptyPlaceDraft());
    setMessage("");
  }

  function addCustomPlace() {
    if (!mode || !customFor) return;
    const kind = modePlaceKind(mode) ?? "custom";
    const parsed = PlaceSchema.safeParse({
      id: `custom-${crypto.randomUUID()}`,
      name_zh: placeDraft.nameZh.trim(),
      name_en: placeDraft.nameEn.trim(),
      code: placeDraft.code.trim().toUpperCase(),
      kind,
      latitude: Number(placeDraft.latitude),
      longitude: Number(placeDraft.longitude),
      country: placeDraft.country.trim(),
      time_zone: placeDraft.timeZone.trim(),
    });
    if (!parsed.success) return setMessage(c.invalidPlace);
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: parsed.data.time_zone }).format();
    } catch {
      return setMessage(c.invalidPlace);
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
    setMessage("");
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
      vehicleType: trip.vehicle_type ?? "",
      seatClass: trip.seat_class,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return setMessage(c.chooseMode);
    if (!origin || !destination) return setMessage(c.choosePlaces);
    if (origin.id === destination.id) return setMessage(c.samePlace);

    try {
      const trip = buildManualTrip({
        id: crypto.randomUUID(),
        mode,
        origin,
        destination,
        departureLocal: form.departureLocal,
        arrivalLocal: form.arrivalLocal,
        carrier: form.carrier,
        carrierCode: form.carrierCode,
        serviceNumber: form.serviceNumber,
        seatClass: form.seatClass,
        seat: form.seat,
        vehicleType: form.vehicleType,
        notes: form.notes,
        tags: form.tags.split(","),
      });
      await onSave(trip, pendingPlaces);
      setMessage(c.saved);
      setMode(null);
      setForm(emptyForm());
      setOriginId("");
      setDestinationId("");
      setOriginQuery("");
      setDestinationQuery("");
      setPendingPlaces([]);
      setCustomFor(null);
    } catch {
      setMessage(c.invalidJourney);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900 dark:bg-teal-950/30 sm:p-6" aria-labelledby="add-journey-title">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Journey entry</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white" id="add-journey-title">{c.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{c.description}</p>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{c.stepOne}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={c.stepOne}>
          {modeOrder.map((item) => (
            <button
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${mode === item ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
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
              const listId = endpoint === "origin" ? originListId : destinationListId;
              return (
                <div key={endpoint}>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {label}
                    <input
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      list={listId}
                      onChange={(event) => selectEndpoint(endpoint, event.target.value)}
                      placeholder={c.locationPlaceholder}
                      value={query}
                    />
                  </label>
                  <datalist id={listId}>
                    {availablePlaces.map((place) => <option key={place.id} value={placeLabel(place, language)} />)}
                  </datalist>
                  <button className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 dark:text-teal-300" onClick={() => beginCustomPlace(endpoint)} type="button">{c.addPlace}</button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{c.locationHint}</p>

          {customFor ? <fieldset className="mt-5 rounded-2xl border border-teal-200 bg-white p-4 dark:border-teal-900 dark:bg-slate-950">
            <legend className="px-1 text-sm font-bold text-slate-800 dark:text-slate-100">{c.addingPlace} · {customFor === "origin" ? c.origin : c.destination}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <InputField label={c.nameZh} onChange={(value) => updateDraft("nameZh", value)} value={placeDraft.nameZh} />
              <InputField label={c.nameEn} onChange={(value) => updateDraft("nameEn", value)} value={placeDraft.nameEn} />
              <InputField label={c.placeCode} onChange={(value) => updateDraft("code", value)} value={placeDraft.code} />
              <InputField label={c.country} onChange={(value) => updateDraft("country", value)} value={placeDraft.country} />
              <InputField label={c.timeZone} onChange={(value) => updateDraft("timeZone", value)} placeholder="Asia/Taipei" value={placeDraft.timeZone} />
              <div className="grid grid-cols-2 gap-2">
                <InputField label={`${c.coordinates} — longitude`} onChange={(value) => updateDraft("longitude", value)} placeholder="121.5654" type="number" value={placeDraft.longitude} />
                <InputField label={`${c.coordinates} — latitude`} onChange={(value) => updateDraft("latitude", value)} placeholder="25.0330" type="number" value={placeDraft.latitude} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800" onClick={addCustomPlace} type="button">{c.savePlace}</button>
              <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200" onClick={() => setCustomFor(null)} type="button">{c.cancel}</button>
            </div>
          </fieldset> : null}

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
          {(mode === "flight" || mode === "rail") ? <p className="mt-2 text-xs leading-5 text-slate-500">{c.logoNote}</p> : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InputField label={c.company} onChange={(value) => setForm((current) => ({ ...current, carrier: value }))} value={form.carrier} />
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
            <button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? c.saving : c.saveJourney}</button>
            <p aria-live="polite" className="text-sm font-medium text-teal-800 dark:text-teal-200">{message}</p>
          </div>
        </form>
      ) : <p className="mt-5 text-sm text-slate-500">{c.chooseMode}</p>}
    </section>
  );
}

function InputField({ label, onChange, placeholder, type = "text", value }: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "datetime-local";
  value: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} step={type === "number" ? "any" : undefined} type={type} value={value} />
    </label>
  );
}
