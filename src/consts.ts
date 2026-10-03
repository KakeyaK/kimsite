import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "Kim Kakeya",
  EMAIL: "kimkakeya@gmail.com",
  NUM_LATEST_POSTS: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION:
    "Welcome to my personal website. Exploring systems, kernel development, and software engineering.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "A collection of my projects, with links to repositories and demos.",
};

export const SANDBOX: Metadata = {
  TITLE: "Sandbox",
  DESCRIPTION: "Small apps and experiments you can play with right in the browser.",
};

export const SOCIALS: Socials = [
  {
    NAME: "github",
    HREF: "https://github.com/KakeyaK",
  },
  {
    NAME: "linkedin",
    HREF: "https://www.linkedin.com/in/kimcarvalho",
  },
];
