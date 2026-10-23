import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./database.js";
import type { CalendarEvent } from "./types.js";

function test(name: string, run: () => void): void {
  run();
  console.log(`✓ ${name}`);
}

const event: CalendarEvent = {
  uid: "event-1",
  summary: "Practice",
  start: "2026-11-02T23:00:00.000Z",
  end: "2026-11-03T00:00:00.000Z",
  all_day: "false",
  location: "Main gym",
  description: "",
  url: "",
  recurrence_rule: "",
};

test("stores and replaces events in SQLite", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const database = openDatabase(join(directory, "events.sqlite"));
  try {
    database.replaceEvents([event], "Falcons");
    assert.deepEqual(database.getEvents(), [event]);
    assert.equal(database.getStatus().count, 1);
    assert.equal(database.getStatus().teamName, "Falcons");
    database.replaceEvents([{ ...event, summary: "Updated practice" }], "Eagles");
    assert.equal(database.getEvents()[0]?.summary, "Updated practice");
    assert.equal(database.getStatus().teamName, "Eagles");
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rolls back a replacement with duplicate event IDs", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const database = openDatabase(join(directory, "events.sqlite"));
  try {
    database.replaceEvents([event], "Falcons");
    assert.throws(() =>
      database.replaceEvents(
        [event, { ...event, summary: "Duplicate" }],
        "Eagles",
      ),
    );
    assert.deepEqual(database.getEvents(), [event]);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("adds team names to an existing SQLite database", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const filePath = join(directory, "events.sqlite");
  const oldDatabase = new Database(filePath);
  oldDatabase.exec(`
    CREATE TABLE sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_imported_at TEXT NOT NULL
    );
    INSERT INTO sync_state (id, last_imported_at)
    VALUES (1, '2026-10-21T00:00:00.000Z');
  `);
  oldDatabase.close();

  const database = openDatabase(filePath);
  try {
    assert.equal(database.getStatus().teamName, null);
    assert.equal(database.getStatus().lastImportedAt, "2026-10-21T00:00:00.000Z");
    database.replaceEvents([event], "Falcons");
    assert.equal(database.getStatus().teamName, "Falcons");
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
