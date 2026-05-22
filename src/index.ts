import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './core/config-loader';
import { initDb } from './core/db';
import { start as startScheduler } from './core/scheduler';
import { startTriggerServer } from './core/trigger-server';
import { resolveArticleUrl } from './core/button-store';
import logger from './utils/logger';

const TRIGGER_PORT = parseInt(process.env.TRIGGER_PORT ?? '3000', 10);

async function main(): Promise<void> {
  const config = loadConfig();
  initDb();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const url = resolveArticleUrl(interaction.customId);
    if (!url) return;
    await interaction.reply({ content: url, ephemeral: true });
  });

  startScheduler(config, client);
  startTriggerServer(config, client, TRIGGER_PORT);
  logger.info({ source: 'index', time: config.schedule.time }, 'Bot initialized, scheduler started');
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
  process.exit(1);
});
