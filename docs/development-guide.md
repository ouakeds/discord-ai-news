# Development Guide — discord-ai-news

## Prerequisites

- Node.js 18+ (required for native `fetch`)
- npm
- PM2 (for VPS deployment only)

## Initial Setup

```bash
npm init -y

# Runtime dependencies
npm install discord.js@^14 node-cron rss-parser js-yaml better-sqlite3 pino pino-pretty string-similarity dotenv

# Dev dependencies
npm install -D typescript tsup tsx @types/node @types/node-cron @types/better-sqlite3 @types/js-yaml @types/string-similarity eslint @typescript-eslint/eslint-plugin vitest
```

## Environment Setup

```bash
# Copy example files
cp .env.example .env
cp config.example.yaml config.yaml

# Edit .env — set your Discord bot token
DISCORD_TOKEN=your_discord_token_here

# Edit config.yaml — set your sources, themes, channels, schedule
```

**Never commit `.env` or `config.yaml`.** Both are gitignored.

## Local Development

```bash
# Run without build step (tsx watches TypeScript directly)
tsx src/index.ts
```

## Build

```bash
# Build for VPS (CJS format required for PM2)
tsup src/index.ts --format cjs --out-dir dist
```

## Testing

```bash
# Run all tests
vitest run

# Watch mode for development
vitest
```

Test files are co-located: `src/collectors/rss-collector.test.ts`, etc.

## VPS Deployment (PM2)

```bash
# Build first
tsup src/index.ts --format cjs --out-dir dist

# Start daemon
pm2 start ecosystem.config.js

# Monitor
pm2 logs discord-ai-news
pm2 status

# Reload after config change (restarts process)
pm2 restart discord-ai-news
```

PM2 writes logs to `logs/out.log` and `logs/error.log`.
OS-level `logrotate` handles rotation — no Node.js rotation dependency.

## Configuration Reference

`config.yaml` structure (see `config.example.yaml` for annotated version):

```yaml
schedule:
  time: "10:00"          # Daily trigger time (24h format)

admin:
  alert_channel: "bot-admin"   # Discord channel name for failure alerts

themes:
  openai:
    channel: "news-openai"     # Discord channel for this theme
  # ... more themes

sources:
  - type: rss
    url: "https://openai.com/blog/rss.xml"
    name: "OpenAI Blog"
    theme: openai
  - type: youtube
    channel_id: "CHANNEL_ID"
    name: "Channel Name"
    theme: youtube
  - type: reddit
    subreddit: "MachineLearning"
    name: "r/MachineLearning"
    theme: general
    min_score: 50
  - type: hn
    keywords: ["AI", "LLM"]
    min_score: 100
    theme: general
  - type: producthunt
    theme: outils
```

## Implementation Order

When building out the project, follow this dependency order:

1. `src/types/index.ts` — shared interfaces (everything depends on this)
2. `src/core/config-loader.ts` — YAML parse + type guards
3. `src/core/db.ts` — SQLite init + tables
4. `src/utils/logger.ts` — pino instance
5. `src/collectors/*` — 5 collectors (all depend on types)
6. `src/core/dedup-engine.ts` — depends on db
7. `src/core/discord-publisher.ts` — depends on types
8. `src/core/cycle-runner.ts` — orchestrates collectors + dedup + publisher + db
9. `src/core/scheduler.ts` — wraps cycle-runner with node-cron
10. `src/index.ts` — entry point wiring everything together

_Last Updated: 2026-05-21_
