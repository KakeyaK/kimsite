import { getCollection } from "astro:content";
import { BLOG, HOME, PROJECTS } from "@consts";
import { isBlogFolderEntry, isBlogPostEntry } from "@lib/blogEntries";
import type { SearchItem } from "@lib/search";

// The index behind the search palette (SearchPalette.astro): sections first,
// then blog folders, blog posts and projects.
export async function GET() {
  const blog = (await getCollection("blog")).filter(
    (entry) => !entry.data.draft,
  );
  const posts = blog
    .filter(isBlogPostEntry)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const projects = (await getCollection("projects"))
    .filter((project) => !project.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  // Same folders that blog/[...slug].astro builds routes for: every folder
  // index plus every directory above a post.
  const folderMeta = new Map<string, { title: string; description: string }>();
  const folderSlugs = new Set<string>();
  blog.filter(isBlogFolderEntry).forEach((entry) => {
    const slug = entry.slug.replace(/\/index$/, "");
    if (!slug) return;
    folderMeta.set(slug, entry.data);
    folderSlugs.add(slug);
  });
  posts.forEach((post) => {
    const parts = post.slug.split("/");
    for (let i = 1; i < parts.length; i++) {
      folderSlugs.add(parts.slice(0, i).join("/"));
    }
  });

  const folderTitle = (slug: string) =>
    folderMeta.get(slug)?.title ?? slug.split("/").slice(-1)[0];

  // "Blog / <folder title> / ..." for everything above the given slug
  const blogPath = (slug: string) => {
    const parts = slug.split("/").slice(0, -1);
    return [
      BLOG.TITLE,
      ...parts.map((_, i) => folderTitle(parts.slice(0, i + 1).join("/"))),
    ].join(" / ");
  };

  const items: SearchItem[] = [
    { title: HOME.TITLE, description: HOME.DESCRIPTION, href: "/", kind: "Page" },
    { title: BLOG.TITLE, description: BLOG.DESCRIPTION, href: "/blog", kind: "Page" },
    {
      title: PROJECTS.TITLE,
      description: PROJECTS.DESCRIPTION,
      href: "/projects",
      kind: "Page",
    },
    ...Array.from(folderSlugs)
      .sort()
      .map((slug) => ({
        title: folderTitle(slug),
        description: folderMeta.get(slug)?.description ?? "",
        href: `/blog/${slug}`,
        kind: "Folder" as const,
        path: blogPath(slug),
      })),
    ...posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      href: `/blog/${post.slug}`,
      kind: "Post" as const,
      path: blogPath(post.slug),
    })),
    ...projects.flatMap((project) => {
      const { title, description, demoURL } = project.data;
      const entry = {
        title,
        description,
        href: `/projects/${project.slug}`,
        kind: "Project" as const,
        path: PROJECTS.TITLE,
      };
      // A demo hosted on this site (e.g. the travel map) is a page of its own
      return demoURL?.startsWith("/")
        ? [entry, { ...entry, href: demoURL, kind: "App" as const }]
        : [entry];
    }),
  ];

  return new Response(JSON.stringify(items), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
