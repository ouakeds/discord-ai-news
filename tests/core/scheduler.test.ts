import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AppConfig } from '../../src/types';

const baseConfig: AppConfig = {
  schedule: { time: '10:30' },
  admin: { alert_channel: 'bot-admin' },
  themes: { general: { channel: 'news-general' } },
  sources: [],
};

describe('scheduler start()', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('schedules a cron job with correct expression from config.schedule.time', async () => {
    const scheduleMock = vi.fn().mockReturnValue({ start: vi.fn() });
    vi.doMock('node-cron', () => ({ default: { schedule: scheduleMock } }));
    vi.doMock('../../src/core/cycle-runner', () => ({ runCycle: vi.fn().mockResolvedValue(5) }));
    vi.doMock('discord.js', () => ({ Client: class {}, TextChannel: class {} }));

    const { start } = await import('../../src/core/scheduler');
    const mockClient = {} as import('discord.js').Client;
    start(baseConfig, mockClient);

    expect(scheduleMock).toHaveBeenCalledWith('30 10 * * *', expect.any(Function));
  });

  it('logs "Scheduler started" on init', async () => {
    vi.doMock('node-cron', () => ({ default: { schedule: vi.fn().mockReturnValue({ start: vi.fn() }) } }));
    vi.doMock('../../src/core/cycle-runner', () => ({ runCycle: vi.fn().mockResolvedValue(5) }));
    vi.doMock('discord.js', () => ({ Client: class {}, TextChannel: class {} }));

    const logger = (await import('../../src/utils/logger')).default;
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

    const { start } = await import('../../src/core/scheduler');
    start(baseConfig, {} as import('discord.js').Client);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'scheduler', time: '10:30' }),
      'Scheduler started'
    );
  });

  it('sends admin alert when cycle publishes 0 items', async () => {
    let cronCallback: (() => Promise<void>) | null = null;
    vi.doMock('node-cron', () => ({
      default: {
        schedule: vi.fn().mockImplementation((_expr: string, cb: () => Promise<void>) => {
          cronCallback = cb;
          return { start: vi.fn() };
        }),
      },
    }));
    vi.doMock('../../src/core/cycle-runner', () => ({ runCycle: vi.fn().mockResolvedValue(0) }));

    const sendMock = vi.fn().mockResolvedValue(undefined);
    const mockChannel = { isTextBased: () => true, name: 'bot-admin', send: sendMock };
    const mockClient = {
      channels: {
        cache: {
          find: (fn: (ch: unknown) => boolean) => fn(mockChannel) ? mockChannel : undefined,
        },
      },
    } as unknown as import('discord.js').Client;

    vi.doMock('discord.js', () => ({ Client: class {}, TextChannel: class {} }));

    const { start } = await import('../../src/core/scheduler');
    start(baseConfig, mockClient);

    await cronCallback!();

    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('⚠️ discord-ai-news alert'));
  });

  it('does not send alert when cycle publishes items', async () => {
    let cronCallback: (() => Promise<void>) | null = null;
    vi.doMock('node-cron', () => ({
      default: {
        schedule: vi.fn().mockImplementation((_expr: string, cb: () => Promise<void>) => {
          cronCallback = cb;
          return { start: vi.fn() };
        }),
      },
    }));
    vi.doMock('../../src/core/cycle-runner', () => ({ runCycle: vi.fn().mockResolvedValue(3) }));

    const sendMock = vi.fn().mockResolvedValue(undefined);
    const mockChannel = { isTextBased: () => true, name: 'bot-admin', send: sendMock };
    const mockClient = {
      channels: { cache: { find: (fn: (ch: unknown) => boolean) => fn(mockChannel) ? mockChannel : undefined } },
    } as unknown as import('discord.js').Client;

    vi.doMock('discord.js', () => ({ Client: class {}, TextChannel: class {} }));

    const { start } = await import('../../src/core/scheduler');
    start(baseConfig, mockClient);
    await cronCallback!();

    expect(sendMock).not.toHaveBeenCalled();
  });
});
