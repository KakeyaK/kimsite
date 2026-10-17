import type { ComponentChildren } from "preact";
import { tripRoute, type Invite } from "@apps/travel-map/lib/invite";
import { daysUntil } from "@apps/travel-map/lib/geo";
import { MODE_EMOJI, stopList, stopName } from "@apps/travel-map/lib/stops";
import { cn } from "@lib/utils";
import { renderMarkdown } from "./markdown";

function countdown(date: string): string | null {
  const n = daysUntil(date, new Date());
  if (n === null) return null;
  if (n > 1) return `${n} days to go`;
  if (n === 1) return "Tomorrow!";
  if (n === 0) return "It's today!";
  return `This trip was ${-n} day${n === -1 ? "" : "s"} ago`;
}

/** The cover's headline: the invite's title, or who invites you where. */
export const inviteHeadline = (invite: Invite): string =>
  invite.title?.trim() || (invite.from ? `${invite.from} says: let's visit ${stopList(invite.stops)}!` : `Let's visit ${stopList(invite.stops)}!`);

/**
 * Markdown from the inviter (a message or a place's note). <article> picks up the site's prose styles (global.css);
 * images take the full width, capped in height so a tall one doesn't push the text away.
 * `editing`: shown in the trip planner, so broken images get a how-to-fix hint.
 */
export function InviteText({ text, editing = false, class: className }: { text: string; editing?: boolean; class?: string }) {
  return (
    <article class={cn("prose-sm sm:prose-base [&_img]:max-h-80 [&_img]:w-full [&_img]:rounded-md [&_img]:object-cover [&>:first-child]:mt-0 [&>:last-child]:mb-0", className)}>
      {renderMarkdown(text, { editing })}
    </article>
  );
}

/** The route in a line: Paris → 🚌 Lyon → ✈️ Kyoto. */
export function RouteLine({ invite }: { invite: Invite }) {
  const route = tripRoute(invite);
  return (
    <p class="text-sm">
      {route.map((p, i) => (
        <span key={i} class={cn(p.role !== "stop" && "opacity-70")}>
          {i > 0 && <span aria-hidden="true"> → {p.by && MODE_EMOJI[p.by]} </span>}
          {i > 0 && p.by && <span class="sr-only">, by {p.by}, to </span>}
          {stopName(p.stop)}
        </span>
      ))}
    </p>
  );
}

/** The invite's cover: the headline, the dates, the route and the message. `children` go at the end (buttons). */
export function Postcard({ invite, editing = false, children }: { invite: Invite; editing?: boolean; children?: ComponentChildren }) {
  const when = invite.date ? countdown(invite.date) : null;
  return (
    <div class="space-y-4">
      <div class="space-y-1">
        {invite.from && <p class="text-xs uppercase tracking-wide">{invite.from} invites you</p>}
        <h2 id="cover-title" tabIndex={-1} class="text-2xl font-semibold text-black focus:outline-none dark:text-white">{inviteHeadline(invite)}</h2>
        {when && (
          <p class="text-sm font-semibold text-black dark:text-white">
            🗓 {invite.date}{invite.end && invite.end !== invite.date ? ` → ${invite.end}` : ""} · {when}
          </p>
        )}
        {(invite.stops.length > 1 || invite.start || invite.finish) && <RouteLine invite={invite} />}
      </div>
      {invite.message?.trim() && <InviteText text={invite.message} editing={editing} />}
      {invite.from?.trim() && invite.message?.trim() && <p class="text-right text-sm">— {invite.from}</p>}
      {children}
    </div>
  );
}
