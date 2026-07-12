import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { visit } from "unist-util-visit";

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
  integrations: [mdx(), sitemap(), tailwind()],
  markdown: {
    rehypePlugins: [rehypeExternalLinks],
  },
});
