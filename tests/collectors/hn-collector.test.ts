import { describe, it, expect, vi, afterEach } from 'vitest';

const recentSec = Math.floor(Date.now() / 1000) - 3600;

describe('hn-collector collect()', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns items with correct fields from Algolia response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [
          { objectID: '1', url: 'https://example.com/ai', title: 'AI Story', story_text: 'Some text', created_at_i: recentSec },
          { objectID: '2', url: null, title: 'Self Post', story_text: 'Self text', created_at_i: recentSec },
        ],
      }),
    }));
    const { collect } = await import('../../src/collectors/hn-collector');
    const items = await collect([{ type: 'hn', keywords: ['AI', 'LLM'], min_score: 100, theme: 'general' }]);
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe('https://example.com/ai');
    expect(items[1].url).toBe('https://news.ycombinator.com/item?id=2');
    expect(items[0].sourceName).toBe('HackerNews');
    expect(items[0].publishedAt).toBeInstanceOf(Date);
  });

  it('builds URL with encoded keywords and min_score', async () => {
    const fetchedUrls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      fetchedUrls.push(url);
      return Promise.resolve({ ok: true, json: async () => ({ hits: [] }) });
    }));
    const { collect } = await import('../../src/collectors/hn-collector');
    await collect([{ type: 'hn', keywords: ['machine learning'], min_score: 50, theme: 'general' }]);
    expect(fetchedUrls[0]).toContain('machine%20learning');
    expect(fetchedUrls[0]).toContain('points>=50');
  });

  it('uses default min_score 100 when not set', async () => {
    const fetchedUrls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      fetchedUrls.push(url);
      return Promise.resolve({ ok: true, json: async () => ({ hits: [] }) });
    }));
    const { collect } = await import('../../src/collectors/hn-collector');
    await collect([{ type: 'hn', keywords: ['AI'], theme: 'general' }]);
    expect(fetchedUrls[0]).toContain('points>=100');
  });

  it('returns [] and logs ERROR on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const logger = (await import('../../src/utils/logger')).default;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { collect } = await import('../../src/collectors/hn-collector');
    const items = await collect([{ type: 'hn', keywords: ['AI'], theme: 'general' }]);
    expect(items).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'hn-collector' }),
      'Fetch failed'
    );
  });
});
