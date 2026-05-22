import { describe, it, expect, vi, afterEach } from 'vitest';

const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const oldDate = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

describe('producthunt-collector collect()', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns recent items with sourceName=ProductHunt', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() {
          return {
            items: [
              { link: 'https://producthunt.com/p/ai-tool', title: 'AI Tool', contentSnippet: 'Great AI tool', pubDate: recentDate },
              { link: 'https://producthunt.com/p/old-tool', title: 'Old Tool', contentSnippet: 'Old tool', pubDate: oldDate },
            ],
          };
        }
      },
    }));
    const { collect } = await import('../../src/collectors/producthunt-collector');
    const items = await collect([{ type: 'producthunt', theme: 'outils' }]);
    expect(items).toHaveLength(1);
    expect(items[0].sourceName).toBe('ProductHunt');
    expect(items[0].theme).toBe('outils');
    expect(items[0].url).toBe('https://producthunt.com/p/ai-tool');
  });

  it('returns [] when no producthunt sources provided', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { return { items: [] }; }
      },
    }));
    const { collect } = await import('../../src/collectors/producthunt-collector');
    const items = await collect([{ type: 'rss', url: 'https://example.com/feed', name: 'RSS', theme: 'general' }]);
    expect(items).toEqual([]);
  });

  it('returns [] and logs ERROR on fetch failure', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() { throw new Error('Network error'); }
      },
    }));
    const logger = (await import('../../src/utils/logger')).default;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { collect } = await import('../../src/collectors/producthunt-collector');
    const items = await collect([{ type: 'producthunt', theme: 'outils' }]);
    expect(items).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'producthunt-collector' }),
      'Fetch failed'
    );
  });

  it('truncates description to 300 chars', async () => {
    vi.doMock('rss-parser', () => ({
      default: class {
        async parseURL() {
          return {
            items: [{ link: 'https://ph.com/tool', title: 'Tool', contentSnippet: 'B'.repeat(500), pubDate: recentDate }],
          };
        }
      },
    }));
    const { collect } = await import('../../src/collectors/producthunt-collector');
    const items = await collect([{ type: 'producthunt', theme: 'outils' }]);
    expect(items[0].description.length).toBeLessThanOrEqual(300);
  });
});
