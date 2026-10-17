import { z } from "astro/zod";
import { browserStorage, type StorageLike } from "./storage";

/**
 * The invites a visitor made links for, kept in their browser so they can be opened in the trip planner again. A short
 * link always opens the invite it was made for (the shortener's codes are hashes of it), so an edited invite gets a new
 * link, saved over the old one; the old link still opens the invite as it was.
 */
export const SAVED_INVITES_KEY = "travel-map:invites";

const savedInviteSchema = z.object({
  id: z.string().min(1),
  /** What encodeInvite made: `i=…`. */
  invite: z.string().startsWith("i="),
  /** The short link made for it. */
  url: z.string().url(),
  /** The places, for the list (stopList), so it shows without decoding every invite. */
  title: z.string(),
  /** When the link was made, as an ISO timestamp. */
  saved: z.string(),
});

export type SavedInvite = z.infer<typeof savedInviteSchema>;

export interface InviteStore {
  /** Newest first. Entries that don't parse are left out. */
  list(): SavedInvite[];
  /** Adds the invite, or replaces the one with its id, and moves it to the top. False when storage is blocked or full. */
  put(entry: SavedInvite): boolean;
  remove(id: string): void;
}

export function createInviteStore(storage: StorageLike | null = browserStorage()): InviteStore {
  function list(): SavedInvite[] {
    try {
      const raw = JSON.parse(storage?.getItem(SAVED_INVITES_KEY) ?? "[]");
      return Array.isArray(raw) ? raw.flatMap((e) => {
        const r = savedInviteSchema.safeParse(e);
        return r.success ? [r.data] : [];
      }) : [];
    } catch {
      return [];
    }
  }

  function write(entries: SavedInvite[]): boolean {
    try {
      if (!storage) return false;
      storage.setItem(SAVED_INVITES_KEY, JSON.stringify(entries));
      return true;
    } catch {
      return false;
    }
  }

  return {
    list,
    put: (entry) => write([entry, ...list().filter((e) => e.id !== entry.id)]),
    remove: (id) => void write(list().filter((e) => e.id !== id)),
  };
}
