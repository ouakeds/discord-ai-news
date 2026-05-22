# Project Overview — discord-ai-news

## Purpose

`discord-ai-news` is a **Node.js/TypeScript scheduled daemon** that runs a daily batch pipeline collecting AI/tech news from 5 source types and publishing formatted Discord embeds to themed channels.

It is a single-server background process with **no web interface, no user-facing API, and no real-time requirements**. All behavior is driven by a YAML config file.

## Tech Stack

| Category | Technology | Version |
|---|---|---|
| Runtime | Node.js | 18+ |
| Language | TypeScript | strict mode |
| Discord client | discord.js | ^14 |
| Scheduler | node-cron | latest |
| RSS/Feed parsing | rss-parser | latest |
| Config parsing | js-yaml | latest |
| Persistence | better-sqlite3 | latest |
| Logging | pino + pino-pretty | latest |
| Title similarity | string-similarity | latest |
| Env vars | dotenv | latest |
| Build | tsup | CJS output for PM2 |
| Dev runner | tsx | no build step |
| Tests | Vitest | latest |

## Architecture Type

**Backend daemon / batch pipeline** — single monolith, single process, single VPS deployment.

- Scheduler fires once per day (configurable via `config.yaml`)
- 5 source collectors run sequentially (fault-isolated, each wrapped in try/catch)
- Two-layer deduplication: URL registry (7 days, SQLite) + title similarity (85% Dice coefficient)
- Discord embeds published by theme → channel routing
- All behavior defined in `config.yaml` — no code changes needed to add sources/themes

## Key Constraints

- **v1**: No AI synthesis — raw title + description only
- **v2 planned**: Claude Haiku summaries, French translation, semantic dedup
- Cycle must complete in < 10 minutes (SM-3)
- DISCORD_TOKEN in `.env` only — never in config or code
- Same-day re-run must not re-publish (idempotency via SQLite dedup)
- Concurrent cycle executions prevented via SQLite lock row

## Repository Structure

```
discord-ai-news/            ← Single monolith
├── src/                    ← All TypeScript source
│   ├── types/              ← Shared interfaces (CollectedItem, AppConfig…)
│   ├── collectors/         ← 5 source collectors + tests
│   ├── core/               ← Config, DB, dedup, publisher, cycle, scheduler
│   └── utils/              ← Logger
├── data/                   ← Runtime SQLite DB (gitignored)
├── logs/                   ← PM2 log files (gitignored)
├── dist/                   ← tsup build output (gitignored)
├── config.yaml             ← Gitignored runtime config
├── config.example.yaml     ← Committed annotated example
├── .env                    ← Gitignored secrets
└── .env.example            ← Committed placeholder
```

_Last Updated: 2026-05-21_
