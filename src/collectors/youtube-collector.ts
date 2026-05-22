import RssParser from 'rss-parser';
import type { CollectedItem, YoutubeSource, SourceConfig } from '../types';
import logger from '../utils/logger';

const parser = new RssParser();
const WINDOW_MS = 24 * 60 * 60 * 1000;
const YT_FEED_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

export async function collect(sources: SourceConfig[]): Promise<CollectedItem[]> {
  const ytSources = sources.filter((s): s is YoutubeSource => s.type === 'youtube');
  const items: CollectedItem[] = [];

  for (const source of ytSources) {
    try {
      const feed = await parser.parseURL(`${YT_FEED_BASE}${source.channel_id}`);
      const cutoff = new Date(Date.now() - WINDOW_MS);

      for (const entry of feed.items ?? []) {
        const publishedAt = new Date(entry.pubDate ?? entry.isoDate ?? '');
        if (isNaN(publishedAt.getTime()) || publishedAt < cutoff) continue;

        items.push({
          url: entry.link ?? '',
          title: (entry.title ?? '').substring(0, 256),
          description: (entry.contentSnippet ?? '').substring(0, 300),
          sourceName: source.name,
          theme: source.theme,
          publishedAt,
        });
      }
    } catch (err) {
      logger.error({ source: 'youtube-collector', channel_id: source.channel_id, err }, 'Fetch failed');
    }
  }

  return items;
}
