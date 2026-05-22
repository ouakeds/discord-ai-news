# discord-ai-news

A self-hosted Discord bot that collects AI news from multiple sources every day and publishes digest embeds to themed channels — no manual curation required.

## What it does

Every day at a configured time, the bot:

1. Collects articles from up to 5 source types (RSS, YouTube, Reddit, HackerNews, ProductHunt)
2. Deduplicates by exact URL (7-day memory) and title similarity (85% threshold)
3. Groups remaining items by theme and posts Discord embeds to the matching channels
4. Sends an alert to `#bot-admin` if a cycle publishes 0 items

## Architecture

```
config.yaml ──► config-loader ──► scheduler (cron)
                                        │
                                   cycle-runner
                                   ├── rss-collector
                                   ├── youtube-collector
                                   ├── reddit-collector
                                   ├── hn-collector
                                   └── producthunt-collector
                                        │
                                   dedup-engine (URL + title)
                                        │
                                   discord-publisher (by theme → channel)
```

Each collector runs independently — a failure in one never blocks the others.

## Prerequisites

- Node.js 18+
- A Discord bot token with **Guilds** intent enabled
- A server where the bot is a member with permission to post in the target channels

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Create `.env`**

```bash
cp .env.example .env
# Edit .env and set your DISCORD_TOKEN
```

**3. Create `config.yaml`**

```bash
cp config.example.yaml config.yaml
# Edit config.yaml to configure your channels and sources
```

**4. Run in development**

```bash
npm run dev
```

## Configuration

All bot behavior is controlled by `config.yaml`. No code changes required to add sources or channels.

```yaml
schedule:
  time: "10:00"          # Daily run time (HH:MM, 24h, server timezone)

admin:
  alert_channel: "bot-admin"   # Channel for health alerts

themes:
  openai:
    channel: "news-openai"     # Discord channel name (without #)
  general:
    channel: "news-general"

sources:
  - type: rss
    url: "https://openai.com/blog/rss.xml"
    name: "OpenAI Blog"
    theme: openai

  - type: youtube
    channel_id: "UCxxxxxx"     # YouTube channel ID (from channel URL)
    name: "Channel Name"
    theme: general

  - type: reddit
    subreddit: "MachineLearning"
    name: "r/MachineLearning"
    theme: general
    min_score: 50              # Optional: minimum post score

  - type: hn
    keywords: ["AI", "LLM"]
    min_score: 100             # Optional: minimum HN score
    theme: general

  - type: producthunt
    theme: general
```

## Source types

| Type | API | Auth required |
|------|-----|---------------|
| `rss` | RSS/Atom feed | No |
| `youtube` | YouTube RSS (no API key) | No |
| `reddit` | Reddit JSON API | No |
| `hn` | HackerNews Algolia API | No |
| `producthunt` | ProductHunt RSS | No |

## Development

```bash
npm run dev      # Run without build (tsx)
npm test         # Run test suite (Vitest)
npm run lint     # ESLint
npm run build    # Compile to dist/ (CommonJS, for PM2)
```

Tests live in `tests/` and mirror the `src/` structure.

## Deployment (VPS + PM2)

```bash
# Build
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Logs
pm2 logs discord-ai-news
```

Logs are written to `logs/out.log` and `logs/error.log`. Rotation is handled by the OS via `logrotate`.

## Project structure

```
src/
├── collectors/          # One file per source type
│   ├── rss-collector.ts
│   ├── youtube-collector.ts
│   ├── reddit-collector.ts
│   ├── hn-collector.ts
│   └── producthunt-collector.ts
├── core/
│   ├── config-loader.ts # YAML parsing + validation (called only from index.ts)
│   ├── db.ts            # SQLite init (only file that imports better-sqlite3)
│   ├── dedup-engine.ts  # URL registry + title similarity dedup
│   ├── discord-publisher.ts
│   ├── cycle-runner.ts  # Orchestrates the full collect → dedup → publish pipeline
│   └── scheduler.ts     # node-cron wrapper + admin alert
├── types/
│   └── index.ts         # Shared interfaces (CollectedItem, AppConfig, SourceConfig…)
├── utils/
│   └── logger.ts        # pino instance (structured JSON, pino-pretty in dev)
└── index.ts             # Entry point: loads config, inits DB, logs in Discord, starts scheduler

tests/                   # Mirrors src/ structure
config.example.yaml
ecosystem.config.js      # PM2 config
```

## Tech stack

| Concern | Library |
|---------|---------|
| Language | TypeScript (strict) |
| Discord | discord.js v14 |
| Scheduler | node-cron |
| RSS/Atom/YouTube | rss-parser |
| HackerNews | native fetch → Algolia API |
| Reddit | native fetch → Reddit JSON API |
| Config | js-yaml |
| Persistence | better-sqlite3 |
| Logging | pino + pino-pretty |
| Title dedup | string-similarity (Dice coefficient) |
| Build | tsup (CJS output for PM2) |
| Tests | Vitest |
