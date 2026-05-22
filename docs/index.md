# discord-ai-news — Documentation Index

> **Primary AI Agent Entry Point** — read this first when implementing any feature.

## Project Overview

- **Type:** Backend daemon / batch pipeline (Node.js TypeScript monolith)
- **Purpose:** Daily scheduled news aggregator publishing Discord embeds from 5 source types
- **Architecture:** Scheduled daemon, single VPS, PM2, SQLite, no web API
- **Status:** Greenfield — planning complete, implementation not yet started

## Quick Reference

- **Entry point:** `src/index.ts`
- **Tech stack:** Node.js 18+ / TypeScript strict / discord.js v14 / better-sqlite3 / pino / Vitest
- **Build:** `tsup --format cjs` / Dev: `tsx src/index.ts`
- **Shared interfaces:** `src/types/index.ts` (single source of truth)
- **DB access:** `src/core/db.ts` only (never import better-sqlite3 elsewhere)

## Generated Documentation

- [Project Overview](./project-overview.md) — purpose, constraints, architecture summary
- [Architecture](./architecture.md) — data flow, module boundaries, persistence, deployment
- [Source Tree Analysis](./source-tree-analysis.md) — planned directory structure with annotations
- [Data Models](./data-models.md) — SQLite schema, CollectedItem interface, AppConfig types
- [Development Guide](./development-guide.md) — setup, commands, implementation order

## Planning Artifacts

- [PRD](./../_bmad-output/planning-artifacts/prds/prd-discord-ai-news-2026-05-21/prd.md) — full functional requirements (16 FRs)
- [Architecture Decision Doc](./../_bmad-output/planning-artifacts/architecture.md) — detailed technical decisions with rationale
- [Epics & Stories](./../_bmad-output/planning-artifacts/epics.md) — implementation breakdown

## AI Agent Rules

- [Project Context](./../_bmad-output/project-context.md) — **critical rules, anti-patterns, naming conventions** — read before writing any code

## Getting Started

1. Read [Architecture](./architecture.md) for data flow and module boundaries
2. Read [Project Context](./../_bmad-output/project-context.md) for implementation rules
3. Check [Data Models](./data-models.md) for the `CollectedItem` interface contract
4. Follow [Development Guide](./development-guide.md) for setup and implementation order

_Last Updated: 2026-05-21_
