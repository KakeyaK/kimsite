import { describe, it, expect } from "vitest";
import type { CityRow } from "./cities";
import { MAX_MESSAGE, MAX_STOPS, type Invite } from "./invite";
import { inviteDoc, parseInviteDoc } from "./inviteDoc";

const known = { countries: new Set(["JPN", "KOR", "BRA", "CHN"]), regions: new Set(["BR-BA"]) };
const rows: CityRow[] = [
  ["Kyoto", "JPN", 35.01, 135.77, 1460000],
  ["Mianzhu, Deyang, Sichuan", "CHN", 31.34, 104.22, 510000],
];
const kyoto = { n: "Kyoto", c: "JPN", la: 35.01, lo: 135.77 };
const parse = (text: string) => parseInviteDoc(text, known, () => Promise.resolve(rows));
const doc = (fields: string, message = "") => `---\n${fields}\n---\n\n${message}\n`;

describe("invite documents", () => {
  it("reads the fields and the message", async () => {
    const text = doc("to:\n  - Kyoto@JPN\n  - BR-BA\nfrom: Kim\nemail: kim@example.com\ndate: 2027-03-28\nend: 2027-04-08", "# Let's go!\n\n- **Kyoto** first");
    expect(await parse(text)).toEqual({
      ok: true,
      unknown: [],
      value: {
        stops: [kyoto, "BR-BA"], from: "Kim", email: "kim@example.com", date: "2027-03-28", end: "2027-04-08",
        message: "# Let's go!\n\n- **Kyoto** first",
      },
    });
  });

  it("round-trips what the planner writes", async () => {
    const mianzhu = { n: "Mianzhu, Deyang, Sichuan", c: "CHN", la: 31.34, lo: 104.22 };
    const invites: Invite[] = [
      { stops: [kyoto, mianzhu, "KOR"], from: "Kîm: 金", email: "kim@example.com", date: "2027-04-01", end: "2027-04-10", message: "Vamos! 🇯🇵\n\n---\n\nto: nowhere" },
      { stops: ["JPN"] },
      { stops: [], message: "Somewhere warm?" },
    ];
    for (const invite of invites) expect(await parse(inviteDoc(invite))).toEqual({ ok: true, value: invite, unknown: [] });
  });

  it("writes every field, so the empty ones are there to fill in", () => {
    expect(inviteDoc({ stops: ["JPN"], from: "Kim" })).toBe("---\nto:\n  - JPN\nfrom: Kim\nemail:\ndate:\nend:\n---\n\n\n");
  });

  it("is lenient: a code fence, quotes, places on one line, lowercase codes, comments, Windows line ends", async () => {
    const text = "```markdown\r\n---\r\n# the trip\r\nTo: [kyoto@jpn, \"KOR\"]\r\nfrom: \"Kim\"\r\ndate: '2027-03-28'\r\n---\r\nHi\r\n```";
    expect(await parse(text)).toEqual({ ok: true, unknown: [], value: { stops: [kyoto, "KOR"], from: "Kim", date: "2027-03-28", message: "Hi" } });
  });

  it("skips places it can't find, and takes an invite without any", async () => {
    expect(await parse(doc("to: JPN, ZZZ, Atlantis@JPN"))).toEqual({ ok: true, value: { stops: ["JPN"] }, unknown: ["ZZZ", "Atlantis@JPN"] });
    expect(await parse(doc("to:\nfrom: Kim"))).toEqual({ ok: true, value: { stops: [], from: "Kim" }, unknown: [] });
  });

  it.each([
    ["to: JPN", "---"],
    ["---\nto: JPN", "---"],
    [doc("to: Kyoto, Japan"), "to"],
    [doc(`to: ${Array(MAX_STOPS + 1).fill("JPN").join(", ")}`), "to"],
    [doc("to: JPN\ntitle: Trip"), "title"],
    [doc("to: JPN\nmessage: Hi"), "message"],
    [doc("to: JPN\nfrom: Kim\n  - KOR"), "- KOR"],
    [doc("to: JPN\nfrom"), "from"],
    [doc("to: JPN\nfrom: A\nfrom: B"), "from"],
    [doc("to: JPN\nemail: kim at example"), "email"],
    [doc("to: JPN\ndate: next spring"), "date"],
    [doc("to: JPN\nend: 2027-04-01"), "end"],
    [doc("to: JPN", "x".repeat(MAX_MESSAGE + 1)), "message"],
  ])("%j → error in %s", async (text, field) => {
    const r = await parse(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe(field);
  });
});
