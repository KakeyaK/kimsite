type SearchKind = "Page" | "Folder" | "Post" | "Project" | "App";

type SearchItem = {
  title: string;
  description: string;
  href: string;
  kind: SearchKind;
  /** Breadcrumb of where the item lives, e.g. "Blog / University of São Paulo". */
  path?: string;
};

/** Lowercase and strip accents so "sao" matches "São". */
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const WORD_BREAK = /[^\p{L}\p{N}]+/u;

/** Letters of `needle` appear in order in `haystack`, starting at the start of a word. */
function isLooseMatch(needle: string, haystack: string) {
  const words = haystack.split(WORD_BREAK);
  return words.some((word, start) => {
    if (!word.startsWith(needle[0])) return false;
    let i = 0;
    for (const char of words.slice(start).join(" ")) {
      if (char === needle[i]) i++;
      if (i === needle.length) return true;
    }
    return false;
  });
}

/** How well one query word matches an item; 0 means it does not match. */
function scoreWord(word: string, title: string, rest: string) {
  if (title.startsWith(word)) return 5;
  if (title.split(WORD_BREAK).some((part) => part.startsWith(word))) return 4;
  if (title.includes(word)) return 3;
  if (rest.includes(word)) return 2;
  if (isLooseMatch(word, title)) return 1;
  return 0;
}

/**
 * Items matching every word of the query, best match first. Ties keep the
 * input order, and an empty query returns every item.
 */
function searchItems(items: SearchItem[], query: string): SearchItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;

  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const title = fold(item.title);
    const rest = fold(`${item.description} ${item.path ?? ""} ${item.kind}`);
    let score = 0;
    for (const word of words) {
      const wordScore = scoreWord(word, title, rest);
      if (wordScore === 0) {
        score = 0;
        break;
      }
      score += wordScore;
    }
    if (score > 0) scored.push({ item, score });
  }

  return scored.sort((a, b) => b.score - a.score).map(({ item }) => item);
}

export type { SearchItem, SearchKind };
export { searchItems };
