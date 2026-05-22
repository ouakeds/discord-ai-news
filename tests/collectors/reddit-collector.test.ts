import { describe, it, expect, vi, afterEach } from 'vitest';

const nowSec = Math.floor(Date.now() / 1000);
const recentSec = nowSec - 3600;
const oldSec = nowSec - 48 * 3600;

const mockResponse = (posts: object[]) => ({
  ok: true,
  json: async () => ({
    data: {
      children: posts.map((p) => ({ data: p })),
    },
  }),
});

describe('reddit-collector collect()', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns posts within 24h and above min_score', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse([
      { title: 'Good Post', url: 'https://example.com', selftext: '', score: 75, created_utc: recentSec, permalink: '/r/ml/good' },
      { title: 'Low Score', url: 'https://example.com/2', selftext: '', score: 10, created_utc: recentSec, permalink: '/r/ml/low' },
      { title: 'Old Post', url: 'https://example.com/3', selftext: '', score: 100, created_utc: oldSec, permalink: '/r/ml/old' },
    ])));
    const { collect } = await import('../../src/collectors/reddit-collector');
    const items = await collect([{ type: 'reddit', subreddit: 'MachineLearning', name: 'r/ML', theme: 'general', min_score: 50 }]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Good Post');
    expect(items[0].url).toBe('https://www.reddit.com/r/ml/good');
  });

  it('uses default min_score of 50 when not set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse([
      { title: 'Post A', selftext: '', score: 60, created_utc: recentSec, permalink: '/r/ml/a' },
      { title: 'Post B', selftext: '', score: 40, created_utc: recentSec, permalink: '/r/ml/b' },
    ])));
    const { collect } = await import('../../src/collectors/reddit-collector');
    const items = await collect([{ type: 'reddit', subreddit: 'ml', name: 'r/ML', theme: 'general' }]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Post A');
  });

  it('returns [] and logs ERROR on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    const logger = (await import('../../src/utils/logger')).default;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const { collect } = await import('../../src/collectors/reddit-collector');
    const items = await collect([{ type: 'reddit', subreddit: 'fail', name: 'Fail', theme: 'general' }]);
    expect(items).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'reddit-collector', subreddit: 'fail' }),
      'Fetch failed'
    );
  });

  it('truncates description to 300 chars', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse([
      { title: 'Post', selftext: 'A'.repeat(500), score: 100, created_utc: recentSec, permalink: '/r/ml/long' },
    ])));
    const { collect } = await import('../../src/collectors/reddit-collector');
    const items = await collect([{ type: 'reddit', subreddit: 'ml', name: 'r/ML', theme: 'general' }]);
    expect(items[0].description.length).toBeLessThanOrEqual(300);
  });
});
