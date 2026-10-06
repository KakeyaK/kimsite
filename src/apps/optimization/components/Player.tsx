import { useEffect, useState } from "preact/hooks";
import { btn, input } from "./ui";

/** Time each step stays on screen at 1× speed; the step animations in styles.css fit inside it. */
const STEP_MS = 1400;
const SPEEDS = [0.5, 1, 2, 4];

export type Player = {
  /** The step being shown. */
  index: number;
  count: number;
  playing: boolean;
  speed: number;
  goTo: (index: number) => void;
  toggle: () => void;
  setSpeed: (speed: number) => void;
};

/** Steps through `count` frames, by hand or on a timer. Starts over, paused, whenever `source` changes. */
export function usePlayer(count: number, source: unknown): Player {
  // Kept with the source it belongs to: a position left over from another run reads as "at the start"
  const [state, setState] = useState({ source, position: 0, playing: false });
  const [speed, setSpeed] = useState(1);
  const { position, playing } = state.source === source ? state : { position: 0, playing: false };
  const last = Math.max(count - 1, 0);
  const index = Math.min(position, last);
  const set = (position: number, playing: boolean) => setState({ source, position, playing });

  useEffect(() => {
    if (!playing) return;
    if (index >= last) return set(index, false);
    const timer = setTimeout(() => set(index + 1, true), STEP_MS / speed);
    return () => clearTimeout(timer);
  }, [source, playing, index, last, speed]);

  return {
    index,
    count,
    playing,
    speed,
    setSpeed,
    goTo: (next) => set(Math.max(0, Math.min(next, last)), false),
    // Play from the end starts over
    toggle: () => set(!playing && index >= last ? 0 : index, !playing),
  };
}

export function PlayerControls({ player }: { player: Player }) {
  const { index, count, playing, speed } = player;
  const last = Math.max(count - 1, 0);
  return (
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class={btn} onClick={() => player.goTo(0)} disabled={index === 0} aria-label="First step">
        «
      </button>
      <button type="button" class={btn} onClick={() => player.goTo(index - 1)} disabled={index === 0} aria-label="Previous step">
        ‹
      </button>
      <button type="button" class={`${btn} min-w-16`} onClick={player.toggle} disabled={last === 0}>
        {playing ? "Pause" : "Play"}
      </button>
      <button type="button" class={btn} onClick={() => player.goTo(index + 1)} disabled={index === last} aria-label="Next step">
        ›
      </button>
      <button type="button" class={btn} onClick={() => player.goTo(last)} disabled={index === last} aria-label="Last step">
        »
      </button>
      {/* Also the keyboard control: arrow keys step while it has focus */}
      <input
        type="range"
        class="min-w-24 flex-1 accent-black dark:accent-white"
        min={0}
        max={last}
        value={index}
        disabled={last === 0}
        aria-label="Step"
        onInput={(e) => player.goTo(Number(e.currentTarget.value))}
      />
      <span class="text-sm tabular-nums">
        {index} / {last}
      </span>
      <select
        class={input}
        aria-label="Speed"
        value={speed}
        onChange={(e) => player.setSpeed(Number(e.currentTarget.value))}
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>
    </div>
  );
}
