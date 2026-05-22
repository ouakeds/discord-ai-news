import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { Client } from 'discord.js';
import type { AppConfig } from '../types';
import { runCycle } from './cycle-runner';
import logger from '../utils/logger';

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function startTriggerServer(config: AppConfig, client: Client, port: number): Server {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST' || req.url !== '/trigger') {
      sendJson(res, 404, { error: 'Not found. Use POST /trigger' });
      return;
    }

    logger.info({ source: 'trigger-server' }, 'Manual cycle trigger received');

    try {
      const published = await runCycle(config, client);
      sendJson(res, 200, { ok: true, published });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ source: 'trigger-server', err }, 'Manual cycle failed');
      sendJson(res, 500, { ok: false, error: message });
    }
  });

  server.listen(port, '127.0.0.1', () => {
    logger.info({ source: 'trigger-server', port }, 'Trigger server listening on localhost');
  });

  return server;
}
