import type { CollectedItem, HnSource, SourceConfig } from '../types';
import logger from '../utils/logger';

const WINDOW_MS = 24 * 60 * 60 * 1000;

interface HnHit {
  objectID: string;
  url?: string;
  title?: string;
  story_text?: string;
  created_at_i: number;
}

interface AlgoliaResponse {
  hits: HnHit[];
}

export async function collect(sources: SourceConfig[]): Promise<CollectedItem[]> {
  const hnSources = sources.filter((s): s is HnSource => s.type === 'hn');
  const items: CollectedItem[] = [];

  for (const source of hnSources) {
    const minScore = source.min_score ?? 100;
    const since = Math.floor((Date.now() - WINDOW_MS) / 1000);
    const query = source.keywords.join(' ');

    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=${encodeURIComponent(query)}&numericFilters=points>=${minScore},created_at_i>=${since}&hitsPerPage=30`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as AlgoliaResponse;

      for (const hit of json.hits ?? []) {
        items.push({
          url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: (hit.title ?? '').substring(0, 256),
          description: (hit.story_text ?? '').substring(0, 300),
          sourceName: 'HackerNews',
          theme: source.theme,
          publishedAt: new Date(hit.created_at_i * 1000),
        });
      }
    } catch (err) {
      logger.error({ source: 'hn-collector', err }, 'Fetch failed');
    }
  }

  return items;
}
