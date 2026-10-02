import { describe, it, expect } from "vitest";
import { renderToString } from "preact-render-to-string";
import { renderMarkdown, imageStats, MAX_MD_IMAGES } from "./markdown";

const html = (md: string) => renderToString(renderMarkdown(md));

describe("renderMarkdown", () => {
  it("renders basic formatting", () => {
    const out = html("Hello **bold** _em_ ~~gone~~ `code`");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>em</em>");
    expect(out).toContain("<del>gone</del>");
    expect(out).toContain("<code>code</code>");
  });

  it("renders lists, headings, quotes and line breaks", () => {
    const out = html("# Title\n\n- one\n- two\n\n> quote\n\nline 1\nline 2");
    expect(out).toMatch(/<h3[^>]*>Title<\/h3>/);
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("line 1<br/>line 2");
  });

  it("escapes text exactly once", () => {
    expect(html("a & b < c")).toContain("a &amp; b &lt; c");
  });

  it("shows raw HTML as text instead of rendering it", () => {
    const out = html('<img src=x onerror="alert(1)">\n\nhi <b>there</b>');
    expect(out).not.toMatch(/<img/);
    expect(out).not.toMatch(/<b>/);
    expect(out).toContain("&lt;img src=x");
    expect(out).toContain("&lt;b>there&lt;/b>");
  });

  it("links http(s) and mailto in a new tab, drops other schemes", () => {
    const out = html("[ok](https://example.com) [js](javascript:alert(1)) [mail](mailto:a@b.co)");
    expect(out).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">ok</a>');
    expect(out).toContain('<a href="mailto:a@b.co"');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("js");
  });

  it("renders https images lazily without a referrer", () => {
    const out = html("![Kyoto](https://example.com/kyoto.jpg)");
    expect(out).toMatch(/<img[^>]*src="https:\/\/example.com\/kyoto.jpg"/);
    expect(out).toMatch(/alt="Kyoto"/);
    expect(out).toMatch(/loading="lazy"/);
    expect(out).toMatch(/referrerpolicy="no-referrer"/i);
  });

  it("drops non-https images", () => {
    const out = html("![a](http://x.com/a.jpg) ![b](data:image/png;base64,AAAA) ![c](javascript:alert(1))");
    expect(out).not.toMatch(/<img/);
  });

  it(`caps images at ${MAX_MD_IMAGES}`, () => {
    const md = Array.from({ length: 10 }, (_, i) => `![${i}](https://example.com/${i}.jpg)`).join("\n\n");
    expect(html(md).match(/<img/g)).toHaveLength(MAX_MD_IMAGES);
  });

  it("renders an empty message as nothing", () => {
    expect(html("")).toBe("");
  });
});

describe("imageStats", () => {
  it("counts images and how many will be shown", () => {
    const md = [
      "![a](https://x.com/a.jpg)",
      "![b](http://x.com/b.jpg)",
      ...Array.from({ length: 7 }, (_, i) => `![${i}](https://x.com/${i}.jpg)`),
    ].join(" ");
    expect(imageStats(md)).toEqual({ total: 9, shown: MAX_MD_IMAGES });
  });
});
