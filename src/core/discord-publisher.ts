import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import type { AppConfig, CollectedItem } from '../types';
import logger from '../utils/logger';

const SOURCE_STYLES: Record<string, { color: number; emoji: string }> = {
  rss:          { color: 0x5865F2, emoji: '📡' },
  youtube:      { color: 0xFF0000, emoji: '▶️' },
  reddit:       { color: 0xFF4500, emoji: '🤖' },
  hn:           { color: 0xFF6600, emoji: '🔶' },
  producthunt:  { color: 0xDA552F, emoji: '🐱' },
};

const DEFAULT_STYLE = { color: 0x99AAB5, emoji: '📰' };

function resolveSourceType(sourceName: string): string {
  const name = sourceName.toLowerCase();
  if (name === 'hackernews') return 'hn';
  if (name === 'producthunt') return 'producthunt';
  if (name.startsWith('r/')) return 'reddit';
  return 'rss';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function buildArticleEmbed(item: CollectedItem): EmbedBuilder {
  const sourceType = resolveSourceType(item.sourceName);
  const style = SOURCE_STYLES[sourceType] ?? DEFAULT_STYLE;
  const domain = extractDomain(item.url);
  const dateStr = item.publishedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return new EmbedBuilder()
    .setColor(style.color)
    .setAuthor({ name: `${style.emoji}  ${item.sourceName}` })
    .setTitle(item.title.substring(0, 256))
    .setURL(item.url)
    .setDescription(item.description.length > 0 ? item.description : null)
    .setFooter({ text: `${domain}  ·  ${dateStr}` });
}

function buildToolEmbed(item: CollectedItem): EmbedBuilder {
  const style = SOURCE_STYLES['producthunt'];
  const domain = extractDomain(item.url);
  const dateStr = item.publishedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setAuthor({ name: `${style.emoji}  ProductHunt` })
    .setTitle(item.title.substring(0, 256))
    .setURL(item.url)
    .setDescription(item.description.length > 0 ? item.description : null)
    .setFooter({ text: `${domain}  ·  ${dateStr}` });

  if (item.imageUrl) embed.setImage(item.imageUrl);

  return embed;
}

function buildHeaderEmbed(count: number, theme: string): EmbedBuilder {
  const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(`📰  Digest IA — ${theme}`)
    .setDescription(`**${count} article${count > 1 ? 's' : ''}** · ${date}`);
}

const DISCORD_EMBEDS_PER_MESSAGE = 10;

export async function publishDigest(
  items: CollectedItem[],
  config: AppConfig,
  client: Client
): Promise<void> {
  const byTheme = new Map<string, CollectedItem[]>();
  for (const item of items) {
    if (!byTheme.has(item.theme)) byTheme.set(item.theme, []);
    byTheme.get(item.theme)!.push(item);
  }

  for (const [theme, themeItems] of byTheme) {
    if (themeItems.length === 0) continue;

    const themeConfig = config.themes[theme];
    if (!themeConfig) {
      logger.warn({ theme }, 'Theme not found in config, skipping');
      continue;
    }

    const channel = client.channels.cache.get(themeConfig.channel_id) as TextChannel | undefined;

    if (!channel) {
      logger.error({ source: 'discord-publisher', channel_id: themeConfig.channel_id }, 'Channel not found');
      continue;
    }

    try {
      await channel.send({ embeds: [buildHeaderEmbed(themeItems.length, theme)] });

      const isToolTheme = themeItems.some((i) => i.sourceName === 'ProductHunt');

      if (isToolTheme) {
        for (const item of themeItems) {
          await channel.send({ embeds: [buildToolEmbed(item)] });
        }
      } else {
        const articleEmbeds = themeItems.map(buildArticleEmbed);
        for (let i = 0; i < articleEmbeds.length; i += DISCORD_EMBEDS_PER_MESSAGE) {
          await channel.send({ embeds: articleEmbeds.slice(i, i + DISCORD_EMBEDS_PER_MESSAGE) });
        }
      }
    } catch (err) {
      logger.error({ source: 'discord-publisher', channel: themeConfig.channel, err }, 'Publish failed');
    }
  }
}
