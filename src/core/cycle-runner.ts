import { Client } from 'discord.js';
import type { AppConfig } from '../types';
import { getDb } from './db';
import { pruneOldEntries, isAlreadyPublished, markAsPublished, deduplicateByTitle } from './dedup-engine';
import { collect as collectRss } from '../collectors/rss-collector';
import { collect as collectYt } from '../collectors/youtube-collector';
import { collect as collectReddit } from '../collectors/reddit-collector';
import { collect as collectHn } from '../collectors/hn-collector';
import { collect as collectPh } from '../collectors/producthunt-collector';
import { publishDigest } from './discord-publisher';
import { enrich } from './enricher';
import logger from '../utils/logger';

interface CycleLock {
  running: number;
}

export async function runCycle(config: AppConfig, client: Client): Promise<number> {
  const db = getDb();

  const lock = db.prepare('SELECT running FROM cycle_lock WHERE id = 1').get() as CycleLock | undefined;
  if (lock?.running === 1) {
    logger.warn({ source: 'cycle-runner' }, 'Cycle already running, skipping');
    return 0;
  }

  db.prepare('UPDATE cycle_lock SET running = 1, started_at = ? WHERE id = 1').run(Date.now());

  try {
    pruneOldEntries();

    const allItems = [
      ...await collectRss(config.sources),
      ...await collectYt(config.sources),
      ...await collectReddit(config.sources),
      ...await collectHn(config.sources),
      ...await collectPh(config.sources),
    ];

    const dedupedByTitle = deduplicateByTitle(allItems);
    const newItems = dedupedByTitle.filter((item) => !isAlreadyPublished(item.url));

    logger.info({ source: 'cycle-runner', collected: allItems.length, new: newItems.length }, 'Cycle items');

    const enrichedItems = await enrich(newItems);
    await publishDigest(enrichedItems, config, client);

    for (const item of newItems) {
      markAsPublished(item.url);
    }

    return newItems.length;
  } finally {
    db.prepare('UPDATE cycle_lock SET running = 0, started_at = NULL WHERE id = 1').run();
  }
}
