import type { CollectedItem, RedditSource, SourceConfig } from '../types';
import logger from '../utils/logger';

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface RedditPost {
  title: string;
  url: string;
  selftext: string;
  score: number;
  created_utc: number;
  permalink: string;
}

interface RedditResponse {
  data: {
    children: Array<{ data: RedditPost }>;
  };
}

export async function collect(sources: SourceConfig[]): Promise<CollectedItem[]> {
  const redditSources = sources.filter((s): s is RedditSource => s.type === 'reddit');
  const items: CollectedItem[] = [];

  for (const source of redditSources) {
    const minScore = source.min_score ?? 50;
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${source.subreddit}/new.json?limit=25`,
        { headers: { 'User-Agent': 'discord-ai-news/1.0' } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as RedditResponse;
      const cutoff = Date.now() - WINDOW_MS;

      for (const child of json.data?.children ?? []) {
        const post = child.data;
        if (post.score < minScore) continue;
        const publishedAt = new Date(post.created_utc * 1000);
        if (publishedAt.getTime() < cutoff) continue;

        items.push({
          url: `https://www.reddit.com${post.permalink}`,
          title: (post.title ?? '').substring(0, 256),
          description: (post.selftext ?? '').substring(0, 300),
          sourceName: source.name,
          theme: source.theme,
          publishedAt,
        });
      }
    } catch (err) {
      logger.error({ source: 'reddit-collector', subreddit: source.subreddit, err }, 'Fetch failed');
    }
  }

  return items;
}
