import { MAX_FROM, MAX_MD_IMAGES, MAX_MESSAGE, MAX_STOPS, MAX_TITLE, type Invite } from "./invite";
import { inviteDoc } from "./inviteDoc";
import { COUNTRIES, countryName, REGIONS } from "./meta";
import { MODES } from "./stops";

/*
 * The invite-guide page (src/pages/sandbox/travel-map/invite-guide.astro): a prompt that has a language
 * model write an invite document (lib/inviteDoc.ts), to paste into the trip planner's source view.
 * Limits, codes and the example come from the code, so the prompt can't drift from what the planner reads.
 */

/** "20,000": limits read better with a separator, for people and models alike. */
export const count = (n: number): string => n.toLocaleString("en");

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const KYOTO = { n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 };

export const GUIDE_EXAMPLE: Invite = {
  title: "Cherry blossoms, beaches and night markets",
  start: KYOTO,
  stops: ["BR-BA", "KOR"],
  finish: KYOTO,
  legs: ["plane", "plane", "boat"],
  from: "Kim",
  email: "kim@example.com",
  date: "2027-03-28",
  end: "2027-04-08",
  message: "Two weeks, three places, one very long flight. 🌸 Who's in?",
  notes: [
    "We meet at Kyoto Station at 8am, then fly out from Kansai.",
    "**The beaches of Salvador**, and moqueca for dinner every night.",
    "- Night markets in Seoul\n- A day hiking Bukhansan",
    "Back home, by ferry from Busan for the last stretch.",
  ],
};

/** Countries split into states, each with its state codes. */
function statesList(): string {
  const countries = [...new Set(REGIONS.map((r) => r.country))].map((iso) => ({ iso, name: countryName(iso) })).sort(byName);
  return countries
    .map(({ iso, name }) => {
      const states = REGIONS.filter((r) => r.country === iso).sort(byName).map((r) => `${r.code} ${r.name}`);
      return `- ${name} (${iso}): ${states.join(", ")}`;
    })
    .join("\n");
}

/** The prompt. It holds the whole format and every code, so it works in a model that can't browse the web. */
export function invitePrompt(): string {
  const countries = [...COUNTRIES].sort(byName).map((c) => `${c.name} ${c.iso}`).join(", ");
  return `You write trip invites for Kim's travel map. An invite is a text document: a few fields, then a message. I paste it into the map's trip planner, which turns it into a link; the link opens a page on a map: first a cover with the title and the message, then, one place at a time, the map travels to each place and shows its note.

First, ask me:
1. Which places the trip goes to, in order (countries, states or cities; at most ${MAX_STOPS}), and, if I know, how we travel between them (${MODES.join(", ")}).
2. Where the trip leaves from and comes back to, if that matters (a meeting point, home).
3. The dates, if there are any.
4. Who the invite is from (a name, and optionally an email address).

Then write the invite: a short title, a short message that sells the trip (a few sentences), and a note for each place with the best things to do there, in Markdown, warm and specific. Do not add images unless I give you their URLs: never invent an image URL.

Reply with only the document, in one code block, and nothing else. Write it exactly as the format below says: I will edit it by hand afterwards.

# Format

\`\`\`
${inviteDoc(GUIDE_EXAMPLE).trimEnd()}
\`\`\`

The fields sit between two lines of \`---\`, one per line, written \`name: value\`. Keep every line, and leave a value empty when there is nothing to put in it. After the second \`---\` comes the message, then the notes.

- \`title\`: the headline on the cover, up to ${MAX_TITLE} characters. Without one, the cover says who invites you where.
- \`to\` (required): the places, in trip order, one per line, each starting with \`  - \`. 1 to ${MAX_STOPS} of them. Each may end with how you get there from the place before (see Places); the first only when there's a \`start\`.
- \`start\`: where the trip leaves from, written like a place but without how you get there. It's on the route, not a destination.
- \`return\`: where the trip comes back to at the end, often the same as \`start\`, and may end with how you get there.
- \`from\`: who the invite is from, up to ${MAX_FROM} characters.
- \`email\`: the inviter's email address. The invite's "Add to Google Calendar" button then invites them to the event.
- \`date\`: the first day of the trip, \`YYYY-MM-DD\`.
- \`end\`: the last day, \`YYYY-MM-DD\`. Needs \`date\`, and can't be before it.

## Places

A place is one of:

- a country, by its three-letter code: \`JPN\`. The codes are listed below.
- a state or province, by its ISO 3166-2 code: \`BR-BA\`. Only the countries listed under "Countries with states" have them.
- a city, written \`Name@CODE\` with its country's code: \`Kyoto@JPN\`. The name is looked up, ignoring case and accents, in a list of that country's cities with more than 100,000 people (English names, from GeoNames). If several share the name, the most populous wins.

After any place but the first on the route, you may say how you get there from the place before: \`Kyoto@JPN by train\`, \`KOR by boat\`. The ways are ${MODES.map((m) => `\`by ${m}\``).join(", ")}; leave it out when I haven't said (the map then draws a plane).

A place that can't be found is left out, so use only codes from the lists below, and the usual English name of a city.

## The message and the notes

The message is shown on the cover, before the trip: keep it to a few sentences.

Then each place on the route (\`start\` and \`return\` too) can have a note, shown when the map gets there. A note starts with a heading that is the place exactly as written in the fields, without how you get there: \`## Kyoto@JPN\`, \`## BR-BA\`. Everything up to the next such heading is the note, so a note can have its own smaller headings (\`### Food\`). When a place is on the route twice (leaving from and coming back to the same city), its first heading is the first visit's. Write the notes in trip order.

The message and the notes together hold at most ${count(MAX_MESSAGE)} characters: room for a few paragraphs on each place, so don't cut them short to save space.

Markdown: **bold**, _italic_, headings, lists, quotes, [links](https://example.com) and images written \`![caption](https://…)\`, with the caption shown under the image. Images must be \`https\` links, and at most ${MAX_MD_IMAGES} are shown. Raw HTML is shown as text.

## Countries with states

${statesList()}

## Country codes

${countries}
`;
}
