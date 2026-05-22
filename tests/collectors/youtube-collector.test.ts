import { describe, it, expect, vi, afterEach } from 'vitest';

const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const oldDate = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

describe('youtube-collector collect()', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns recent items with correct fields', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() {
          return {
            items: [
              { link: 'https://youtube.com/watch?v=abc', title: 'New Video', contentSnippet: 'desc', pubDate: recentDate },
              { link: 'https://youtube.com/watch?v=old', title: 'Old Video', contentSnippet: 'old desc', pubDate: oldDate },
            ],
          };
        }
      },
    }));
    const { collect } = await import('../../src/collectors/youtube-collector');
    const items = await collect([{ type: 'youtube', channel_id: 'UC123', name: 'Test Channel', theme: 'youtube' }]);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://youtube.com/watch?v=abc');
    expect(items[0].sourceName).toBe('Test Channel');
    expect(items[0].publishedAt).toBeInstanceOf(Date);
  });

  it('builds feed URL with channel_id', async () => {
    const parsedUrls: string[] = [];
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL(url: string) {
          parsedUrls.push(url);
          return { items: [] };
        }
      },
    }));
    const { collect } = await import('../../src/collectors/youtube-collector');
    await collect([{ type: 'youtube', channel_id: 'UC_TEST_123', name: 'Chan', theme: 'youtube' }]);
    expect(parsedUrls[0]).toContain('UC_TEST_123');
  });

  it('returns [] and logs ERROR on fetch failure', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { throw new Error('Network error'); }
      },
    }));
    const logger = (await import('../../src/utils/logger')).default;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { collect } = await import('../../src/collectors/youtube-collector');
    const items = await collect([{ type: 'youtube', channel_id: 'UC_FAIL', name: 'Fail', theme: 'youtube' }]);
    expect(items).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'youtube-collector', channel_id: 'UC_FAIL' }),
      'Fetch failed'
    );
    vi.restoreAllMocks();
  });

  it('ignores non-youtube sources', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { return { items: [] }; }
      },
    }));
    const { collect } = await import('../../src/collectors/youtube-collector');
    const items = await collect([{ type: 'rss', url: 'https://example.com/feed', name: 'RSS', theme: 'general' }]);
    expect(items).toEqual([]);
  });
});
