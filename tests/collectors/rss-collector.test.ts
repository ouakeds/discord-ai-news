import { describe, it, expect, vi, afterEach } from 'vitest';

const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

const mockFeed = {
  items: [
    { link: 'https://example.com/recent-post', title: 'Recent Post', contentSnippet: 'A short description', pubDate: recentDate },
    { link: 'https://example.com/old-post', title: 'Old Post', contentSnippet: 'An old description', pubDate: oldDate },
  ],
};

const mockFeedLongDesc = {
  items: [
    { link: 'https://example.com/long', title: 'Long Description Post', contentSnippet: 'A'.repeat(500), pubDate: recentDate },
  ],
};

describe('rss-collector collect()', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns only items within the last 24h with correct fields', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { return mockFeed; }
      },
    }));
    const { collect } = await import('../../src/collectors/rss-collector');
    const sources = [{ type: 'rss' as const, url: 'https://example.com/feed', name: 'Example', theme: 'general' }];
    const items = await collect(sources);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://example.com/recent-post');
    expect(items[0].sourceName).toBe('Example');
    expect(items[0].theme).toBe('general');
    expect(items[0].publishedAt).toBeInstanceOf(Date);
  });

  it('filters out items older than 24h', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { return mockFeed; }
      },
    }));
    const { collect } = await import('../../src/collectors/rss-collector');
    const sources = [{ type: 'rss' as const, url: 'https://example.com/feed', name: 'Example', theme: 'general' }];
    const items = await collect(sources);
    expect(items.every(i => i.url !== 'https://example.com/old-post')).toBe(true);
  });

  it('truncates description to 300 chars', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { return mockFeedLongDesc; }
      },
    }));
    const { collect } = await import('../../src/collectors/rss-collector');
    const sources = [{ type: 'rss' as const, url: 'https://example.com/feed', name: 'Example', theme: 'general' }];
    const items = await collect(sources);
    expect(items[0].description.length).toBeLessThanOrEqual(300);
  });

  it('returns [] and logs ERROR when URL is unreachable', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { throw new Error('Network error'); }
      },
    }));
    const logger = (await import('../../src/utils/logger')).default;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { collect } = await import('../../src/collectors/rss-collector');
    const sources = [{ type: 'rss' as const, url: 'https://unreachable.example.com/feed', name: 'Fail', theme: 'general' }];
    const items = await collect(sources);
    expect(items).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'rss-collector', url: 'https://unreachable.example.com/feed' }),
      'Fetch failed'
    );
    vi.restoreAllMocks();
  });

  it('ignores non-rss sources', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { return mockFeed; }
      },
    }));
    const { collect } = await import('../../src/collectors/rss-collector');
    const sources = [
      { type: 'youtube' as const, channel_id: 'UC123', name: 'YT', theme: 'general' },
      { type: 'reddit' as const, subreddit: 'ml', name: 'ML', theme: 'general' },
    ];
    const items = await collect(sources);
    expect(items).toEqual([]);
  });
});
