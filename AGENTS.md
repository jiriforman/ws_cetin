# Project rules

- Keep reading font preferences browser-local and apply them at the document level, so all pages and rich text change consistently without changing images or shared workshop data.
- Host selectable fonts locally, including Latin and Latin Extended subsets, so workshop text works without third-party font requests and supports Czech characters.
- Keep reading size browser-local and scale the root rem size, so text and its surrounding controls resize together without transform-based clipping.
- Store each phase's two learning categories as separate rich-text fields and edit them through the shared phase learnings editor; this preserves bullet formatting and independent category content across admin saves and workbook transfers.
- Use a shared phase publication flag for Learnings in phase details, the summary, and PDF export; use a separate section enable flag to gate the summary route and main-menu entry so unpublished learning content is consistently omitted from these views.
- Export the Learnings table client-side as a single landscape A4 PDF, preserving locally selected fonts through a rendered capture and scaling the whole table to fit without truncation.
- Keep each phase's cheat sheet as its own rich-text field and show it, with the phase map and published learnings, only on the link-only /cheat page (no menu entry, noindex).
- Model parallel phases with the per-phase `parallel_with` partner id, kept symmetric on both phases only through admin-api `set-parallel` (partners must be adjacent in phase order), and group them only through `src/lib/phaseBlocks.ts`; a block starts/stops together (admin-api start-phase), shares one timer and voiceover (stored on its first phase), keeps each phase's own evaluation, and counts once (longest phase) in totals.
- Add database changes as drizzle migrations (`drizzle/migrations` + `meta/_journal.json`); Lovable applies these, not `supabase/migrations`.
- Keep team-owned profile data (intro video link, PM name, members) on the team row, editable only through team-api with the team token; rankings stay facilitator-only. Intro videos are YouTube/Vimeo links, never uploads.
- Keep the big-screen Mission Control dashboard link-only at /live (no menu entry, no Narcos navigation bar, noindex); it reads only public workshop data and reuses `src/lib/phaseBlocks.ts` and `src/lib/rankings.ts` for mission status and standings.
