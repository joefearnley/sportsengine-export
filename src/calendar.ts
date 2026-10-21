import ICAL from "ical.js";
import type { CalendarEvent } from "./types.js";

export function normalizeCalendarUrl(input: string): URL {
  const normalizedInput = input.trim().replace(/^webcal:/i, "https:");
  let url: URL;
  try {
    url = new URL(normalizedInput);
  } catch {
    throw new Error("Enter a valid SportsEngine calendar URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "ical.sportngin.com"
  ) {
    throw new Error(
      "Use an HTTPS or webcal URL from ical.sportngin.com.",
    );
  }
  return url;
}

async function fetchCalendar(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "text/calendar" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`SportsEngine returned HTTP ${response.status}.`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The calendar request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function propertyText(component: ICAL.Component, name: string): string {
  const value = component.getFirstPropertyValue(name);
  return value == null ? "" : String(value);
}

function formatTime(value: ICAL.Time, allDay: boolean): string {
  return allDay ? value.toString() : value.toJSDate().toISOString();
}

export function parseCalendar(calendarText: string): CalendarEvent[] {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(calendarText));
  } catch {
    throw new Error("The response is not a valid iCalendar feed.");
  }

  const components = root.getAllSubcomponents("vevent");
  const events: CalendarEvent[] = [];
  for (const component of components) {
    const uid = propertyText(component, "uid");
    const startDate = component.getFirstPropertyValue("dtstart");
    if (!uid || !(startDate instanceof ICAL.Time)) {
      continue;
    }
    if (propertyText(component, "status").toUpperCase() === "CANCELLED") {
      continue;
    }

    const endDate = component.getFirstPropertyValue("dtend");
    const rrule = component.getFirstPropertyValue("rrule");
    events.push({
      uid,
      summary: propertyText(component, "summary"),
      start: formatTime(startDate, startDate.isDate),
      end: endDate instanceof ICAL.Time ? formatTime(endDate, startDate.isDate) : "",
      all_day: String(startDate.isDate),
      location: propertyText(component, "location"),
      description: propertyText(component, "description"),
      url: propertyText(component, "url"),
      recurrence_rule: rrule ? String(rrule) : "",
    });
  }
  return events;
}

export async function loadCalendar(input: string): Promise<{
  events: CalendarEvent[];
  url: string;
}> {
  const url = normalizeCalendarUrl(input);
  const text = await fetchCalendar(url);
  const events = parseCalendar(text);
  if (events.length === 0) {
    throw new Error("No events were found in the calendar feed.");
  }
  return { events, url: url.toString() };
}
