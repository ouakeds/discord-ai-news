import { describe, it, expect, vi, afterEach } from 'vitest';

describe('logger', () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.NODE_ENV;
  });

  it('exports a default logger instance with info/error/warn methods', async () => {
    const { default: logger } = await import('../../src/utils/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('creates logger with pino-pretty transport in development', async () => {
    process.env.NODE_ENV = 'development';
    const pinoMock = vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }));
    vi.doMock('pino', () => ({ default: pinoMock }));
    await import('../../src/utils/logger');
    const call = pinoMock.mock.calls[0]?.[0];
    expect(call?.transport?.target).toBe('pino-pretty');
  });

  it('creates logger without pino-pretty transport in production', async () => {
    process.env.NODE_ENV = 'production';
    const pinoMock = vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }));
    vi.doMock('pino', () => ({ default: pinoMock }));
    await import('../../src/utils/logger');
    const call = pinoMock.mock.calls[0]?.[0];
    expect(call?.transport).toBeUndefined();
  });
});
