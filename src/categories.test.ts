import assert from "node:assert/strict";
import {
  categoryForEvent,
  matchesCategory,
} from "./categories.js";

function test(name: string, run: () => void): void {
  run();
  console.log(`✓ ${name}`);
}

test("groups practice, drills, clinics, and power skate as other events", () => {
  assert.equal(categoryForEvent("PRACTICE"), "Other Events");
  assert.equal(categoryForEvent("Skills & Drills"), "Other Events");
  assert.equal(categoryForEvent("goalie clinic"), "Other Events");
  assert.equal(categoryForEvent("POWER SKATE"), "Other Events");
});

test("classifies every other event name as a game", () => {
  assert.equal(categoryForEvent("Away vs. Home"), "Games");
  assert.equal(categoryForEvent(""), "Games");
});

test("matches all events or only the selected group", () => {
  assert.equal(matchesCategory("PRACTICE", "All"), true);
  assert.equal(matchesCategory("PRACTICE", "Other Events"), true);
  assert.equal(matchesCategory("POWER SKATE", "Other Events"), true);
  assert.equal(matchesCategory("GOALIE CLINIC", "Games"), false);
  assert.equal(matchesCategory("PRACTICE", "Games"), false);
});
