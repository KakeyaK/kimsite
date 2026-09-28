import type { Invite } from "@lib/map/invite";
import { daysUntil } from "@lib/map/geo";
import { cn } from "@lib/utils";
import { renderMarkdown } from "./markdown";
import { card } from "./ui";

function countdown(date: string): string | null {
  const n = daysUntil(date, new Date());
  if (n === null) return null;
  if (n > 1) return `${n} days to go`;
  if (n === 1) return "Tomorrow!";
  if (n === 0) return "It's today!";
  return `This trip was ${-n} day${n === -1 ? "" : "s"} ago`;
}

/** `editing`: shown as a preview in the trip planner, so broken images get a how-to-fix hint. */
export function Postcard({ invite, editing = false }: { invite: Invite; editing?: boolean }) {
  const when = invite.date ? countdown(invite.date) : null;

  // <article> picks up the site's prose styles (global.css), which style the Markdown.
  return (
    <article class={cn(card, "space-y-3 bg-white/60 dark:bg-black/20 [&_img]:max-h-96 [&_img]:rounded-md [&>div>:first-child]:mt-0 [&>div>:last-child]:mb-0")}>
      {when && (
        <p class="not-prose text-sm font-semibold text-black dark:text-white">
          🗓 {invite.date}{invite.end && invite.end !== invite.date ? ` → ${invite.end}` : ""} · {when}
        </p>
      )}
      {invite.message && <div>{renderMarkdown(invite.message, { editing })}</div>}
      {invite.from && <p class="not-prose text-right text-sm">— {invite.from}</p>}
    </article>
  );
}
