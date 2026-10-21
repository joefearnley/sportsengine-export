import assert from "node:assert/strict";
import { normalizeCalendarUrl, parseCalendar } from "./calendar.js";

function test(name: string, run: () => void): void {
  run();
  console.log(`✓ ${name}`);
}

test("converts the SportsEngine webcal URL to HTTPS", () => {
  assert.equal(
    normalizeCalendarUrl(
      "webcal://ical.sportngin.com/v3/calendar/ical?team_ids=example",
    ).href,
    "https://ical.sportngin.com/v3/calendar/ical?team_ids=example",
  );
});

test("rejects non-SportsEngine calendar hosts", () => {
  assert.throws(() => normalizeCalendarUrl("https://localhost/calendar.ics"));
});

test("parses event text, zoned dates, and recurrence", () => {
  const events = parseCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-1
SUMMARY:Practice\\, indoors
DTSTART;TZID=America/New_York:20261102T180000
DTEND;TZID=America/New_York:20261102T190000
LOCATION:Main gym
DESCRIPTION:Bring a ball\\nand water
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
END:VCALENDAR
`);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.summary, "Practice, indoors");
  assert.equal(events[0]?.start, "2026-11-02T23:00:00.000Z");
  assert.equal(events[0]?.all_day, "false");
  assert.equal(events[0]?.description, "Bring a ball\nand water");
  assert.equal(events[0]?.recurrence_rule, "FREQ=WEEKLY;BYDAY=MO");
});

test("parses an all-day event", () => {
  const events = parseCalendar(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-2
SUMMARY:Holiday
DTSTART;VALUE=DATE:20261225
END:VEVENT
END:VCALENDAR
`);
  assert.equal(events[0]?.start, "2026-12-25");
  assert.equal(events[0]?.all_day, "true");
});
