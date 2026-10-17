import { useState } from "preact/hooks";
import type { SavedInvite } from "@apps/travel-map/lib/savedInvites";
import { cn, formatDate } from "@lib/utils";
import { shareOrCopy } from "./share";
import { btn, btnActive, card } from "./ui";

interface Props {
  invites: SavedInvite[];
  /** The id of the invite open in the trip planner, if it's a saved one. */
  editing: string | null;
  /** Opens the invite in the trip planner; resolves to why it couldn't, or null. */
  onEdit: (entry: SavedInvite) => Promise<string | null>;
  onDelete: (id: string) => void;
}

/** "Your invites": the invites made in this browser, to share again or reopen in the trip planner. */
export function SavedInvites({ invites, editing, onEdit, onDelete }: Props) {
  const [status, setStatus] = useState("");
  /** The invite whose Delete was clicked once; a second click deletes it. */
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <section class={cn(card, "space-y-3 text-sm")} aria-labelledby="saved-invites-title">
      <h2 id="saved-invites-title" class="text-lg font-semibold text-black dark:text-white">Your invites</h2>
      <p>
        Trip invites you made links for, saved in this browser. Editing one makes a new link; the old link still opens
        the invite as it was. Deleting one only takes it off this list.
      </p>
      <ul class="divide-y divide-black/10 dark:divide-white/10">
        {invites.map((entry) => (
          <li key={entry.id} class="flex flex-wrap items-center gap-2 py-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-black dark:text-white">Trip to {entry.title}</p>
              <p class="truncate text-xs">
                {formatDate(new Date(entry.saved))} ·{" "}
                <a class="underline underline-offset-2" href={entry.url} target="_blank" rel="noopener">
                  {entry.url.replace(/^https?:\/\//, "")}
                </a>
              </p>
            </div>
            <button
              type="button"
              class={btn}
              onClick={async () => {
                const r = await shareOrCopy(entry.url, `Trip to ${entry.title}`);
                setStatus(r === "copied" ? "Link copied!" : r === "shared" ? "Shared!" : "Couldn't share the link.");
              }}
            >
              Share link
            </button>
            <button
              type="button"
              class={cn(btn, editing === entry.id && btnActive)}
              disabled={editing === entry.id}
              onClick={async () => setStatus((await onEdit(entry)) ?? "")}
            >
              {editing === entry.id ? "Editing" : "Edit"}
            </button>
            <button
              type="button"
              class={cn(btn, confirming === entry.id && "text-rose-600 dark:text-rose-400")}
              onClick={() => {
                if (confirming !== entry.id) return setConfirming(entry.id);
                setConfirming(null);
                onDelete(entry.id);
              }}
              onBlur={() => setConfirming(null)}
              aria-label={confirming === entry.id ? `Confirm deleting the trip to ${entry.title}` : `Delete the trip to ${entry.title}`}
            >
              {confirming === entry.id ? "Delete?" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{status}</p>
    </section>
  );
}
