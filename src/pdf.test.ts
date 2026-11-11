import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
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
  assert.equal((pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length, 1);
  const contentStreams = [...pdf.toString("latin1").matchAll(
    /stream\r?\n([\s\S]*?)\r?\nendstream/g,
  )].map((match) =>
    inflateSync(Buffer.from(match[1]!, "latin1")).toString("latin1")
  ).join("");
  assert.ok(contentStreams.includes("<486f6d65204172656e61>"));
  const twoMonthPdf = await createSchedulePdf([
    event,
    { ...event, uid: "game-2", start: "2026-12-07T18:00:00.000Z" },
  ], "LJL 12U Black");
  assert.equal(
    (twoMonthPdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length,
    2,
  );
  await assert.rejects(createSchedulePdf([], "LJL 12U Black"), /no events/i);
  console.log("✓ generates a monthly schedule PDF without blank pages");
}
