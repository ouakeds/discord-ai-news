import RssParser from 'rss-parser';
import type { CollectedItem, ProductHuntSource, SourceConfig } from '../types';
import logger from '../utils/logger';

const parser = new RssParser({ customFields: { item: ['media:thumbnail', 'enclosure'] } });
const PH_FEED_URL = 'https://www.producthunt.com/feed?category=artificial-intelligence';
const WINDOW_MS = 24 * 60 * 60 * 1000;

function extractImageUrl(entry: Record<string, unknown>): string | undefined {
  const thumbnail = entry['media:thumbnail'] as { $?: { url?: string } } | undefined;
  if (thumbnail?.$?.url) return thumbnail.$.url;
  const enclosure = entry['enclosure'] as { url?: string; type?: string } | undefined;
  if (enclosure?.url && enclosure.type?.startsWith('image/')) return enclosure.url;
  const content = (entry['content'] ?? entry['summary'] ?? '') as string;
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

export async function collect(sources: SourceConfig[]): Promise<CollectedItem[]> {
  const phSources = sources.filter((s): s is ProductHuntSource => s.type === 'producthunt');
  if (phSources.length === 0) return [];

  const items: CollectedItem[] = [];

  for (const source of phSources) {
    try {
      const feed = await parser.parseURL(PH_FEED_URL);
      const cutoff = new Date(Date.now() - WINDOW_MS);

      for (const entry of feed.items ?? []) {
        const publishedAt = new Date(entry.pubDate ?? entry.isoDate ?? '');
        if (isNaN(publishedAt.getTime()) || publishedAt < cutoff) continue;

        items.push({
          url: entry.link ?? '',
          title: (entry.title ?? '').substring(0, 256),
          description: (entry.contentSnippet ?? entry.summary ?? '').substring(0, 300),
          sourceName: 'ProductHunt',
          theme: source.theme,
          publishedAt,
          imageUrl: extractImageUrl(entry as Record<string, unknown>),
        });
      }
    } catch (err) {
      logger.error({ source: 'producthunt-collector', err }, 'Fetch failed');
    }
  }

  return items;
}
