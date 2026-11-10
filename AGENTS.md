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
