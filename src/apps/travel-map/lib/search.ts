/** Lowercase and strip accents so "sao" matches "São". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Items whose name starts with the query, then items that contain it. Keeps input order within each group. */
export function rankByName<T>(items: T[], name: (item: T) => string, query: string, limit: number): T[] {
  const q = fold(query.trim());
  const prefix: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const n = fold(name(item));
    if (n.startsWith(q)) prefix.push(item);
    else if (n.includes(q)) contains.push(item);
  }
  return [...prefix, ...contains].slice(0, limit);
}
