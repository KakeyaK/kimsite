---
title: "Travel map"
description: "An interactive map of where I've been, plus trip invites you can send to friends."
date: "Sep 26 2026"
demoURL: "/projects/map"
---

A small tool that lives entirely in the browser: mark countries and states you've visited, lived in, or want to see, and watch your stats grow.

- [Open your own map](/projects/map). It's saved in your browser only; export it as JSON whenever you like.
- [See my map](/projects/map/kim), with a timeline of when I got where.
- Plan a trip from any country and send the link. It opens as a spinning globe that flies to the destination.

## How it works

There is no server. Your map lives in `localStorage`, invites are compressed into the link itself (after the `#`, so they never reach a server), and my map is a JSON file in the site's repo.

Built with Astro, Preact and MapLibre GL. Country shapes from Natural Earth, cities from GeoNames.
