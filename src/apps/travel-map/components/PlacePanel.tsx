import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { STATUSES, parseYears, type CountryEntry } from "@apps/travel-map/lib/data";
import { cn } from "@lib/utils";
import { btn, btnActive, input, overlay, STATUS_LABEL } from "./ui";
import { Swatch } from "./Swatch";

interface Props {
  /** Country or state name. */
  name: string;
  entry: CountryEntry | undefined;
  onChange: (entry: CountryEntry | null) => void;
  onClose: () => void;
  /** For a state: a link back to its country's panel. */
  back?: { label: string; onClick: () => void };
  children?: ComponentChildren;
}

/** Status, years and note for a country or a state, floating over the map. */
export function PlacePanel({ name, entry, onChange, onClose, back, children }: Props) {
  const [yearsText, setYearsText] = useState(entry?.years?.join(", ") ?? "");
  useEffect(() => setYearsText(entry?.years?.join(", ") ?? ""), [name, entry?.years?.join(",")]);

  return (
    <section class={cn(overlay, "space-y-4 p-4")} aria-label={`${name} details`}>
      <div class="flex items-start justify-between gap-2">
        <div>
          {back && (
            <button type="button" class="text-xs underline underline-offset-2" onClick={back.onClick}>
              ← {back.label}
            </button>
          )}
          <h2 class="text-lg font-semibold text-black dark:text-white">{name}</h2>
        </div>
        <button type="button" class={btn} onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div class="flex flex-wrap gap-2" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            class={cn(btn, entry?.status === s && btnActive)}
            aria-pressed={entry?.status === s}
            onClick={() => onChange({ ...entry, status: s })}
          >
            <Swatch color={s} /> {STATUS_LABEL[s]}
          </button>
        ))}
        {entry && (
          <button type="button" class={btn} onClick={() => onChange(null)}>Remove</button>
        )}
      </div>

      {entry && (
        <>
          <label class="block space-y-1 text-sm">
            <span>Years (e.g. 2019, 2023)</span>
            <input
              class={input}
              inputMode="numeric"
              value={yearsText}
              onInput={(e) => setYearsText((e.currentTarget as HTMLInputElement).value)}
              onBlur={() => {
                const years = parseYears(yearsText);
                onChange({ ...entry, years: years.length ? years : undefined });
                setYearsText(years.join(", "));
              }}
            />
          </label>
          <label class="block space-y-1 text-sm">
            <span>Note</span>
            <textarea
              class={input}
              rows={3}
              maxLength={2000}
              value={entry.note ?? ""}
              onInput={(e) => {
                const note = (e.currentTarget as HTMLTextAreaElement).value;
                onChange({ ...entry, note: note || undefined });
              }}
            />
          </label>
        </>
      )}

      {children}
    </section>
  );
}
