# Source Tree Analysis — discord-ai-news

_Planned directory structure — project is greenfield (no code written yet)._

## Complete Directory Structure

```
discord-ai-news/
├── package.json                          # Node.js manifest + scripts
├── tsconfig.json                         # TypeScript strict config
├── tsup.config.ts                        # Build config (CJS output for PM2)
├── vitest.config.ts                      # Test runner config
├── ecosystem.config.js                   # PM2 daemon config (restart on failure)
├── .env                                  # ← GITIGNORED — DISCORD_TOKEN
├── .env.example                          # Committed — placeholder values
├── .gitignore
├── config.yaml                           # ← GITIGNORED — sources, themes, schedule
├── config.example.yaml                   # Committed — fully annotated example
│
├── src/
│   ├── index.ts                          # Entry point: load config → init DB → start scheduler
│   │
│   ├── types/
│   │   └── index.ts                      # ALL shared interfaces: CollectedItem, AppConfig, SourceConfig…
│   │
│   ├── collectors/                       # One file per source type + co-located tests
│   │   ├── rss-collector.ts              # FR-1: RSS/Atom feeds
│   │   ├── rss-collector.test.ts
│   │   ├── youtube-collector.ts          # FR-2: YouTube RSS (no API key)
│   │   ├── youtube-collector.test.ts
│   │   ├── reddit-collector.ts           # FR-3: Reddit RSS (best-effort)
│   │   ├── reddit-collector.test.ts
│   │   ├── hn-collector.ts               # FR-4: HackerNews Algolia API (native fetch)
│   │   ├── hn-collector.test.ts
│   │   ├── producthunt-collector.ts      # FR-5: ProductHunt RSS
│   │   └── producthunt-collector.test.ts
│   │
│   ├── core/                             # Pipeline orchestration + infrastructure
│   │   ├── config-loader.ts              # FR-12/13/14: js-yaml parse + type guards
│   │   ├── config-loader.test.ts
│   │   ├── db.ts                         # SQLite init, published_urls, cycle_lock
│   │   ├── dedup-engine.ts               # FR-6: URL registry (7d), FR-7: title similarity (85%)
│   │   ├── dedup-engine.test.ts
│   │   ├── discord-publisher.ts          # FR-8: embed format, FR-9: routing, FR-10: digest header
│   │   ├── discord-publisher.test.ts
│   │   ├── cycle-runner.ts               # Orchestrates: lock → collect → dedup → publish → unlock
│   │   ├── cycle-runner.test.ts
│   │   └── scheduler.ts                  # FR-11: node-cron daily trigger, FR-16: admin alert
│   │
│   └── utils/
│       └── logger.ts                     # FR-15: pino instance, structured JSON, context helpers
│
├── data/
│   └── .gitkeep                          # Runtime: bot.db created here (gitignored)
│
├── logs/
│   └── .gitkeep                          # PM2 out/error log files (gitignored)
│
└── dist/                                 # tsup build output (gitignored)
```

## Critical Directories

| Directory | Purpose |
|---|---|
| `src/types/` | Single source of truth for all shared TypeScript interfaces |
| `src/collectors/` | One collector per source type — all follow the same function signature |
| `src/core/` | Pipeline infrastructure — cycle orchestration, dedup, publisher, scheduler |
| `src/utils/` | Cross-cutting utilities — only logger for now |
| `data/` | Runtime SQLite DB — created automatically, gitignored |
| `logs/` | PM2 captures pino stdout here — gitignored |

## Entry Points

| File | Role |
|---|---|
| `src/index.ts` | Process entry point — loads config, inits DB, starts scheduler |
| `ecosystem.config.js` | PM2 entry on VPS — sets env, restart policy, log paths |

_Last Updated: 2026-05-21_
