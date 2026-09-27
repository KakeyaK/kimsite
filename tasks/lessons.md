# Lessons

## 2026-09-27 — Travel map layout feedback
- **Map tools: the map is the page.** Default to a full-width map with its controls (search, status buttons, primary action) floating *inside* the map area, not in side columns or below it. Side panels shrink the map and split attention.
- **One entry point per action.** Don't offer the same action from two places ("Plan a trip here" + "Plan a trip with friends"). Use one button that picks up context (e.g. the selected country).
- **Freeform user content → one rich text field.** Prefer a single Markdown field (which can carry images/links) over separate structured fields like "image links". Render it by building elements from tokens with an allowlist, never via innerHTML.

## 2026-09-27 — Round 3 feedback
- **Never fail silently in the UI.** Hiding broken images (`display: none` on error) made "images don't work" look like a bug with no clue why. Show a visible, actionable note instead ("link must point to the image file").
- **Test user-content features with realistic input in a real browser.** Test with the kind of link a person actually pastes (a photo page, a share link), not only a known-good direct URL or render-to-string.
- **Git in this repo:** never reach for `git mv`/`git add`/`git rm`, even for a rename. Use plain `mv` (Kim's CLAUDE.md).
