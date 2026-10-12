import { inviteUrl, MAX_FROM, MAX_MD_IMAGES, MAX_MESSAGE, MAX_STOPS, type Invite } from "./invite";
import { COUNTRIES, countryName, REGIONS } from "./meta";

/*
 * The invite-guide page (src/pages/sandbox/travel-map/invite-guide.astro): how to write an invite link
 * by hand, and a prompt that has a language model write one. Limits, codes and examples come from the
 * code, so the guide can't drift from what the invite page accepts.
 */

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export const GUIDE_EXAMPLES: Invite[] = [
  {
    stops: [{ n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 }, { n: "Tokyo", c: "JPN", la: 35.69, lo: 139.69 }, "KOR"],
    from: "Kim",
    date: "2027-03-28",
    end: "2027-04-08",
    message: "Cherry blossom season! 🌸\n\n- **Kyoto**: Fushimi Inari at sunrise\n- **Tokyo**: ramen in Shinjuku\n- **Seoul**: night markets",
  },
  {
    stops: ["BR-BA", "PRT"],
    from: "Ana",
    email: "ana@example.com",
    date: "2027-07-01",
    message: "Salvador for the beaches, then Lisbon for _pastéis de nata_. Bring sunscreen!",
  },
];

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

/** The format reference, in Markdown. `origin` is the site, e.g. https://www.kakeya.kim. */
export function inviteReference(origin: string): string {
  const countries = [...COUNTRIES].sort(byName).map((c) => `${c.name} ${c.iso}`).join(", ");
  const [first, second] = GUIDE_EXAMPLES.map((e) => inviteUrl(origin, e));
  return `## The link

\`${origin}/sandbox/travel-map/invite#to=…&from=…&date=…\`

Everything after the \`#\` is a list of fields written \`name=value\` and separated by \`&\`, in any order, each at most once.

| Field | | What it holds |
| --- | --- | --- |
| \`to\` | required | The places, in trip order, separated by commas. 1 to ${MAX_STOPS} stops. |
| \`from\` | optional | Who the invite is from, up to ${MAX_FROM} characters. |
| \`email\` | optional | The inviter's email address. "Add to Google Calendar" then invites them to the event. |
| \`date\` | optional | The first day of the trip, \`YYYY-MM-DD\`. |
| \`end\` | optional | The last day, \`YYYY-MM-DD\`. Needs \`date\`, and can't be before it. |
| \`msg\` | optional | The message, in Markdown, up to ${MAX_MESSAGE} characters (counted before percent-encoding). |

## Stops

A stop is one of:

- a **country**, by its three-letter code: \`JPN\`. The codes are listed below.
- a **state** or province, by its ISO 3166-2 code: \`BR-BA\`. Only the countries listed under "Countries with states" have them.
- a **city**, written \`Name@ISO3\`: \`Kyoto@JPN\`. The name is looked up in a list of cities with more than 100,000 people
  (from GeoNames, English names), ignoring case and accents, within that country. If several share the name, the most
  populous wins.

A stop that can't be found is skipped, and the invite says some places were skipped.

## The message

Markdown: **bold**, _italic_, headings, lists, quotes, [links](https://example.com) and images written
\`![caption](https://…)\`. Images must be \`https\` links, and at most ${MAX_MD_IMAGES} are shown. Raw HTML is shown as text.

## Percent-encoding

Encode each value the way JavaScript's \`encodeURIComponent\` does: a space is \`%20\`, a new line \`%0A\`, \`&\` is \`%26\`,
\`=\` is \`%3D\`, \`#\` is \`%23\`, \`+\` is \`%2B\`, \`%\` is \`%25\`, and other non-ASCII characters are their UTF-8 bytes
(\`é\` is \`%C3%A9\`, 🌸 is \`%F0%9F%8C%B8\`). In \`to\`, encode each stop on its own (a comma inside a city name is \`%2C\`)
but leave the commas between stops and the \`@\` of a city as they are. Leave the \`=\` and \`&\` between fields as they are.

## Examples

A trip to Kyoto, Tokyo and South Korea:

\`${first}\`

A trip to Bahia (Brazil), then Portugal, with the inviter's email and no end date:

\`${second}\`

## Countries with states

${statesList()}

## Country codes

${countries}
`;
}

/** A prompt that makes a language model write an invite link. It holds the whole reference, so it works without browsing. */
export function invitePrompt(origin: string): string {
  return `You write trip invite links for Kim's travel map. A link opens a page that flies over a globe to each place, then shows a postcard with your message.

First, ask me:
1. Which places the trip goes to, in order (countries, states or cities; at most ${MAX_STOPS}).
2. The dates, if there are any.
3. Who the invite is from (a name, and optionally an email address).

Then write a message that sells the trip: the best things to do in each place, in Markdown (short headings or a list work well), warm and specific, at most ${MAX_MESSAGE} characters before encoding. Do not add images unless I give you their URLs: never invent an image URL.

Build the link exactly as the reference below says, percent-encoding every value. Check that every stop uses a code or a city@country form from the reference, and that the message is within the limit.

Reply with only the link, on one line, and nothing else.

# Reference

${inviteReference(origin)}`;
}
