import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { STATUSES, parseYears, type CountryEntry, type ISO3 } from "@lib/map/data";
import { countryName } from "@lib/map/meta";
import { cn } from "@lib/utils";
import { btn, btnActive, input, overlay, STATUS_LABEL } from "./ui";
import { Swatch } from "./Swatch";

interface Props {
  iso: ISO3;
  entry: CountryEntry | undefined;
  onChange: (entry: CountryEntry | null) => void;
  onClose: () => void;
  children?: ComponentChildren;
}

export function CountryPanel({ iso, entry, onChange, onClose, children }: Props) {
  const [yearsText, setYearsText] = useState(entry?.years?.join(", ") ?? "");
  useEffect(() => setYearsText(entry?.years?.join(", ") ?? ""), [iso, entry?.years?.join(",")]);

  return (
    <section class={cn(overlay, "space-y-4 p-4")} aria-label={`${countryName(iso)} details`}>
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-lg font-semibold text-black dark:text-white">{countryName(iso)}</h2>
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
