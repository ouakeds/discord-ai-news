import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import type { AppConfig, CollectedItem } from '../types';
import { registerArticleUrl } from './button-store';
import logger from '../utils/logger';

// ─── Theme config ─────────────────────────────────────────────────────────────

const THEME_META: Record<string, { color: number; label: string; banner: string }> = {
  openai:      { color: 0x10A37F, label: 'OpenAI',    banner: '🤖' },
  anthropic:   { color: 0xC7692A, label: 'Anthropic', banner: '🧠' },
  'google-ai': { color: 0x4285F4, label: 'Google AI', banner: '🔍' },
  youtube:     { color: 0xFF0000, label: 'YouTube',   banner: '▶️' },
  outils:      { color: 0xDA552F, label: 'Outils',    banner: '🛠️' },
  general:     { color: 0x5865F2, label: 'Général',   banner: '🌐' },
};
const DEFAULT_META = { color: 0x99AAB5, label: 'News', banner: '📰' };

const SOURCE_EMOJI: Record<string, string> = {
  rss:         '📡',
  youtube:     '▶️',
  reddit:      '💬',
  hn:          '🔶',
  producthunt: '🐱',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveSourceType(sourceName: string): string {
  const n = sourceName.toLowerCase();
  if (n === 'hackernews') return 'hn';
  if (n === 'producthunt') return 'producthunt';
  if (n.startsWith('r/')) return 'reddit';
  return 'rss';
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Header & Footer embeds ───────────────────────────────────────────────────

const DIVIDER = '▬'.repeat(28);

function buildHeaderEmbed(count: number, theme: string): EmbedBuilder {
  const meta = THEME_META[theme] ?? DEFAULT_META;
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return new EmbedBuilder()
    .setColor(meta.color)
    .setDescription(
      [
        DIVIDER,
        ``,
        `# 📬  Livraison des news du jour !`,
        ``,
        `${meta.banner}  **${meta.label}**`,
        `🗓️  ${today}  ·  🕙  ${time}`,
        `📰  **${count} article${count > 1 ? 's' : ''}** sélectionné${count > 1 ? 's' : ''} aujourd'hui`,
        ``,
        DIVIDER,
      ].join('\n')
    );
}

const FUN_CLOSING = `⚡ C'est fini pour les turbo news, à demain même heure !`;

function buildFooterEmbed(count: number, theme: string): EmbedBuilder {
  const meta = THEME_META[theme] ?? DEFAULT_META;
  const closing = FUN_CLOSING;

  return new EmbedBuilder()
    .setColor(meta.color)
    .setDescription(
      [
        DIVIDER,
        ``,
        `✅  **Fin du digest ${meta.banner} ${meta.label}**`,
        `*${count} article${count > 1 ? 's' : ''} lu${count > 1 ? 's' : ''} · Prochain digest demain à la même heure*`,
        ``,
        `> ${closing}`,
        ``,
        DIVIDER,
      ].join('\n')
    );
}

// ─── Article embed + button ───────────────────────────────────────────────────

function buildArticlePayload(item: CollectedItem, color: number) {
  const sourceType = resolveSourceType(item.sourceName);
  const emoji = SOURCE_EMOJI[sourceType] ?? '📰';
  const domain = extractDomain(item.url);
  const title = (item.titleFr ?? item.title).substring(0, 256);
  const desc = (item.descriptionFr ?? item.description).substring(0, 350);

  const bodyLines = [
    `## [${title}](${item.url})`,
    desc.length > 0 ? `*${desc}*` : '',
  ].filter(Boolean).join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `${emoji}  ${item.sourceName}` })
    .setDescription(bodyLines)
    .setFooter({ text: `${domain}  ·  ${formatDate(item.publishedAt)}` });

  if (item.imageUrl) embed.setImage(item.imageUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(registerArticleUrl(item.url))
      .setLabel('Lire la news')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// ─── ProductHunt tool payload ─────────────────────────────────────────────────

function buildToolPayload(item: CollectedItem, color: number) {
  const title = (item.titleFr ?? item.title).substring(0, 256);
  const desc = (item.descriptionFr ?? item.description).substring(0, 350);
  const domain = extractDomain(item.url);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `🐱  ProductHunt` })
    .setTitle(title)
    .setFooter({ text: `${domain}  ·  ${formatDate(item.publishedAt)}` });

  if (desc.length > 0) embed.setDescription(`*${desc}*`);
  if (item.imageUrl)   embed.setImage(item.imageUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(registerArticleUrl(item.url))
      .setLabel('Lire la news')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// ─── Main export ──────────────────────────────────────────────────────────────

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

    const meta = THEME_META[theme] ?? DEFAULT_META;
    const channel = client.channels.cache.get(themeConfig.channel_id) as TextChannel | undefined;
    if (!channel) {
      logger.error({ source: 'discord-publisher', channel_id: themeConfig.channel_id }, 'Channel not found');
      continue;
    }

    try {
      await channel.send({ embeds: [buildHeaderEmbed(themeItems.length, theme)] });

      const isToolTheme = themeItems.some((i) => i.sourceName === 'ProductHunt');
      const payloads = isToolTheme
        ? themeItems.map((i) => buildToolPayload(i, meta.color))
        : themeItems.map((i) => buildArticlePayload(i, meta.color));

      for (const payload of payloads) {
        await channel.send(payload);
      }

      await channel.send({ embeds: [buildFooterEmbed(themeItems.length, theme)] });
    } catch (err) {
      logger.error({ source: 'discord-publisher', channel_id: themeConfig.channel_id, err }, 'Publish failed');
    }
  }
}
