"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AppLanguage = "zh" | "en";

const STORAGE_KEY = "journey-log-language";
const listeners = new Set<() => void>();
// Fallback for browsers where storage is blocked, so the switch still works
// for this visit even though it cannot be remembered.
let memoryLanguage: AppLanguage | undefined;

function readLanguage(): AppLanguage {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // Storage unavailable: fall through to the in-memory choice.
  }
  return memoryLanguage ?? "zh";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The interface language, remembered on this device and shared by every page,
 * so choosing English on the journey page also applies to the expense page.
 */
export function useLanguagePreference(): [AppLanguage, (language: AppLanguage) => void] {
  const language = useSyncExternalStore(subscribe, readLanguage, () => "zh" as AppLanguage);
  const setLanguage = useCallback((next: AppLanguage) => {
    memoryLanguage = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted, but still switch for this page view.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [language, setLanguage];
}
