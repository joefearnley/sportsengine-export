import assert from "node:assert/strict";
import type { CalendarEvent } from "./types.js";
import { createSchedulePdf } from "./pdf.js";

const event: CalendarEvent = {
  uid: "game-1",
  summary: "Lumberjacks vs Hawks",
  start: "2026-11-07T18:00:00.000Z",
  end: "2026-11-07T19:00:00.000Z",
  all_day: "false",
  location: "Home Arena",
  description: "",
  url: "",
  recurrence_rule: "",
};

export async function testPdfExport(): Promise<void> {
  const pdf = await createSchedulePdf([event], "LJL 12U Black");
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);
  await assert.rejects(createSchedulePdf([], "LJL 12U Black"), /no events/i);
  console.log("✓ generates a downloadable monthly schedule PDF");
}
