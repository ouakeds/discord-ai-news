import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data', 'bot.db');

let db: Database.Database;

export function initDb(dbPath?: string): Database.Database {
  db = new Database(dbPath ?? DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS published_urls (
      id           INTEGER PRIMARY KEY,
      url          TEXT UNIQUE NOT NULL,
      published_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cycle_lock (
      id         INTEGER PRIMARY KEY,
      running    INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER
    );
    INSERT OR IGNORE INTO cycle_lock (id, running) VALUES (1, 0);
  `);
  return db;
}

export function getDb(): Database.Database {
  return db;
}
