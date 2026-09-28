import { useId, useState } from "preact/hooks";
import { loadCities, type CityRow } from "@lib/map/cities";
import { countryName } from "@lib/map/meta";
import { searchPlaces, type Place } from "@lib/map/places";
import { cn } from "@lib/utils";
import { input } from "./ui";

interface Props {
  onPick: (place: Place) => void;
  label: string;
  placeholder?: string;
  /** Also search cities (the bundled list loads the first time the box gets focus). */
  cities?: boolean;
  class?: string;
}

const ICON: Record<Place["kind"], string> = { country: "🌍", region: "🗺", city: "📍" };

function placeKey(p: Place): string {
  if (p.kind === "country") return p.iso;
  if (p.kind === "region") return p.code;
  return `${p.iso}-${p.name}-${p.lat}-${p.lon}`;
}

/** Type-ahead place search (ARIA combobox): arrows move, Enter picks, Escape closes. */
export function PlaceSearch({ onPick, label, placeholder = label, cities = false, class: className }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<CityRow[] | null>(null);
  const results = searchPlaces(query, cities ? rows : null);
  const expanded = open && results.length > 0;

  function pick(place: Place) {
    onPick(place);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (results.length ? (a + step + results.length) % results.length : 0));
    } else if (e.key === "Enter" && expanded) {
      e.preventDefault();
      pick(results[Math.min(active, results.length - 1)]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div class={cn("relative", className)}>
      <input
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        autoComplete="off"
        class={cn(input, "bg-stone-100 dark:bg-stone-900 py-1.5")}
        placeholder={placeholder}
        value={query}
        onInput={(e) => {
          setQuery((e.currentTarget as HTMLInputElement).value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => {
          setOpen(true);
          if (cities && !rows) loadCities().then(setRows, () => setRows([]));
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          class="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border border-black/15 dark:border-white/20 bg-stone-100 dark:bg-stone-900 py-1 text-sm shadow-lg"
        >
          {results.map((p, i) => (
            <li
              key={placeKey(p)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              class={cn(
                "flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-black dark:text-white",
                i === active && "bg-black/10 dark:bg-white/15",
              )}
              // mousedown (not click) so it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span aria-hidden="true">{ICON[p.kind]}</span>
              <span class="flex-1">{p.name}</span>
              {p.kind !== "country" && <span class="text-xs text-black/50 dark:text-white/60">{countryName(p.iso)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
