import type { Invite } from "./invite";
import { stopList, stopName } from "./stops";

/** "2027-04-10" → "20270410", optionally shifted by whole days. */
function calendarDate(date: string, addDays = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + addDays)).toISOString().slice(0, 10).replaceAll("-", "");
}

/** The Markdown message as plain text: images dropped, links spelled out, emphasis markers removed. */
function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A Google Calendar "create event" link for the trip: an all-day event from the start to the end
 * date, with the inviter added as a guest when the invite has their email. Null when the trip has no date.
 * (Google treats the end date as exclusive, hence the extra day.)
 */
export function googleCalendarUrl(invite: Invite, pageUrl: string): string | null {
  if (!invite.date) return null;
  const message = invite.message ? plainText(invite.message) : "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Trip to ${stopList(invite.stops)}`,
    dates: `${calendarDate(invite.date)}/${calendarDate(invite.end ?? invite.date, 1)}`,
    details: [message, `Invite: ${pageUrl}`].filter(Boolean).join("\n\n"),
    location: invite.stops.map(stopName).join(", "),
  });
  if (invite.email) params.set("add", invite.email);
  return `https://calendar.google.com/calendar/render?${params}`;
}
