import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import logger from '../utils/logger';
import type { AppConfig, SourceConfig, ThemeConfig, ScheduleConfig, AdminConfig } from '../types';

function isScheduleConfig(value: unknown): value is ScheduleConfig {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).time === 'string';
}

function isAdminConfig(value: unknown): value is AdminConfig {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).alert_channel_id === 'string';
}

function isSourceConfig(value: unknown): value is SourceConfig {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Record<string, unknown>;
  if (typeof source.type !== 'string') return false;
  switch (source.type) {
    case 'rss':
      return typeof source.url === 'string' && typeof source.name === 'string' && typeof source.theme === 'string';
    case 'youtube':
      return typeof source.channel_id === 'string' && typeof source.name === 'string' && typeof source.theme === 'string';
    case 'reddit':
      return typeof source.subreddit === 'string' && typeof source.name === 'string' && typeof source.theme === 'string';
    case 'hn':
      return Array.isArray(source.keywords) && typeof source.theme === 'string';
    case 'producthunt':
      return typeof source.theme === 'string';
    default:
      return false;
  }
}

function isThemesMap(value: unknown): value is Record<string, ThemeConfig> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === 'object' && entry !== null && typeof (entry as Record<string, unknown>).channel_id === 'string'
  );
}

export function loadConfig(configPath?: string): AppConfig {
  const filePath = configPath ?? join(process.cwd(), 'config.yaml');
  let rawYaml: unknown;
  try {
    rawYaml = yaml.load(readFileSync(filePath, 'utf8'));
  } catch (err) {
    logger.error({ source: 'config-loader', err }, 'Failed to read config.yaml');
    process.exit(1);
  }

  if (typeof rawYaml !== 'object' || rawYaml === null) {
    logger.error({ source: 'config-loader' }, 'config.yaml must be a YAML object');
    process.exit(1);
  }

  const rawConfig = rawYaml as Record<string, unknown>;

  if (!isScheduleConfig(rawConfig.schedule)) {
    logger.error({ source: 'config-loader' }, 'Invalid config: schedule.time is required (string)');
    process.exit(1);
  }

  if (!isAdminConfig(rawConfig.admin)) {
    logger.error({ source: 'config-loader' }, 'Invalid config: admin.alert_channel_id is required (string)');
    process.exit(1);
  }

  if (!isThemesMap(rawConfig.themes)) {
    logger.error({ source: 'config-loader' }, 'Invalid config: themes must be a map of { channel_id: string }');
    process.exit(1);
  }

  if (!Array.isArray(rawConfig.sources)) {
    logger.error({ source: 'config-loader' }, 'Invalid config: sources must be an array');
    process.exit(1);
  }

  const sources: SourceConfig[] = [];
  for (const [index, candidate] of (rawConfig.sources as unknown[]).entries()) {
    if (!isSourceConfig(candidate)) {
      logger.error({ source: 'config-loader', index }, `Invalid config: sources[${index}] has invalid or missing fields`);
      process.exit(1);
    }
    sources.push(candidate);
  }

  const themes = rawConfig.themes as Record<string, ThemeConfig>;
  for (const source of sources) {
    if (source.theme && !(source.theme in themes)) {
      logger.warn({ source: 'config-loader', theme: source.theme }, `Source references unknown theme "${source.theme}" — no Discord channel mapped`);
    }
  }

  return {
    schedule: rawConfig.schedule as ScheduleConfig,
    admin: rawConfig.admin as AdminConfig,
    themes,
    sources,
  };
}
