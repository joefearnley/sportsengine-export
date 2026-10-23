import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CalendarEvent } from "./types.js";

export interface DatabaseHandle {
  close(): void;
  getEvents(): CalendarEvent[];
  getStatus(): {
    count: number;
    lastImportedAt: string | null;
    teamName: string | null;
  };
  replaceEvents(events: CalendarEvent[], teamName: string): void;
}

export function openDatabase(filePath: string): DatabaseHandle {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      uid TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      all_day TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      url TEXT NOT NULL,
      recurrence_rule TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_imported_at TEXT NOT NULL,
      team_name TEXT NOT NULL DEFAULT ''
    );
  `);
  const syncStateColumns = db
    .prepare("PRAGMA table_info(sync_state)")
    .all() as Array<{ name: string }>;
  if (!syncStateColumns.some((column) => column.name === "team_name")) {
    db.exec("ALTER TABLE sync_state ADD COLUMN team_name TEXT NOT NULL DEFAULT ''");
  }

  const selectEvents = db.prepare(
    `SELECT uid, summary, start, end, all_day, location, description, url,
            recurrence_rule
     FROM events
     ORDER BY start, summary`,
  );
  const replaceEvents = db.transaction(
    (events: CalendarEvent[], teamName: string) => {
      db.prepare("DELETE FROM events").run();
      const insert = db.prepare(`
        INSERT INTO events
          (uid, summary, start, end, all_day, location, description, url, recurrence_rule)
        VALUES
          (@uid, @summary, @start, @end, @all_day, @location, @description, @url, @recurrence_rule)
      `);
      for (const event of events) {
        insert.run(event);
      }
      db.prepare(`
        INSERT INTO sync_state (id, last_imported_at, team_name)
        VALUES (1, @lastImportedAt, @teamName)
        ON CONFLICT(id) DO UPDATE SET
          last_imported_at = excluded.last_imported_at,
          team_name = excluded.team_name
      `).run({ lastImportedAt: new Date().toISOString(), teamName });
    },
  );

  return {
    close: () => db.close(),
    getEvents: () => selectEvents.all() as CalendarEvent[],
    getStatus: () => {
      const count = (db.prepare("SELECT COUNT(*) AS count FROM events").get() as {
        count: number;
      }).count;
      const state = db
        .prepare(
          `SELECT last_imported_at AS lastImportedAt, team_name AS teamName
           FROM sync_state WHERE id = 1`,
        )
        .get() as { lastImportedAt: string; teamName: string } | undefined;
      return {
        count,
        lastImportedAt: state?.lastImportedAt ?? null,
        teamName: state?.teamName || null,
      };
    },
    replaceEvents,
  };
}
