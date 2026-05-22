import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AppConfig, CollectedItem } from '../../src/types';

function makeItem(theme: string, title: string, url: string): CollectedItem {
  return {
    url,
    title,
    description: 'Test description',
    sourceName: 'TestSource',
    theme,
    publishedAt: new Date('2026-01-15'),
  };
}

const baseConfig: AppConfig = {
  schedule: { time: '10:00' },
  admin: { alert_channel: 'bot-admin' },
  themes: {
    openai: { channel: 'news-openai' },
    general: { channel: 'news-general' },
  },
  sources: [],
};

function makeClient(channelMap: Record<string, { name: string; send: ReturnType<typeof vi.fn>; isTextBased: () => boolean }>) {
  const channels = Object.values(channelMap);
  return {
    channels: {
      cache: {
        find: (fn: (ch: unknown) => boolean) => channels.find(fn as (ch: unknown) => boolean),
      },
    },
  };
}

function makeEmbedBuilderClass(setTitleSpy?: ReturnType<typeof vi.fn>) {
  return class {
    setColor() { return this; }
    setAuthor() { return this; }
    setTitle(t: string) { setTitleSpy?.(t); return this; }
    setURL() { return this; }
    setDescription() { return this; }
    setFooter() { return this; }
  };
}

describe('publishDigest', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('routes items to the correct channel by theme', async () => {
    const openaiSend = vi.fn().mockResolvedValue(undefined);
    const generalSend = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({
      openai: { name: 'news-openai', send: openaiSend, isTextBased: () => true },
      general: { name: 'news-general', send: generalSend, isTextBased: () => true },
    });

    vi.doMock('discord.js', () => ({
      EmbedBuilder: makeEmbedBuilderClass(),
      TextChannel: class {},
      Client: class {},
    }));

    const { publishDigest } = await import('../../src/core/discord-publisher');
    await publishDigest([
      makeItem('openai', 'GPT-5 released', 'https://openai.com'),
      makeItem('general', 'General AI news', 'https://example.com'),
    ], baseConfig, client as unknown as import('discord.js').Client);

    expect(openaiSend).toHaveBeenCalled();
    expect(generalSend).toHaveBeenCalled();
  });

  it('sends header embed then article embeds in batches', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({
      openai: { name: 'news-openai', send: sendMock, isTextBased: () => true },
    });

    vi.doMock('discord.js', () => ({
      EmbedBuilder: makeEmbedBuilderClass(),
      TextChannel: class {},
      Client: class {},
    }));

    const { publishDigest } = await import('../../src/core/discord-publisher');
    await publishDigest([
      makeItem('openai', 'Article 1', 'https://openai.com/1'),
      makeItem('openai', 'Article 2', 'https://openai.com/2'),
    ], baseConfig, client as unknown as import('discord.js').Client);

    // 2 send calls: 1 header embed + 1 batch with 2 article embeds
    expect(sendMock).toHaveBeenCalledTimes(2);
    const [headerCall, articlesCall] = sendMock.mock.calls;
    expect(headerCall[0]).toHaveProperty('embeds');
    expect(articlesCall[0].embeds).toHaveLength(2);
  });

  it('does not post to channel when items list is empty', async () => {
    const openaiSend = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({
      openai: { name: 'news-openai', send: openaiSend, isTextBased: () => true },
    });

    vi.doMock('discord.js', () => ({
      EmbedBuilder: makeEmbedBuilderClass(),
      TextChannel: class {},
      Client: class {},
    }));

    const { publishDigest } = await import('../../src/core/discord-publisher');
    await publishDigest([], baseConfig, client as unknown as import('discord.js').Client);

    expect(openaiSend).not.toHaveBeenCalled();
  });

  it('emits WARN and skips items with unknown theme', async () => {
    vi.doMock('discord.js', () => ({
      EmbedBuilder: makeEmbedBuilderClass(),
      TextChannel: class {},
      Client: class {},
    }));

    const logger = (await import('../../src/utils/logger')).default;
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const client = makeClient({});
    const { publishDigest } = await import('../../src/core/discord-publisher');
    await publishDigest([makeItem('unknown-theme', 'Some post', 'https://example.com')], baseConfig, client as unknown as import('discord.js').Client);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'unknown-theme' }),
      expect.stringContaining('Theme not found')
    );
  });

  it('truncates embed title to 256 chars', async () => {
    const setTitleSpy = vi.fn().mockReturnThis();
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({
      openai: { name: 'news-openai', send: sendMock, isTextBased: () => true },
    });

    vi.doMock('discord.js', () => ({
      EmbedBuilder: makeEmbedBuilderClass(setTitleSpy),
      TextChannel: class {},
      Client: class {},
    }));

    const { publishDigest } = await import('../../src/core/discord-publisher');
    await publishDigest([makeItem('openai', 'A'.repeat(300), 'https://openai.com')], baseConfig, client as unknown as import('discord.js').Client);

    const articleTitleCall = setTitleSpy.mock.calls.find((args) => (args[0] as string).startsWith('A'));
    expect((articleTitleCall![0] as string).length).toBeLessThanOrEqual(256);
  });

  it('splits more than 10 articles into multiple send calls', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({
      openai: { name: 'news-openai', send: sendMock, isTextBased: () => true },
    });

    vi.doMock('discord.js', () => ({
      EmbedBuilder: makeEmbedBuilderClass(),
      TextChannel: class {},
      Client: class {},
    }));

    const { publishDigest } = await import('../../src/core/discord-publisher');
    const items = Array.from({ length: 12 }, (_, i) =>
      makeItem('openai', `Article ${i}`, `https://openai.com/${i}`)
    );
    await publishDigest(items, baseConfig, client as unknown as import('discord.js').Client);

    // 1 header + 2 batches (10 + 2)
    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(sendMock.mock.calls[1][0].embeds).toHaveLength(10);
    expect(sendMock.mock.calls[2][0].embeds).toHaveLength(2);
  });
});
