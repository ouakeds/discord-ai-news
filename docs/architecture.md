# Architecture — discord-ai-news

## Pattern

**Batch pipeline daemon** — sequential collect → dedup → publish cycle triggered by node-cron.

## Data Flow

```
scheduler.ts (node-cron, daily 10h)
  └─► cycle-runner.ts
        ├─► db.ts (acquire cycle lock — SQLite row)
        ├─► rss-collector.ts        ─┐
        ├─► youtube-collector.ts     │  each returns CollectedItem[]
        ├─► reddit-collector.ts      │  or [] on error (never throws)
        ├─► hn-collector.ts          │
        ├─► producthunt-collector.ts ─┘
        ├─► dedup-engine.ts (URL registry 7d + title similarity 85%)
        ├─► discord-publisher.ts (theme → channel routing, embed posting)
        └─► db.ts (release cycle lock — finally block)
```

## Module Boundaries

| Module | Consumes | Consumed By |
|---|---|---|
| `src/index.ts` | config-loader, db, scheduler | — (entry point) |
| `src/core/config-loader.ts` | js-yaml | index.ts only |
| `src/core/db.ts` | better-sqlite3 | dedup-engine, cycle-runner |
| `src/collectors/*` | rss-parser, fetch | cycle-runner only |
| `src/core/dedup-engine.ts` | db | cycle-runner only |
| `src/core/discord-publisher.ts` | discord.js | cycle-runner only |
| `src/core/cycle-runner.ts` | collectors, dedup, publisher, db | scheduler only |
| `src/core/scheduler.ts` | node-cron, cycle-runner | index.ts |
| `src/utils/logger.ts` | pino | all modules |

**Strict rules:**
- `better-sqlite3` imported only in `src/core/db.ts`
- `loadConfig()` called only in `src/index.ts` — all other modules receive config as parameter
- No circular imports possible (acyclic dependency graph by design)

## Persistence

**SQLite database** at `data/bot.db` (single file, synchronous I/O via better-sqlite3).

Two tables:

| Table | Columns | Purpose |
|---|---|---|
| `published_urls` | `url TEXT`, `published_at INTEGER` | 7-day URL dedup registry |
| `cycle_lock` | `id INTEGER`, `running BOOLEAN`, `started_at INTEGER` | Prevent concurrent cycles |

Rows in `published_urls` older than 7 days are pruned at cycle start.

## External Integrations

| Source | Protocol | Module |
|---|---|---|
| RSS/Atom feeds | HTTP GET → rss-parser | rss-collector.ts |
| YouTube RSS | HTTP GET → rss-parser | youtube-collector.ts |
| Reddit RSS | HTTP GET → rss-parser | reddit-collector.ts |
| HackerNews Algolia API | HTTP GET → native fetch | hn-collector.ts |
| ProductHunt RSS | HTTP GET → rss-parser | producthunt-collector.ts |
| Discord (embeds) | discord.js v14 REST | discord-publisher.ts |
| Discord (admin alert) | discord.js v14 REST | scheduler.ts |

All external reads are best-effort — source failure returns `[]` and cycle continues.

## Deployment

- **Process manager**: PM2 (`ecosystem.config.js`)
- **Log handling**: pino stdout → PM2 `out_file` → OS `logrotate`
- **Config changes**: require PM2 restart (no watch mode)
- **Cycle serialization**: SQLite lock row acquired at cycle start, released in `finally`

_Last Updated: 2026-05-21_
