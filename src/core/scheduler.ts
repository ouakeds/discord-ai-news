import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import type { AppConfig } from '../types';
import { runCycle } from './cycle-runner';
import logger from '../utils/logger';

export function start(config: AppConfig, client: Client): void {
  const [hour, minute] = config.schedule.time.split(':');
  const expression = `${minute} ${hour} * * *`;

  cron.schedule(expression, async () => {
    logger.info({ source: 'scheduler' }, 'Cycle starting');
    try {
      const published = await runCycle(config, client);
      if (published === 0) {
        await sendAdminAlert(client, config, 'Cycle completed with 0 publications — all items deduplicated or no new items.');
      }
    } catch (err) {
      logger.error({ source: 'scheduler', err }, 'Unhandled cycle error');
      await sendAdminAlert(client, config, `Cycle failed: ${(err as Error).message}`).catch(() => {});
    }
  });

  logger.info({ source: 'scheduler', time: config.schedule.time }, 'Scheduler started');
}

async function sendAdminAlert(client: Client, config: AppConfig, reason: string): Promise<void> {
  const channel = client.channels.cache.get(config.admin.alert_channel_id) as TextChannel | undefined;

  if (!channel) {
    logger.error({ source: 'scheduler', channel_id: config.admin.alert_channel_id }, 'Admin alert channel not found');
    return;
  }

  await channel.send(`⚠️ discord-ai-news alert: ${reason}`);
}
