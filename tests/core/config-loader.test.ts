import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tmpConfig = join(tmpdir(), 'test-config.yaml');

const validYaml = `
schedule:
  time: "10:00"
admin:
  alert_channel: "bot-admin"
themes:
  openai:
    channel: "news-openai"
  general:
    channel: "news-general"
sources:
  - type: rss
    url: "https://example.com/feed.xml"
    name: "Example Blog"
    theme: openai
  - type: youtube
    channel_id: "UC123"
    name: "Test Channel"
    theme: general
  - type: reddit
    subreddit: "MachineLearning"
    name: "r/ML"
    theme: general
    min_score: 50
  - type: hn
    keywords: ["AI"]
    theme: general
  - type: producthunt
    theme: general
`;

describe('loadConfig', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    const logger = (await import('../../src/utils/logger')).default;
    vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
      throw new Error(`process.exit(${code})`);
    }) as unknown as ReturnType<typeof vi.spyOn>;
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try { unlinkSync(tmpConfig); } catch {}
  });

  it('returns a fully typed AppConfig for a valid config', async () => {
    writeFileSync(tmpConfig, validYaml);
    const { loadConfig } = await import('../../src/core/config-loader');
    const cfg = loadConfig(tmpConfig);
    expect(cfg.schedule.time).toBe('10:00');
    expect(cfg.admin.alert_channel).toBe('bot-admin');
    expect(cfg.themes.openai.channel).toBe('news-openai');
    expect(cfg.sources).toHaveLength(5);
    expect(cfg.sources[0]).toMatchObject({ type: 'rss', url: 'https://example.com/feed.xml' });
  });

  it('calls process.exit(1) when schedule.time is missing', async () => {
    writeFileSync(tmpConfig, `
admin:
  alert_channel: "bot-admin"
themes:
  openai:
    channel: "news-openai"
sources: []
`);
    const { loadConfig } = await import('../../src/core/config-loader');
    expect(() => loadConfig(tmpConfig)).toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('calls process.exit(1) when admin.alert_channel is missing', async () => {
    writeFileSync(tmpConfig, `
schedule:
  time: "10:00"
themes:
  openai:
    channel: "news-openai"
sources: []
`);
    const { loadConfig } = await import('../../src/core/config-loader');
    expect(() => loadConfig(tmpConfig)).toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('calls process.exit(1) when themes is missing', async () => {
    writeFileSync(tmpConfig, `
schedule:
  time: "10:00"
admin:
  alert_channel: "bot-admin"
sources: []
`);
    const { loadConfig } = await import('../../src/core/config-loader');
    expect(() => loadConfig(tmpConfig)).toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('calls process.exit(1) when sources is not an array', async () => {
    writeFileSync(tmpConfig, `
schedule:
  time: "10:00"
admin:
  alert_channel: "bot-admin"
themes:
  openai:
    channel: "news-openai"
sources: "not-an-array"
`);
    const { loadConfig } = await import('../../src/core/config-loader');
    expect(() => loadConfig(tmpConfig)).toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('emits a WARN when a source references an unknown theme', async () => {
    writeFileSync(tmpConfig, `
schedule:
  time: "10:00"
admin:
  alert_channel: "bot-admin"
themes:
  openai:
    channel: "news-openai"
sources:
  - type: rss
    url: "https://example.com/feed.xml"
    name: "Test"
    theme: unknown-theme
`);
    const { loadConfig } = await import('../../src/core/config-loader');
    loadConfig(tmpConfig);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'unknown-theme' }),
      expect.stringContaining('unknown theme')
    );
  });

  it('calls process.exit(1) when config file does not exist', async () => {
    const { loadConfig } = await import('../../src/core/config-loader');
    expect(() => loadConfig('/nonexistent/path/config.yaml')).toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalled();
  });
});
