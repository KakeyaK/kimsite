import { describe, it, expect } from "vitest";
import type { CityRow } from "./cities";
import { MAX_MESSAGE, MAX_STOPS } from "./invite";
import { inviteDoc, parseInviteDoc } from "./inviteDoc";
import { count, GUIDE_EXAMPLE, invitePrompt } from "./inviteGuide";
import { KNOWN_CODES } from "./meta";

const cities: CityRow[] = [["Kyoto", "JPN", 35.01, 135.77, 1460000]];

describe("invite guide", () => {
  it("shows an example document that the trip planner reads back", async () => {
    const doc = inviteDoc(GUIDE_EXAMPLE);
    expect(invitePrompt()).toContain(doc.trimEnd());
    expect(await parseInviteDoc(doc, KNOWN_CODES, () => Promise.resolve(cities))).toEqual({ ok: true, value: GUIDE_EXAMPLE, unknown: [] });
  });

  it("states the limits and lists codes from the data", () => {
    const prompt = invitePrompt();
    expect(prompt).toContain(`1 to ${MAX_STOPS} of them`);
    expect(prompt).toContain(`at most ${count(MAX_MESSAGE)} characters`);
    expect(prompt).toContain("by train");
    expect(prompt).toContain("Brazil (BRA): BR-AC Acre");
    expect(prompt).toContain("Japan JPN");
  });

  it("asks for the document alone, and no made-up images", () => {
    const prompt = invitePrompt();
    expect(prompt).toMatch(/only the document/);
    expect(prompt).toMatch(/never invent an image URL/);
  });
});
