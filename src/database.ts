import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { EVENT_FIELDS, type CalendarEvent } from "./types.js";

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

interface DatabaseData {
  version: 1;
  events: CalendarEvent[];
  lastImportedAt: string | null;
  teamName: string | null;
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return EVENT_FIELDS.every((field) => typeof event[field] === "string");
}

function validateData(value: unknown): DatabaseData {
  if (typeof value !== "object" || value === null) {
    throw new Error("The JSON schedule database is invalid.");
  }
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 ||
    !Array.isArray(data.events) ||
    !data.events.every(isCalendarEvent) ||
    !(typeof data.lastImportedAt === "string" || data.lastImportedAt === null) ||
    !(typeof data.teamName === "string" || data.teamName === null)
  ) {
    throw new Error("The JSON schedule database is invalid.");
  }
  return {
    version: 1,
    events: data.events,
    lastImportedAt: data.lastImportedAt,
    teamName: data.teamName,
  };
}

function readLegacyDatabase(filePath: string): DatabaseData {
  const db = new Database(filePath, { readonly: true });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = new Set(tables.map((table) => table.name));
    const events = tableNames.has("events")
      ? (db.prepare(`
          SELECT uid, summary, start, end, all_day, location, description, url,
                 recurrence_rule
          FROM events
          ORDER BY start, summary
        `).all() as CalendarEvent[])
      : [];
    let state: { lastImportedAt: string; teamName: string | null } | undefined;
    if (tableNames.has("sync_state")) {
      const columns = db
        .prepare("PRAGMA table_info(sync_state)")
        .all() as Array<{ name: string }>;
      const hasTeamName = columns.some((column) => column.name === "team_name");
      state = (db.prepare(`
        SELECT last_imported_at AS lastImportedAt${
          hasTeamName ? ", team_name AS teamName" : ", NULL AS teamName"
        }
        FROM sync_state WHERE id = 1
      `).all() as Array<{
        lastImportedAt: string;
        teamName: string | null;
      }>)[0];
    }
    return {
      version: 1,
      events,
      lastImportedAt: state?.lastImportedAt ?? null,
      teamName: state?.teamName || null,
    };
  } finally {
    db.close();
  }
}

export function openDatabase(
  filePath: string,
  legacySqlitePath?: string,
): DatabaseHandle {
  mkdirSync(dirname(filePath), { recursive: true });
  let data: DatabaseData;
  if (existsSync(filePath)) {
    data = validateData(JSON.parse(readFileSync(filePath, "utf8")));
  } else if (legacySqlitePath && existsSync(legacySqlitePath)) {
    data = readLegacyDatabase(legacySqlitePath);
    writeData(data);
  } else {
    data = {
      version: 1,
      events: [],
      lastImportedAt: null,
      teamName: null,
    };
    writeData(data);
  }

  function writeData(nextData: DatabaseData): void {
    const temporaryPath = `${filePath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(nextData, null, 2)}\n`);
    renameSync(temporaryPath, filePath);
  }

  return {
    close: () => {},
    getEvents: () => [...data.events].sort(
      (left, right) =>
        left.start.localeCompare(right.start) ||
        left.summary.localeCompare(right.summary),
    ),
    getStatus: () => ({
      count: data.events.length,
      lastImportedAt: data.lastImportedAt,
      teamName: data.teamName,
    }),
    replaceEvents: (events, teamName) => {
      const eventIds = new Set<string>();
      for (const event of events) {
        if (!isCalendarEvent(event)) {
          throw new Error("The calendar contains an invalid event.");
        }
        if (eventIds.has(event.uid)) {
          throw new Error(`Duplicate event ID: ${event.uid}`);
        }
        eventIds.add(event.uid);
      }
      const nextData: DatabaseData = {
        version: 1,
        events: [...events],
        lastImportedAt: new Date().toISOString(),
        teamName,
      };
      writeData(nextData);
      data = nextData;
    },
  };
}
