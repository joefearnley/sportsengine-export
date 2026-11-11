import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("stores, replaces, and reloads events in JSON", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const filePath = join(directory, "events.json");
  const database = openDatabase(filePath);
  try {
    database.replaceEvents([event], "Falcons");
    assert.deepEqual(database.getEvents(), [event]);
    assert.equal(database.getStatus().count, 1);
    assert.equal(database.getStatus().teamName, "Falcons");
    database.replaceEvents([{ ...event, summary: "Updated practice" }], "Eagles");
    assert.equal(database.getEvents()[0]?.summary, "Updated practice");
    assert.equal(database.getStatus().teamName, "Eagles");
    assert.match(readFileSync(filePath, "utf8"), /"version": 1/);
  } finally {
    database.close();
  }

  const reopened = openDatabase(filePath);
  try {
    assert.equal(reopened.getEvents()[0]?.summary, "Updated practice");
    assert.equal(reopened.getStatus().teamName, "Eagles");
  } finally {
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects duplicate event IDs without replacing saved events", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const filePath = join(directory, "events.json");
  const database = openDatabase(filePath);
  try {
    database.replaceEvents([event], "Falcons");
    const savedData = readFileSync(filePath, "utf8");
    assert.throws(() =>
      database.replaceEvents(
        [event, { ...event, summary: "Duplicate" }],
        "Eagles",
      ),
    );
    assert.deepEqual(database.getEvents(), [event]);
    assert.equal(readFileSync(filePath, "utf8"), savedData);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migrates an existing SQLite schedule into JSON", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const jsonPath = join(directory, "events.json");
  const sqlitePath = join(directory, "events.sqlite");
  const sqlite = new Database(sqlitePath);
  sqlite.exec(`
    CREATE TABLE events (
      uid TEXT PRIMARY KEY, summary TEXT NOT NULL, start TEXT NOT NULL,
      end TEXT NOT NULL, all_day TEXT NOT NULL, location TEXT NOT NULL,
      description TEXT NOT NULL, url TEXT NOT NULL, recurrence_rule TEXT NOT NULL
    );
    CREATE TABLE sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_imported_at TEXT NOT NULL,
      team_name TEXT NOT NULL DEFAULT ''
    );
  `);
  sqlite.prepare(`
    INSERT INTO events VALUES (
      @uid, @summary, @start, @end, @all_day, @location, @description, @url,
      @recurrence_rule
    )
  `).run(event);
  sqlite.prepare("INSERT INTO sync_state VALUES (1, ?, ?)").run(
    "2026-11-10T23:33:49.100Z",
    "Falcons",
  );
  sqlite.close();

  const database = openDatabase(jsonPath, sqlitePath);
  try {
    assert.deepEqual(database.getEvents(), [event]);
    assert.equal(database.getStatus().lastImportedAt, "2026-11-10T23:33:49.100Z");
    assert.equal(database.getStatus().teamName, "Falcons");
    assert.doesNotThrow(() => JSON.parse(readFileSync(jsonPath, "utf8")));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migrates SQLite schedules without a saved team name", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const jsonPath = join(directory, "events.json");
  const sqlitePath = join(directory, "events.sqlite");
  const sqlite = new Database(sqlitePath);
  sqlite.exec(`
    CREATE TABLE sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_imported_at TEXT NOT NULL
    );
    INSERT INTO sync_state VALUES (1, '2026-10-21T00:00:00.000Z');
  `);
  sqlite.close();

  const database = openDatabase(jsonPath, sqlitePath);
  try {
    assert.equal(database.getStatus().lastImportedAt, "2026-10-21T00:00:00.000Z");
    assert.equal(database.getStatus().teamName, null);
    database.replaceEvents([event], "Falcons");
    assert.equal(database.getStatus().teamName, "Falcons");
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects an invalid JSON schedule database", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const filePath = join(directory, "events.json");
  writeFileSync(filePath, "{invalid");
  assert.throws(() => openDatabase(filePath), SyntaxError);
  rmSync(directory, { recursive: true, force: true });
});
