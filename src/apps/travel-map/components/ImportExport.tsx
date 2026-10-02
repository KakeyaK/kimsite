import { useState } from "preact/hooks";
import type { TravelData } from "@apps/travel-map/lib/data";
import { downloadJson, importJson } from "@apps/travel-map/lib/storage";
import { KNOWN_CODES } from "@apps/travel-map/lib/meta";
import { btn } from "./ui";

interface Props {
  data: TravelData;
  onImport: (data: TravelData) => void;
  onClear: () => void;
}

export function ImportExport({ data, onImport, onClear }: Props) {
  const [messages, setMessages] = useState<{ kind: "error" | "warning" | "ok"; text: string }[]>([]);
  const isEmpty = Object.keys(data.countries).length === 0;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const result = importJson(await file.text(), KNOWN_CODES);
    if (!result.ok) {
      setMessages(result.errors.slice(0, 10).map((text) => ({ kind: "error", text })));
      return;
    }
    if (!isEmpty && !confirm("Replace your current map with this file?")) return;
    onImport(result.data);
    setMessages([
      { kind: "ok", text: "Imported." },
      ...result.warnings.map((text) => ({ kind: "warning" as const, text })),
    ]);
  }

  return (
    <section aria-label="Import and export" class="space-y-2 text-sm">
      <div class="flex flex-wrap gap-2">
        <button type="button" class={btn} onClick={() => downloadJson(data)}>Export JSON</button>
        <label class={`${btn} cursor-pointer`}>
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            class="sr-only"
            onChange={(e) => {
              const el = e.currentTarget as HTMLInputElement;
              void handleFile(el.files?.[0]);
              el.value = "";
            }}
          />
        </label>
        <button
          type="button"
          class={btn}
          disabled={isEmpty}
          onClick={() => confirm("Clear your whole map? Export first if you want a copy.") && onClear()}
        >
          Clear map
        </button>
      </div>
      {messages.length > 0 && (
        <ul role="status" class="space-y-0.5">
          {messages.map((m, i) => (
            <li key={i} class={m.kind === "error" ? "text-rose-600 dark:text-rose-400" : m.kind === "warning" ? "text-amber-600 dark:text-amber-400" : ""}>
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
