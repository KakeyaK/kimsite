import { MAX_FROM, MAX_MD_IMAGES, MAX_MESSAGE, MAX_STOPS, type Invite } from "./invite";
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

export const GUIDE_EXAMPLE: Invite = {
  stops: [{ n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 }, "BR-BA", "KOR"],
  legs: ["plane", "plane"],
  from: "Kim",
  email: "kim@example.com",
  date: "2027-03-28",
  end: "2027-04-08",
  message: "Cherry blossom season! 🌸\n\n- **Kyoto**: Fushimi Inari at sunrise\n- **Bahia**: the beaches of Salvador\n- **South Korea**: night markets in Seoul",
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
  return `You write trip invites for Kim's travel map. An invite is a text document: a few fields, then a message. I paste it into the map's trip planner, which turns it into a link; the link opens a page that flies over a globe to each place, then shows a postcard with the message.

First, ask me:
1. Which places the trip goes to, in order (countries, states or cities; at most ${MAX_STOPS}), and, if I know, how we travel between them (${MODES.join(", ")}).
2. The dates, if there are any.
3. Who the invite is from (a name, and optionally an email address).

Then write a message that sells the trip: the best things to do in each place, in Markdown (short headings or a list work well), warm and specific, at most ${count(MAX_MESSAGE)} characters. Do not add images unless I give you their URLs: never invent an image URL.

Reply with only the document, in one code block, and nothing else. Write it exactly as the format below says: I will edit it by hand afterwards.

# Format

\`\`\`
${inviteDoc(GUIDE_EXAMPLE).trimEnd()}
\`\`\`

The fields sit between two lines of \`---\`, one per line, written \`name: value\`. Keep all five lines, and leave a value empty when there is nothing to put in it. The message is everything after the second \`---\`.

- \`to\` (required): the places, in trip order, one per line, each starting with \`  - \`. 1 to ${MAX_STOPS} of them. Each but the first may end with how you get there (see Places).
- \`from\`: who the invite is from, up to ${MAX_FROM} characters.
- \`email\`: the inviter's email address. The invite's "Add to Google Calendar" button then invites them to the event.
- \`date\`: the first day of the trip, \`YYYY-MM-DD\`.
- \`end\`: the last day, \`YYYY-MM-DD\`. Needs \`date\`, and can't be before it.

## Places

A place is one of:

- a country, by its three-letter code: \`JPN\`. The codes are listed below.
- a state or province, by its ISO 3166-2 code: \`BR-BA\`. Only the countries listed under "Countries with states" have them.
- a city, written \`Name@CODE\` with its country's code: \`Kyoto@JPN\`. The name is looked up, ignoring case and accents, in a list of that country's cities with more than 100,000 people (English names, from GeoNames). If several share the name, the most populous wins.

After any place but the first, you may say how you get there from the place before: \`Kyoto@JPN by train\`, \`KOR by boat\`. The ways are ${MODES.map((m) => `\`by ${m}\``).join(", ")}; leave it out when I haven't said (the map then draws a plane).

A place that can't be found is left out, so use only codes from the lists below, and the usual English name of a city.

## The message

Up to ${count(MAX_MESSAGE)} characters: room for a few paragraphs on each place, so don't cut it short to save space.

Markdown: **bold**, _italic_, headings, lists, quotes, [links](https://example.com) and images written \`![caption](https://…)\`, with the caption shown under the image. Images must be \`https\` links, and at most ${MAX_MD_IMAGES} are shown. Raw HTML is shown as text.

## Countries with states

${statesList()}

## Country codes

${countries}
`;
}
