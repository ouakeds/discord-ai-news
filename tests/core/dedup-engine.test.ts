import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { CollectedItem } from '../../src/types';

const tmpDb = join(tmpdir(), `dedup-test-${Date.now()}.db`);

function makeItem(title: string, url: string): CollectedItem {
  return { url, title, description: '', sourceName: 'Test', theme: 'general', publishedAt: new Date() };
}

describe('dedup-engine', () => {
  beforeEach(async () => {
    const { initDb } = await import('../../src/core/db');
    initDb(tmpDb);
  });

  afterEach(async () => {
    const { getDb } = await import('../../src/core/db');
    try { getDb().close(); } catch {}
    try { unlinkSync(tmpDb); } catch {}
  });

  describe('isAlreadyPublished / markAsPublished', () => {
    it('returns false for a URL not in the registry', async () => {
      const { isAlreadyPublished } = await import('../../src/core/dedup-engine');
      expect(isAlreadyPublished('https://example.com/new')).toBe(false);
    });

    it('returns true after markAsPublished', async () => {
      const { isAlreadyPublished, markAsPublished } = await import('../../src/core/dedup-engine');
      markAsPublished('https://example.com/published');
      expect(isAlreadyPublished('https://example.com/published')).toBe(true);
    });

    it('returns false for a URL published more than 7 days ago', async () => {
      const db = (await import('../../src/core/db')).getDb();
      const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
      db.prepare('INSERT OR IGNORE INTO published_urls (url, published_at) VALUES (?, ?)').run('https://example.com/old', old);
      const { isAlreadyPublished: check } = await import('../../src/core/dedup-engine');
      expect(check('https://example.com/old')).toBe(false);
    });
  });

  describe('pruneOldEntries', () => {
    it('removes entries older than 7 days and keeps recent ones', async () => {
      const { pruneOldEntries, markAsPublished, isAlreadyPublished } = await import('../../src/core/dedup-engine');
      const db = (await import('../../src/core/db')).getDb();

      markAsPublished('https://example.com/recent');
      const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
      db.prepare('INSERT OR IGNORE INTO published_urls (url, published_at) VALUES (?, ?)').run('https://example.com/old-entry', old);

      pruneOldEntries();

      expect(isAlreadyPublished('https://example.com/recent')).toBe(true);
      const row = db.prepare('SELECT 1 FROM published_urls WHERE url = ?').get('https://example.com/old-entry');
      expect(row).toBeUndefined();
    });
  });

  describe('deduplicateByTitle', () => {
    it('keeps identical titles as one item', async () => {
      const { deduplicateByTitle } = await import('../../src/core/dedup-engine');
      const items = [
        makeItem('OpenAI releases GPT-5', 'https://a.com'),
        makeItem('OpenAI releases GPT-5', 'https://b.com'),
      ];
      const result = deduplicateByTitle(items);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://a.com');
    });

    it('keeps highly similar titles as one item (> 0.85 threshold)', async () => {
      const { deduplicateByTitle } = await import('../../src/core/dedup-engine');
      const items = [
        makeItem('OpenAI releases GPT-5 model today', 'https://a.com'),
        makeItem('OpenAI releases GPT-5 model', 'https://b.com'),
      ];
      const result = deduplicateByTitle(items);
      expect(result).toHaveLength(1);
    });

    it('keeps both items with clearly different titles', async () => {
      const { deduplicateByTitle } = await import('../../src/core/dedup-engine');
      const items = [
        makeItem('OpenAI releases GPT-5', 'https://a.com'),
        makeItem('Anthropic launches Claude 4 with reasoning', 'https://b.com'),
      ];
      const result = deduplicateByTitle(items);
      expect(result).toHaveLength(2);
    });

    it('applies global comparison across themes', async () => {
      const { deduplicateByTitle } = await import('../../src/core/dedup-engine');
      const items = [
        { ...makeItem('Breaking: New AI Model Released', 'https://a.com'), theme: 'openai' },
        { ...makeItem('Breaking: New AI Model Released', 'https://b.com'), theme: 'general' },
      ];
      const result = deduplicateByTitle(items);
      expect(result).toHaveLength(1);
    });
  });
});
