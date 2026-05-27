import type { ScanHistoryEntry } from "./types";

const SCAN_HISTORY_STORAGE_KEY = "aegis.scan-history.v1";
const SCAN_HISTORY_LIMIT = 18;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeHistory(entries: ScanHistoryEntry[]): ScanHistoryEntry[] {
  return [...entries]
    .sort(
      (left, right) =>
        new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()
    )
    .slice(0, SCAN_HISTORY_LIMIT);
}

export function loadScanHistory(): ScanHistoryEntry[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const entries = parsedValue.filter((entry): entry is ScanHistoryEntry => {
      return (
        Boolean(entry) &&
        typeof entry.id === "string" &&
        typeof entry.capturedAt === "string" &&
        typeof entry.reason === "string" &&
        Boolean(entry.scan) &&
        typeof entry.scan.id === "string" &&
        typeof entry.scan.createdAt === "string"
      );
    });

    return normalizeHistory(entries);
  } catch (error) {
    console.warn("Failed to load scan history from storage", error);
    return [];
  }
}

export function saveScanHistory(entries: ScanHistoryEntry[]): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      SCAN_HISTORY_STORAGE_KEY,
      JSON.stringify(normalizeHistory(entries))
    );
  } catch (error) {
    console.warn("Failed to save scan history to storage", error);
  }
}

export function upsertScanHistoryEntry(
  entries: ScanHistoryEntry[],
  nextEntry: ScanHistoryEntry
): ScanHistoryEntry[] {
  return normalizeHistory(
    [nextEntry, ...entries].filter((entry, index, collection) => {
      return (
        collection.findIndex((candidate) => candidate.id === entry.id) === index
      );
    })
  );
}

export function clearScanHistory(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SCAN_HISTORY_STORAGE_KEY);
}
