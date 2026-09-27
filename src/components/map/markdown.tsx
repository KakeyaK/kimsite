import { Lexer, type Token, type Tokens } from "marked";
import type { ComponentChildren, VNode } from "preact";
import { useState } from "preact/hooks";
import { isHttpsUrl } from "@lib/map/data";

export const MAX_MD_IMAGES = 6;

/**
 * Markdown → Preact elements. marked only tokenizes; every element is built here from an
 * allowlist, so there is no innerHTML anywhere. Raw HTML in the source is shown as text,
 * links are limited to http(s)/mailto, and images to https (at most MAX_MD_IMAGES).
 */
export function renderMarkdown(src: string, { editing = false }: { editing?: boolean } = {}): VNode {
  const ctx: Ctx = { images: 0, editing };
  return <>{blocks(lex(src), ctx)}</>;
}

/** How many images a message contains and how many will actually be shown. */
export function imageStats(src: string): { total: number; shown: number } {
  let total = 0;
  let safe = 0;
  const walk = (tokens: Token[]) => {
    for (const t of tokens) {
      if (t.type === "image") {
        total++;
        if (isHttpsUrl((t as Tokens.Image).href)) safe++;
      }
      const children = (t as { tokens?: Token[] }).tokens;
      if (children) walk(children);
      if (t.type === "list") for (const item of (t as Tokens.List).items) walk(item.tokens);
    }
  };
  walk(lex(src));
  return { total, shown: Math.min(safe, MAX_MD_IMAGES) };
}

type Ctx = { images: number; editing: boolean };

const lex = (src: string) => new Lexer({ gfm: true, breaks: true }).lex(src);

function safeHref(href: string): string | null {
  try {
    const { protocol } = new URL(href);
    return protocol === "https:" || protocol === "http:" || protocol === "mailto:" ? href : null;
  } catch {
    return null;
  }
}

function blocks(tokens: Token[], ctx: Ctx): ComponentChildren[] {
  return tokens.map((t, i) => block(t, ctx, i));
}

function block(t: Token, ctx: Ctx, key: number): ComponentChildren {
  switch (t.type) {
    case "paragraph":
      return <p key={key}>{inline((t as Tokens.Paragraph).tokens, ctx)}</p>;
    case "heading": {
      const { depth, tokens } = t as Tokens.Heading;
      const Tag = (["h3", "h4", "h5", "h6"] as const)[Math.min(depth, 4) - 1];
      return <Tag key={key}>{inline(tokens, ctx)}</Tag>;
    }
    case "blockquote":
      return <blockquote key={key}>{blocks((t as Tokens.Blockquote).tokens, ctx)}</blockquote>;
    case "list": {
      const list = t as Tokens.List;
      const items = list.items.map((item, i) => (
        <li key={i}>
          {item.task ? (item.checked ? "☑ " : "☐ ") : null}
          {blocks(item.tokens, ctx)}
        </li>
      ));
      return list.ordered ? (
        <ol key={key} start={typeof list.start === "number" ? list.start : undefined}>{items}</ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    case "code":
      return <pre key={key}><code>{(t as Tokens.Code).text}</code></pre>;
    case "hr":
      return <hr key={key} />;
    case "text": {
      // Block-level text appears inside tight list items.
      const text = t as Tokens.Text;
      return text.tokens ? inline(text.tokens, ctx) : text.text;
    }
    case "space":
    case "def":
      return null;
    default:
      // html, table and anything unknown: show the source as plain text.
      return <p key={key} class="whitespace-pre-wrap">{t.raw}</p>;
  }
}

function inline(tokens: Token[] | undefined, ctx: Ctx): ComponentChildren[] {
  return (tokens ?? []).map((t, key) => {
    switch (t.type) {
      case "text": {
        const text = t as Tokens.Text;
        return text.tokens ? inline(text.tokens, ctx) : text.text;
      }
      case "escape":
        return (t as Tokens.Escape).text;
      case "strong":
        return <strong key={key}>{inline((t as Tokens.Strong).tokens, ctx)}</strong>;
      case "em":
        return <em key={key}>{inline((t as Tokens.Em).tokens, ctx)}</em>;
      case "del":
        return <del key={key}>{inline((t as Tokens.Del).tokens, ctx)}</del>;
      case "codespan":
        return <code key={key}>{(t as Tokens.Codespan).text}</code>;
      case "br":
        return <br key={key} />;
      case "link": {
        const link = t as Tokens.Link;
        const href = safeHref(link.href);
        const children = inline(link.tokens, ctx);
        return href ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
        ) : (
          <span key={key}>{children}</span>
        );
      }
      case "image": {
        const img = t as Tokens.Image;
        if (!isHttpsUrl(img.href) || ctx.images >= MAX_MD_IMAGES) return null;
        ctx.images++;
        return <MarkdownImage key={key} src={img.href} alt={img.text} editing={ctx.editing} />;
      }
      default:
        // inline html and anything unknown
        return t.raw;
    }
  });
}

/**
 * An image that says so when it can't load, instead of vanishing. The usual cause is a link to a
 * page (a photo site's share page, a search result) rather than to the image file itself.
 */
function MarkdownImage({ src, alt, editing }: { src: string; alt: string; editing: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span class="not-prose my-2 block rounded border border-dashed border-black/20 dark:border-white/25 px-3 py-2 text-xs">
        🖼 {editing ? (
          <>
            This image couldn't load. The link has to point straight at the picture: right-click the image and
            choose "Copy image address", not the page's link.
          </>
        ) : (
          <>Image unavailable{alt ? `: ${alt}` : ""}.</>
        )}
      </span>
    );
  }
  return <img src={src} alt={alt} loading="lazy" referrerpolicy="no-referrer" onError={() => setFailed(true)} />;
}
