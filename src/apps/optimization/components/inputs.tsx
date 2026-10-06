import { useEffect, useState } from "preact/hooks";
import type { Example } from "@apps/optimization/lib/examples";
import { parseNumber } from "@apps/optimization/lib/format";
import { cn } from "@lib/utils";
import { input } from "./ui";

/**
 * A number field that accepts "-2.5" and "1/3". The text is kept as typed; `onChange` fires only
 * while it reads as a number, so half-typed input ("-", "1/") doesn't reset anything.
 */
export function NumberInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const [text, setText] = useState(String(value));

  // Follow changes made elsewhere (picking an example), but not our own edits
  useEffect(() => {
    if (parseNumber(text) !== value) setText(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      class={cn(input, "w-14 text-right font-mono", parseNumber(text) === null && "border-rose-500 dark:border-rose-400")}
      value={text}
      onInput={(e) => {
        const next = e.currentTarget.value;
        setText(next);
        const parsed = parseNumber(next);
        if (parsed !== null) onChange(parsed);
      }}
    />
  );
}

/** Loads one of the ready-made inputs. Always shows its placeholder: the input may have been edited since. */
export function ExamplePicker<T>({ examples, onPick }: { examples: Example<T>[]; onPick: (value: T) => void }) {
  return (
    <select
      class={input}
      aria-label="Load an example"
      value=""
      onChange={(e) => {
        const example = examples[Number(e.currentTarget.value)];
        if (example) onPick(structuredClone(example.value));
        e.currentTarget.value = "";
      }}
    >
      <option value="" disabled>
        Load an example…
      </option>
      {examples.map((example, i) => (
        <option key={example.name} value={i}>
          {example.name}
        </option>
      ))}
    </select>
  );
}
