import { describe, it, expect } from "vitest";
import { googleCalendarUrl } from "./calendar";
import type { Invite } from "./invite";

const page = "https://www.kakeya.kim/projects/map/invite#i=abc";
const base: Invite = { v: 1, from: "Kim", stops: [{ n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 }, "KOR"], date: "2027-04-10", end: "2027-04-18" };
const params = (url: string | null) => new URL(url!).searchParams;

describe("googleCalendarUrl", () => {
  it("is null without a date", () => {
    expect(googleCalendarUrl({ ...base, date: undefined, end: undefined }, page)).toBeNull();
  });

  it("builds an all-day event spanning the trip (Google's end date is exclusive)", () => {
    const url = googleCalendarUrl(base, page)!;
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    const p = params(url);
    expect(p.get("action")).toBe("TEMPLATE");
    expect(p.get("text")).toBe("Trip to Kyoto and South Korea");
    expect(p.get("dates")).toBe("20270410/20270419");
    expect(p.get("location")).toBe("Kyoto, South Korea");
  });

  it("makes a one-day event when there's no end date, across month ends", () => {
    expect(params(googleCalendarUrl({ ...base, end: undefined }, page)).get("dates")).toBe("20270410/20270411");
    expect(params(googleCalendarUrl({ ...base, date: "2027-12-31", end: "2027-12-31" }, page)).get("dates")).toBe("20271231/20280101");
  });

  it("invites the inviter as a guest only when there's an email", () => {
    expect(params(googleCalendarUrl(base, page)).has("add")).toBe(false);
    expect(params(googleCalendarUrl({ ...base, email: "kim@example.com" }, page)).get("add")).toBe("kim@example.com");
  });

  it("puts the message as plain text in the details, with a link back to the invite", () => {
    const message = "Cherry **blossoms** & ramen 🍜\n\n![temple](https://x.com/t.jpg)\n\nSee [the plan](https://docs.example.com)";
    const details = params(googleCalendarUrl({ ...base, message }, page)).get("details")!;
    expect(details).toBe("Cherry blossoms & ramen 🍜\n\nSee the plan (https://docs.example.com)\n\nInvite: " + page);
  });
});
