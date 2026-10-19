import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { visit } from "unist-util-visit";

import preact from "@astrojs/preact";

// Open external links in a new tab (with safe rel attributes).
// A link is "external" when it points to another site: an absolute http(s)
// URL or a protocol-relative `//host` one. Internal links (/, #, ./relative)
// are left untouched so on-site navigation stays in the same tab.
function rehypeExternalLinks() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (!/^(https?:)?\/\//i.test(href)) return;
      node.properties.target = "_blank";
      node.properties.rel = "noopener noreferrer";
    });
  };
}

export default defineConfig({
  site: "https://www.kakeya.kim/",
  integrations: [
    mdx(),
    // Leave out app previews (only shown inside iframes) and unlisted pages
    sitemap({
      filter: (page) =>
        !page.endsWith("/preview/") && !page.endsWith("/invite-guide/"),
    }),
    tailwind(),
    // One integration per UI framework, each limited to the JSX files written in it, so apps in
    // different JSX frameworks (Preact, React, Solid…) can sit side by side. A new app adds its 
    // folder to its framework's list (see CLAUDE.md, "Apps").
    preact({ include: ["src/apps/travel-map/**/*.{jsx,tsx}", "src/lib/islands/preact.tsx"] }),
  ],
  markdown: {
    rehypePlugins: [rehypeExternalLinks],
  },
});
