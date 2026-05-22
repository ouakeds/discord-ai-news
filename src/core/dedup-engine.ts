import stringSimilarity from 'string-similarity';
import type { CollectedItem } from '../types';
import { getDb } from './db';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TITLE_SIMILARITY_THRESHOLD = 0.85;

export function isAlreadyPublished(url: string): boolean {
  const db = getDb();
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const row = db.prepare(
    'SELECT 1 FROM published_urls WHERE url = ? AND published_at >= ?'
  ).get(url, cutoff);
  return row !== undefined;
}

export function markAsPublished(url: string): void {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO published_urls (url, published_at) VALUES (?, ?)'
  ).run(url, Date.now());
}

export function pruneOldEntries(): void {
  const db = getDb();
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  db.prepare('DELETE FROM published_urls WHERE published_at < ?').run(cutoff);
}

export function deduplicateByTitle(items: CollectedItem[]): CollectedItem[] {
  const kept: CollectedItem[] = [];

  for (const item of items) {
    const isDuplicate = kept.some(
      (k) => stringSimilarity.compareTwoStrings(item.title, k.title) > TITLE_SIMILARITY_THRESHOLD
    );
    if (!isDuplicate) kept.push(item);
  }

  return kept;
}
