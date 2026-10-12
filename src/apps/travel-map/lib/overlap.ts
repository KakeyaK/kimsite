import type { CountryEntry, Status, TravelData } from "./data";

/**
 * Two maps compared: the owner's (Kim's, or a friend's shared map) and the visitor's own.
 * "Been" means visited or lived. A place only one of them wants, and neither has been to, gets no colour.
 */
export const OVERLAP_KEYS = ["both-been", "both-want", "only-them", "only-you"] as const;
export type OverlapKey = (typeof OVERLAP_KEYS)[number];

const been = (s: Status | undefined) => s === "visited" || s === "lived";

export function overlapKey(owner: Status | undefined, visitor: Status | undefined): OverlapKey | null {
  if (been(owner) && been(visitor)) return "both-been";
  if (been(owner)) return "only-them";
  if (been(visitor)) return "only-you";
  if (owner === "want" && visitor === "want") return "both-want";
  return null;
}

function compare(owner: Record<string, CountryEntry>, visitor: Record<string, CountryEntry>): Record<string, OverlapKey> {
  const out: Record<string, OverlapKey> = {};
  for (const code of new Set([...Object.keys(owner), ...Object.keys(visitor)])) {
    const key = overlapKey(owner[code]?.status, visitor[code]?.status);
    if (key) out[code] = key;
  }
  return out;
}

/** The colour of every country and state in overlap mode. */
export function overlapColors(owner: TravelData, visitor: TravelData) {
  return { countries: compare(owner.countries, visitor.countries), regions: compare(owner.regions, visitor.regions) };
}

/** What each overlap colour stands for. */
export function overlapLabels(ownerName: string): Record<OverlapKey, string> {
  return {
    "both-been": "Both been",
    "both-want": "Both want to go",
    "only-them": `Only ${ownerName}`,
    "only-you": "Only you",
  };
}

const OWNER_PHRASE: Record<Status | "none", string> = {
  visited: "has been", lived: "has lived there", want: "wants to go", none: "hasn't been",
};
const VISITOR_PHRASE: Record<Status | "none", string> = {
  visited: "you've been", lived: "you've lived there", want: "you want to go", none: "you haven't been",
};

/** Both statuses in words: "Ana has been · you want to go". */
export function describeOverlap(ownerName: string, owner: Status | undefined, visitor: Status | undefined): string {
  return `${ownerName} ${OWNER_PHRASE[owner ?? "none"]} · ${VISITOR_PHRASE[visitor ?? "none"]}`;
}
