import { useEffect, useState } from "preact/hooks";
import { btn } from "./ui";

interface Props {
  min: number;
  max: number;
  value: number | null;
  onChange: (year: number | null) => void;
}

/** The slider's last notch (max + 1) means "All". */
export function TimelineSlider({ min, max, value, onChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const all = max + 1;
  const pos = value ?? all;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = (value ?? min - 1) + 1;
      if (next > max) {
        setPlaying(false);
        onChange(null);
      } else onChange(next);
    }, 700);
    return () => clearInterval(id);
  }, [playing, value, min, max]);

  return (
    <div class="flex items-center gap-3 text-sm">
      <button
        type="button"
        class={btn}
        onClick={() => {
          if (!playing && value === null) onChange(min);
          setPlaying(!playing);
        }}
      >
        {playing ? "⏸ Pause" : "▶ Play"}
      </button>
      <input
        type="range"
        class="flex-1"
        min={min}
        max={all}
        step={1}
        value={pos}
        aria-label="Year"
        aria-valuetext={value === null ? "All years" : String(value)}
        onInput={(e) => {
          setPlaying(false);
          const v = Number((e.currentTarget as HTMLInputElement).value);
          onChange(v >= all ? null : v);
        }}
      />
      <span class="w-12 text-right tabular-nums text-black dark:text-white">{value ?? "All"}</span>
    </div>
  );
}
