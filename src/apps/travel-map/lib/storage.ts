import { dropUnknown, emptyData, travelDataSchema, type KnownCodes, type TravelData } from "./data";

export const STORAGE_KEY = "travel-map:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Store {
  load(): TravelData;
  save(data: TravelData): void;
  clear(): void;
  isPersistent(): boolean;
}

function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createStore(storage: StorageLike | null = browserStorage()): Store {
  let memory: TravelData | null = null;
  let persistent = storage !== null;

  return {
    load() {
      if (memory) return memory;
      if (!storage) return emptyData();
      let raw: string | null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        persistent = false;
        return emptyData();
      }
      if (raw === null) return emptyData();
      try {
        const parsed = travelDataSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return (memory = parsed.data);
      } catch {
        // fall through to the corrupt path
      }
      try {
        storage.setItem(`${STORAGE_KEY}:corrupt`, raw);
      } catch {
        // nothing else we can do
      }
      return emptyData();
    },
    save(data) {
      memory = data;
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        persistent = false;
      }
    },
    clear() {
      memory = null;
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        persistent = false;
      }
    },
    isPersistent: () => persistent,
  };
}

export function exportJson(data: TravelData): string {
  return JSON.stringify(data, null, 2);
}

export type ImportResult =
  | { ok: true; data: TravelData; warnings: string[] }
  | { ok: false; errors: string[] };

export function importJson(text: string, known: KnownCodes): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  const parsed = travelDataSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const { data, unknown } = dropUnknown(parsed.data, known);
  const warnings = unknown.length ? [`Ignored unknown place codes: ${unknown.join(", ")}`] : [];
  return { ok: true, data, warnings };
}

export function downloadJson(data: TravelData, filename = "travel-map.json"): void {
  const blob = new Blob([exportJson(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
