import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tmpDb = join(tmpdir(), `test-bot-${Date.now()}.db`);

describe('initDb', () => {
  afterEach(() => {
    try { unlinkSync(tmpDb); } catch {}
  });

  it('creates published_urls table with correct schema', async () => {
    const { initDb } = await import('../../src/core/db');
    const db = initDb(tmpDb);
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='published_urls'").get() as { sql: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.sql).toMatch(/url\s+TEXT\s+UNIQUE\s+NOT\s+NULL/i);
    expect(row!.sql).toMatch(/published_at\s+INTEGER\s+NOT\s+NULL/i);
    db.close();
  });

  it('creates cycle_lock table with default row (id=1, running=0)', async () => {
    const { initDb } = await import('../../src/core/db');
    const db = initDb(tmpDb);
    const lock = db.prepare('SELECT id, running, started_at FROM cycle_lock WHERE id = 1').get() as { id: number; running: number; started_at: number | null } | undefined;
    expect(lock).toBeDefined();
    expect(lock!.running).toBe(0);
    expect(lock!.started_at).toBeNull();
    db.close();
  });

  it('is idempotent — calling initDb twice does not fail', async () => {
    const { initDb } = await import('../../src/core/db');
    const db1 = initDb(tmpDb);
    db1.close();
    const db2 = initDb(tmpDb);
    const count = (db2.prepare('SELECT COUNT(*) as n FROM cycle_lock').get() as { n: number }).n;
    expect(count).toBe(1);
    db2.close();
  });

  it('getDb returns the same database instance after initDb', async () => {
    const { initDb, getDb } = await import('../../src/core/db');
    const db = initDb(tmpDb);
    expect(getDb()).toBe(db);
    db.close();
  });
});
