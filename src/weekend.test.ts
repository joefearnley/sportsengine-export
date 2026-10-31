import assert from "node:assert/strict";
import type { CalendarEvent } from "./types.js";
import { getClosestWeekendGames } from "./weekend.js";

function test(name: string, run: () => void): void {
  run();
  console.log(`✓ ${name}`);
}

function makeEvent(
  summary: string,
  start: Date,
  allDay = "false",
): CalendarEvent {
  return {
    uid: summary + start.toISOString(),
    summary,
    start: allDay === "true"
      ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
      : start.toISOString(),
    end: "",
    all_day: allDay,
    location: "",
    description: "",
    url: "",
    recurrence_rule: "",
  };
}

test("returns only upcoming games in the current Saturday-Sunday window", () => {
  const now = new Date(2026, 9, 31, 12);
  const saturdayMorning = makeEvent("Home vs Away", new Date(2026, 9, 31, 9));
  const saturdayEvening = makeEvent("Away vs Home", new Date(2026, 9, 31, 18));
  const sundayGame = makeEvent("Lumberjacks vs Hawks", new Date(2026, 10, 1, 13));
  const otherEvent = makeEvent("PRACTICE", new Date(2026, 9, 31, 17));
  const mondayGame = makeEvent("Monday game", new Date(2026, 10, 2, 18));

  const result = getClosestWeekendGames(
    [saturdayMorning, saturdayEvening, sundayGame, otherEvent, mondayGame],
    now,
  );

  assert.equal(result.startDate.getDate(), 31);
  assert.equal(result.endDate.getDate(), 1);
  assert.deepEqual(result.events, [saturdayEvening, sundayGame]);
});

test("uses the next weekend when today is a weekday", () => {
  const now = new Date(2026, 9, 27, 12);
  const saturdayGame = makeEvent("Saturday Game", new Date(2026, 9, 31, 10));
  const sundayGame = makeEvent("Sunday Game", new Date(2026, 10, 1, 10));

  const result = getClosestWeekendGames([saturdayGame, sundayGame], now);

  assert.equal(result.startDate.getDate(), 31);
  assert.equal(result.startDate.getMonth(), 9);
  assert.deepEqual(result.events, [saturdayGame, sundayGame]);
});

test("skips a weekend with no games and selects the nearest weekend with a game", () => {
  const now = new Date(2026, 9, 27, 12);
  const gameNextWeekend = makeEvent("Next weekend", new Date(2026, 10, 7, 10));
  const gameLater = makeEvent("Later weekend", new Date(2026, 10, 14, 10));

  const result = getClosestWeekendGames([gameNextWeekend, gameLater], now);

  assert.equal(result.startDate.getDate(), 7);
  assert.deepEqual(result.events, [gameNextWeekend]);
});

test("includes an all-day game scheduled for today", () => {
  const now = new Date(2026, 9, 31, 15);
  const allDayGame = makeEvent("Tournament Game", now, "true");

  assert.deepEqual(getClosestWeekendGames([allDayGame], now).events, [allDayGame]);
});
