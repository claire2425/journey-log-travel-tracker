"use client";

import { useId, useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { searchOperators } from "@/lib/operator-search";
import type { OperatorDirectoryEntry, OperatorMode } from "@/lib/operator-directory";

type OperatorComboboxProps = {
  label: string;
  language: "zh" | "en";
  mode: OperatorMode;
  noMatches: string;
  onChange: (value: string) => void;
  onSelect: (operator: OperatorDirectoryEntry) => void;
  placeholder: string;
  value: string;
};

function displayName(operator: OperatorDirectoryEntry, language: "zh" | "en") {
  return language === "zh" ? operator.label_zh : operator.label;
}

/** Keyboard-accessible selector for locally bundled, widely used operators. */
export function OperatorCombobox({
  label,
  language,
  mode,
  noMatches,
  onChange,
  onSelect,
  placeholder,
  value,
}: OperatorComboboxProps) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(() => searchOperators(mode, value), [mode, value]);
  const hasQuery = Boolean(value.trim());
  const hasSuggestions = suggestions.length > 0;
  const activeId = isOpen && hasSuggestions && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;

  function selectOperator(operator: OperatorDirectoryEntry) {
    onSelect(operator);
    setIsOpen(false);
    setActiveIndex(-1);
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
      setActiveIndex((current) => !isOpen || current < 0 ? 0 : Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => !isOpen || current < 0 ? suggestions.length - 1 : Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && isOpen) {
      const activeOperator = suggestions[activeIndex];
      if (!activeOperator) return;
      event.preventDefault();
      selectOperator(activeOperator);
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
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none ring-teal-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => { if (hasQuery) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          value={value}
        />
      </label>
      {isOpen && hasQuery ? <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900" id={listId} role="listbox">
        {hasSuggestions ? suggestions.map((operator, index) => {
          const isActive = index === activeIndex;
          return <li
            aria-selected={isActive}
            className={`cursor-pointer rounded-lg px-3 py-2.5 outline-none ${isActive ? "bg-teal-700 text-white" : "text-slate-800 hover:bg-teal-50 dark:text-slate-100 dark:hover:bg-teal-950"}`}
            id={`${listId}-option-${index}`}
            key={`${operator.mode}-${operator.code}`}
            onMouseDown={(event) => {
              event.preventDefault();
              selectOperator(operator);
            }}
            onMouseEnter={() => setActiveIndex(index)}
            role="option"
            tabIndex={-1}
          >
            <span className="flex items-start gap-3">
              <span
                className={`mt-0.5 rounded-md px-2 py-0.5 text-xs font-black tracking-wide text-white ${isActive ? "bg-white/20" : ""}`}
                style={isActive ? undefined : { backgroundColor: operator.brand_color }}
              >
                {operator.logo_text}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold">{displayName(operator, language)}</span>
                <span className={`mt-0.5 block truncate text-xs ${isActive ? "text-teal-50" : "text-slate-500 dark:text-slate-400"}`}>{operator.label} · {operator.code}</span>
              </span>
            </span>
          </li>;
        }) : <li aria-disabled="true" aria-selected="false" className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400" role="option">{noMatches}</li>}
      </ul> : null}
    </div>
  );
}
