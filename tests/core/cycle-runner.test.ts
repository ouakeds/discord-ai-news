import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AppConfig } from '../../src/types';

const tmpDb = join(tmpdir(), `cycle-runner-test-${Date.now()}.db`);

const baseConfig: AppConfig = {
  schedule: { time: '10:00' },
  admin: { alert_channel: 'bot-admin' },
  themes: { general: { channel: 'news-general' } },
  sources: [],
};

const mockClient = {} as import('discord.js').Client;

describe('runCycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { initDb } = await import('../../src/core/db');
    initDb(tmpDb);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const { getDb } = await import('../../src/core/db');
    try { getDb().close(); } catch {}
    try { unlinkSync(tmpDb); } catch {}
  });

  it('executes the full pipeline and returns item count', async () => {
    vi.doMock('../../src/collectors/rss-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/youtube-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/reddit-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/hn-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/producthunt-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/core/discord-publisher', () => ({ publishDigest: vi.fn().mockResolvedValue(undefined) }));

    const { runCycle } = await import('../../src/core/cycle-runner');
    const count = await runCycle(baseConfig, mockClient);
    expect(count).toBe(0);
  });

  it('skips and returns 0 when lock is already running', async () => {
    const { getDb } = await import('../../src/core/db');
    getDb().prepare('UPDATE cycle_lock SET running = 1 WHERE id = 1').run();

    const logger = (await import('../../src/utils/logger')).default;
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    vi.doMock('../../src/collectors/rss-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/youtube-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/reddit-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/hn-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/producthunt-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/core/discord-publisher', () => ({ publishDigest: vi.fn().mockResolvedValue(undefined) }));

    const { runCycle } = await import('../../src/core/cycle-runner');
    const count = await runCycle(baseConfig, mockClient);
    expect(count).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'cycle-runner' }),
      'Cycle already running, skipping'
    );
  });

  it('always releases lock in finally block, even on error', async () => {
    vi.doMock('../../src/collectors/rss-collector', () => ({
      collect: vi.fn().mockRejectedValue(new Error('Collector crashed')),
    }));
    vi.doMock('../../src/collectors/youtube-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/reddit-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/hn-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/collectors/producthunt-collector', () => ({ collect: vi.fn().mockResolvedValue([]) }));
    vi.doMock('../../src/core/discord-publisher', () => ({ publishDigest: vi.fn().mockResolvedValue(undefined) }));

    const { runCycle } = await import('../../src/core/cycle-runner');
    const { getDb } = await import('../../src/core/db');

    await expect(runCycle(baseConfig, mockClient)).rejects.toThrow('Collector crashed');

    const lock = getDb().prepare('SELECT running FROM cycle_lock WHERE id = 1').get() as { running: number };
    expect(lock.running).toBe(0);
  });

  it('calls all 5 collectors sequentially', async () => {
    const order: string[] = [];
    vi.doMock('../../src/collectors/rss-collector', () => ({ collect: vi.fn().mockImplementation(async () => { order.push('rss'); return []; }) }));
    vi.doMock('../../src/collectors/youtube-collector', () => ({ collect: vi.fn().mockImplementation(async () => { order.push('yt'); return []; }) }));
    vi.doMock('../../src/collectors/reddit-collector', () => ({ collect: vi.fn().mockImplementation(async () => { order.push('reddit'); return []; }) }));
    vi.doMock('../../src/collectors/hn-collector', () => ({ collect: vi.fn().mockImplementation(async () => { order.push('hn'); return []; }) }));
    vi.doMock('../../src/collectors/producthunt-collector', () => ({ collect: vi.fn().mockImplementation(async () => { order.push('ph'); return []; }) }));
    vi.doMock('../../src/core/discord-publisher', () => ({ publishDigest: vi.fn().mockResolvedValue(undefined) }));

    const { runCycle } = await import('../../src/core/cycle-runner');
    await runCycle(baseConfig, mockClient);
    expect(order).toEqual(['rss', 'yt', 'reddit', 'hn', 'ph']);
  });
});
