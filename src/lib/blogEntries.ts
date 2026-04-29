import type { CollectionEntry } from "astro:content";

type BlogEntry = CollectionEntry<"blog">;

type BlogPostEntry = BlogEntry & { data: { date: Date; folder?: false } };

type BlogFolderEntry = BlogEntry & { data: { folder: true } };

function isBlogFolderEntry(entry: BlogEntry): entry is BlogFolderEntry {
  return entry.data.folder === true;
}

function isBlogPostEntry(entry: BlogEntry): entry is BlogPostEntry {
  return entry.data.folder !== true;
}

export type { BlogEntry, BlogPostEntry, BlogFolderEntry };
export { isBlogFolderEntry, isBlogPostEntry };
