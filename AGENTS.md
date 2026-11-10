# Project: Journey Log PWA

## Goal

A personal travel log for flights, rail (including high-speed rail), and cruises, with a route map, statistics and a shareable yearly recap. It is a portfolio project, so code quality, tests and a polished UI matter.

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- Local-first storage: IndexedDB via Dexie. No user accounts or backend database.
- MapLibre GL JS for maps, Recharts for charts, Zod for validation
- Vitest for unit tests, Playwright for end-to-end tests

## Rules

- Never put API keys or secrets in client code and never commit them. Use `.env.local` (git-ignored) and server-side route handlers.
- Never invent coordinates or reference data without stating the source. Reference data files must include a source note.
- Keep components small. Put business logic (distance, time zones, statistics, import/export) in `src/lib/` with unit tests.
- All UI text must support Traditional Chinese (zh-TW) and English.
- Before finishing any task: run lint, type-check and tests, fix failures, then summarise what changed and what I should check by hand.
- Commit at the end of each task with a clear message. Do not push.
- Ask me if something is unclear instead of guessing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
