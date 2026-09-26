import { defineCollection, z } from "astro:content";

const blogPost = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  folder: z.literal(false).optional(),
  draft: z.boolean().optional(),
});

const blogFolder = z.object({
  title: z.string(),
  description: z.string(),
  folder: z.literal(true),
  draft: z.boolean().optional(),
});

const blog = defineCollection({
  type: "content",
  schema: z.union([blogPost, blogFolder]),
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().optional(),
    demoURL: z.string().optional(),
    repoURL: z.string().optional(),
  }),
});

export const collections = { blog, projects };
