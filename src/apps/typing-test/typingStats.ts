// Pure helpers for the homepage typing test (no DOM access)

// A line break in the text can be typed with either Enter or Space
export function isCorrectChar(typed: string, expected: string | undefined) {
  return typed === expected || (expected === "\n" && typed === " ");
}

export function countCorrect(typed: string, target: string) {
  let count = 0;
  for (let i = 0; i < typed.length; i++) {
    if (isCorrectChar(typed[i], target[i])) count++;
  }
  return count;
}

// Characters added between two input states, counted from where they diverge
// (handles backspace, and mobile autocorrect replacing earlier characters)
export function countNewKeystrokes(prev: string, next: string, target: string) {
  let prefix = 0;
  while (
    prefix < prev.length &&
    prefix < next.length &&
    prev[prefix] === next[prefix]
  ) {
    prefix++;
  }

  let keystrokes = 0;
  let mistakes = 0;
  for (let i = prefix; i < next.length; i++) {
    keystrokes++;
    if (!isCorrectChar(next[i], target[i])) mistakes++;
  }
  return { keystrokes, mistakes };
}

// Standard WPM: one "word" is 5 correct characters
export function wordsPerMinute(correctChars: number, elapsedMs: number) {
  const minutes = elapsedMs / 60000;
  return minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0;
}

export function accuracyPercent(keystrokes: number, mistakes: number) {
  return keystrokes
    ? Math.round(((keystrokes - mistakes) / keystrokes) * 100)
    : 100;
}
