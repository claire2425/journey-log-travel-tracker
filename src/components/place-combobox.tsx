"use client";

import { useEffect, useId, useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { displayPlaceCode } from "@/lib/place-display";
import { placeIdentityKey, searchPlaces } from "@/lib/place-search";
import type { Place } from "@/lib/types";

type PlaceComboboxProps = {
  label: string;
  language: "zh" | "en";
  noMatches: string;
  searchFailed: string;
  searching: string;
  placeholder: string;
  places: Place[];
  globalKind?: "airport" | "station";
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
};

function placeName(place: Place, language: "zh" | "en") {
  return language === "zh" ? place.name_zh : place.name_en;
}

function placeLocation(place: Place) {
  return [place.city, place.country].filter(Boolean).join(", ");
}

function placeKind(place: Place, language: "zh" | "en") {
  const labels = language === "zh"
    ? { airport: "機場", station: "車站", custom: "自訂地點" }
    : { airport: "Airport", station: "Station", custom: "Custom place" };
  return labels[place.kind];
}

/**
 * A keyboard-accessible place picker. It never contacts a geocoding or
 * timetable provider while the user types; global results come from this
 * application's bundled reference data and locally saved places.
 */
export function PlaceCombobox({
  label,
  language,
  noMatches,
  searchFailed,
  searching,
  placeholder,
  places,
  globalKind,
  value,
  onChange,
  onSelect,
}: PlaceComboboxProps) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [globalPlaces, setGlobalPlaces] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const localSuggestions = useMemo(() => searchPlaces(places, value), [places, value]);
  const suggestions = useMemo(() => {
    // Saved / bundled places come first and win over a global record for the
    // same airport or station code, so "TPE" is not listed twice.
    const uniquePlaces = new Map<string, Place>();
    for (const place of [...localSuggestions, ...globalPlaces]) {
      const key = placeIdentityKey(place);
      if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
    }
    return [...uniquePlaces.values()].slice(0, 8);
  }, [globalPlaces, localSuggestions]);
  const hasQuery = Boolean(value.trim());
  const hasSuggestions = suggestions.length > 0;
  const activeId = isOpen && hasSuggestions && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    const query = value.normalize("NFKC").trim();
    if (!globalKind || !isOpen || query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      try {
        const params = new URLSearchParams({ kind: globalKind, q: query });
        const response = await fetch(`/api/places/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Global place data unavailable");
        const body = await response.json() as { places?: Place[] };
        if (!Array.isArray(body.places)) throw new Error("Invalid global place response");
        if (controller.signal.aborted) return;
        setGlobalPlaces(body.places);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setGlobalPlaces([]);
          setSearchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [globalKind, isOpen, value]);

  function selectPlace(place: Place) {
    onSelect(place);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function updateValue(nextValue: string) {
    onChange(nextValue);
    setIsOpen(true);
    setActiveIndex(-1);
    setGlobalPlaces([]);
    setIsSearching(false);
    setSearchError(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!hasSuggestions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => {
        if (!isOpen || current < 0) return 0;
        return Math.min(current + 1, suggestions.length - 1);
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => {
        if (!isOpen || current < 0) return suggestions.length - 1;
        return Math.max(current - 1, 0);
      });
      return;
    }

    if (event.key === "Enter" && isOpen) {
      const activePlace = suggestions[activeIndex];
      if (!activePlace) return;
      event.preventDefault();
      selectPlace(activePlace);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocus = event.relatedTarget;
    if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
    window.setTimeout(() => setIsOpen(false), 0);
  }

  return (
    <div className="relative" onBlur={handleBlur}>
      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
        <input
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen && hasQuery}
          aria-busy={isSearching}
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          onChange={(event) => updateValue(event.target.value)}
          onFocus={() => { if (hasQuery) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          value={value}
        />
      </label>
      {isOpen && hasQuery ? <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900" id={listId} role="listbox">
        {hasSuggestions ? suggestions.map((place, index) => {
          const isActive = index === activeIndex;
          const code = displayPlaceCode(place);
          return <li
            aria-selected={isActive}
            className={`cursor-pointer rounded-lg px-3 py-2.5 outline-none ${isActive ? "bg-teal-700 text-white" : "text-slate-800 hover:bg-teal-50 dark:text-slate-100 dark:hover:bg-teal-950"}`}
            id={`${listId}-option-${index}`}
            key={place.id}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPlace(place);
              }
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              selectPlace(place);
            }}
            onMouseEnter={() => setActiveIndex(index)}
            role="option"
            tabIndex={-1}
          >
            <span className="flex items-start gap-3">
              {code ? <span className={`mt-0.5 rounded-md px-2 py-0.5 text-xs font-black tracking-wide ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>{code}</span> : null}
              <span className="min-w-0">
                <span className="block truncate font-bold">{placeName(place, language)}</span>
                <span className={`mt-0.5 block truncate text-xs ${isActive ? "text-teal-50" : "text-slate-500 dark:text-slate-400"}`}>{placeLocation(place)} · {placeKind(place, language)}</span>
              </span>
            </span>
          </li>;
        }) : isSearching ? <li className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400" role="status">{searching}</li>
          : searchError ? <li aria-disabled="true" aria-selected="false" className="px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300" role="option">{searchFailed}</li>
            : <li aria-disabled="true" aria-selected="false" className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400" role="option">{noMatches}</li>}
      </ul> : null}
    </div>
  );
}
