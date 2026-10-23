import { useSyncExternalStore } from "react";

/**
 * How the app looks on this device — choices made in Settings that belong to
 * the browser rather than to the company's data (Diamond Fencing's prefs).
 */
export interface AppPrefs {
  /** Every module in the sidebar, each opening to its pages. Off: one module at a time, switched from the header. */
  sidebarAllModules: boolean;
}

const KEY = "kyn_app_prefs";
const DEFAULTS: AppPrefs = { sidebarAllModules: true };

const listeners = new Set<() => void>();
let cached: AppPrefs | null = null;

function read(): AppPrefs {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppPrefs>) } : DEFAULTS;
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

export function setPrefs(patch: Partial<AppPrefs>): void {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Not remembering a preference is harmless; it still applies until reload.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePrefs(): AppPrefs {
  return useSyncExternalStore(subscribe, read, read);
}
