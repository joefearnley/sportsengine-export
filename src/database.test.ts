import assert from "node:assert/strict";
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
    database.replaceEvents([event]);
    assert.deepEqual(database.getEvents(), [event]);
    assert.equal(database.getStatus().count, 1);
    database.replaceEvents([{ ...event, summary: "Updated practice" }]);
    assert.equal(database.getEvents()[0]?.summary, "Updated practice");
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rolls back a replacement with duplicate event IDs", () => {
  const directory = mkdtempSync(join(tmpdir(), "sportsengine-test-"));
  const database = openDatabase(join(directory, "events.sqlite"));
  try {
    database.replaceEvents([event]);
    assert.throws(() =>
      database.replaceEvents([event, { ...event, summary: "Duplicate" }]),
    );
    assert.deepEqual(database.getEvents(), [event]);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
