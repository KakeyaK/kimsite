import { describe, it, expect } from "vitest";
import type { CityRow } from "./cities";
import { decodeInvite, inviteUrl, MAX_MESSAGE, MAX_STOPS } from "./invite";
import { GUIDE_EXAMPLES, invitePrompt, inviteReference } from "./inviteGuide";
import { KNOWN_CODES } from "./meta";

const origin = "https://www.kakeya.kim";
const cities: CityRow[] = [
  ["Kyoto", "JPN", 35.01, 135.77, 1460000],
  ["Tokyo", "JPN", 35.69, 139.69, 8336599],
];

describe("invite guide", () => {
  it("has example links that the invite page reads back", async () => {
    for (const example of GUIDE_EXAMPLES) {
      const url = new URL(inviteUrl(origin, example));
      expect(await decodeInvite(url.hash, KNOWN_CODES, () => Promise.resolve(cities))).toEqual({ ok: true, value: example, unknown: [] });
    }
  });

  it("states the limits and lists codes from the data", () => {
    const ref = inviteReference(origin);
    expect(ref).toContain(`1 to ${MAX_STOPS} stops`);
    expect(ref).toContain(`up to ${MAX_MESSAGE} characters`);
    expect(ref).toContain("Brazil (BRA): BR-AC Acre");
    expect(ref).toContain("Japan JPN");
  });

  it("puts the whole reference in the prompt", () => {
    const prompt = invitePrompt(origin);
    expect(prompt).toContain(inviteReference(origin));
    expect(prompt).toMatch(/only the link/);
    expect(prompt).toMatch(/never invent an image URL/);
  });
});
