# Data Models — discord-ai-news

## Database

**SQLite** — single file at `data/bot.db` (created at runtime, gitignored).
Accessed exclusively via `src/core/db.ts` using `better-sqlite3` (synchronous API).

---

## Table: `published_urls`

Stores URLs already published to Discord. Used for 7-day deduplication.

```sql
CREATE TABLE IF NOT EXISTS published_urls (
  url        TEXT    NOT NULL,
  published_at INTEGER NOT NULL   -- Unix timestamp (ms)
);

CREATE INDEX IF NOT EXISTS idx_published_urls_url ON published_urls(url);
CREATE INDEX IF NOT EXISTS idx_published_urls_published_at ON published_urls(published_at);
```

**Usage:**
- At cycle start: DELETE rows where `published_at < NOW - 7 days`
- Before publishing: SELECT count where `url = ?` — if > 0, skip item
- After publishing: INSERT `(url, published_at)`

---

## Table: `cycle_lock`

Single-row mutex preventing concurrent cycle executions.

```sql
CREATE TABLE IF NOT EXISTS cycle_lock (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  running     INTEGER NOT NULL DEFAULT 0,  -- BOOLEAN: 0 or 1
  started_at  INTEGER                       -- Unix timestamp (ms), nullable
);

INSERT OR IGNORE INTO cycle_lock (id, running) VALUES (1, 0);
```

**Usage:**
- At cycle start: UPDATE `running = 1, started_at = NOW` WHERE `running = 0` — if 0 rows affected, another cycle is running → abort
- In `finally` block: UPDATE `running = 0, started_at = NULL`

---

## TypeScript Interface: `CollectedItem`

The universal content unit — every collector returns an array of these.

```typescript
interface CollectedItem {
  url: string;
  title: string;
  description: string;  // ≤ 300 chars — truncated by collector
  sourceName: string;   // human-readable source label
  theme: string;        // theme key from config (e.g. "openai")
  publishedAt: Date;    // UTC Date object — never a string
}
```

---

## TypeScript Config Types

```typescript
interface RssSource         { type: 'rss';        url: string;        name: string; theme: string; }
interface YoutubeSource     { type: 'youtube';     channel_id: string; name: string; theme: string; }
interface RedditSource      { type: 'reddit';      subreddit: string;  name: string; theme: string; min_score?: number; }
interface HnSource          { type: 'hn';          keywords: string[]; min_score?: number; theme: string; }
interface ProductHuntSource { type: 'producthunt'; theme: string; }

type SourceConfig = RssSource | YoutubeSource | RedditSource | HnSource | ProductHuntSource;

interface ThemeConfig    { channel: string; }
interface ScheduleConfig { time: string; }      // e.g. "10:00"
interface AdminConfig    { alert_channel: string; }

interface AppConfig {
  schedule: ScheduleConfig;
  admin: AdminConfig;
  themes: Record<string, ThemeConfig>;
  sources: SourceConfig[];
}
```

All types defined in `src/types/index.ts` — single source of truth.

_Last Updated: 2026-05-21_
