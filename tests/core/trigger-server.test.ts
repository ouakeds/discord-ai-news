import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Server } from 'http';
import type { AppConfig } from '../../src/types';

const baseConfig: AppConfig = {
  schedule: { time: '10:00' },
  admin: { alert_channel: 'bot-admin' },
  themes: { general: { channel: 'news-general' } },
  sources: [],
};

const mockClient = {} as import('discord.js').Client;

function startOnRandomPort(startTriggerServer: (c: AppConfig, cl: typeof mockClient, p: number) => Server): Promise<{ port: number; server: Server }> {
  return new Promise((resolve) => {
    const server = startTriggerServer(baseConfig, mockClient, 0);
    server.once('listening', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ port, server });
    });
  });
}

async function postTrigger(port: number): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${port}/trigger`, { method: 'POST' });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('startTriggerServer', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('POST /trigger returns 200 and published count on success', async () => {
    vi.doMock('../../src/core/cycle-runner', () => ({ runCycle: vi.fn().mockResolvedValue(3) }));
    const { startTriggerServer } = await import('../../src/core/trigger-server');

    const { port, server } = await startOnRandomPort(startTriggerServer);
    try {
      const { status, body } = await postTrigger(port);
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.published).toBe(3);
    } finally {
      await closeServer(server);
    }
  });

  it('returns 404 for non-trigger routes', async () => {
    vi.doMock('../../src/core/cycle-runner', () => ({ runCycle: vi.fn().mockResolvedValue(0) }));
    const { startTriggerServer } = await import('../../src/core/trigger-server');

    const { port, server } = await startOnRandomPort(startTriggerServer);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/unknown`, { method: 'GET' });
      expect(res.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });

  it('returns 500 when runCycle throws', async () => {
    vi.doMock('../../src/core/cycle-runner', () => ({
      runCycle: vi.fn().mockRejectedValue(new Error('Cycle exploded')),
    }));
    const { startTriggerServer } = await import('../../src/core/trigger-server');

    const { port, server } = await startOnRandomPort(startTriggerServer);
    try {
      const { status, body } = await postTrigger(port);
      expect(status).toBe(500);
      expect(body.ok).toBe(false);
      expect((body.error as string)).toContain('Cycle exploded');
    } finally {
      await closeServer(server);
    }
  });
});
