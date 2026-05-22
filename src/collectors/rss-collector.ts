import RssParser from 'rss-parser';
import type { CollectedItem, RssSource, SourceConfig } from '../types';
import logger from '../utils/logger';

const parser = new RssParser();
const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function collect(sources: SourceConfig[]): Promise<CollectedItem[]> {
  const rssSources = sources.filter((s): s is RssSource => s.type === 'rss');
  const items: CollectedItem[] = [];

  for (const source of rssSources) {
    try {
      const feed = await parser.parseURL(source.url);
      const cutoff = new Date(Date.now() - WINDOW_MS);

      for (const entry of feed.items ?? []) {
        const publishedAt = new Date(entry.pubDate ?? entry.isoDate ?? '');
        if (isNaN(publishedAt.getTime()) || publishedAt < cutoff) continue;

        items.push({
          url: entry.link ?? '',
          title: (entry.title ?? '').substring(0, 256),
          description: (entry.contentSnippet ?? entry.summary ?? '').substring(0, 300),
          sourceName: source.name,
          theme: source.theme,
          publishedAt,
        });
      }
    } catch (err) {
      logger.error({ source: 'rss-collector', url: source.url, err }, 'Fetch failed');
    }
  }

  return items;
}
