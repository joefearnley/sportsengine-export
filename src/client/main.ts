import "./style.css";
import {
  EVENT_CATEGORIES,
  categoryForEvent,
  matchesCategory,
  type EventCategory,
} from "../categories.js";

interface CalendarEvent {
  uid: string;
  summary: string;
  start: string;
  end: string;
  all_day: string;
  location: string;
  description: string;
  url: string;
  recurrence_rule: string;
}

interface Status {
  count: number;
  lastImportedAt: string | null;
}

const form = document.querySelector<HTMLFormElement>("#import-form")!;
const urlInput = document.querySelector<HTMLInputElement>("#calendar-url")!;
const importButton = document.querySelector<HTMLButtonElement>("#import-button")!;
const importMessage = document.querySelector<HTMLParagraphElement>("#import-message")!;
const syncStatus = document.querySelector<HTMLParagraphElement>("#sync-status")!;
const searchInput = document.querySelector<HTMLInputElement>("#search")!;
const eventCount = document.querySelector<HTMLSpanElement>("#event-count")!;
const categoryFilters =
  document.querySelector<HTMLDivElement>("#category-filters")!;
const categoryButtons = Array.from(
  categoryFilters.querySelectorAll<HTMLButtonElement>(".category-filter"),
);
const eventsBody = document.querySelector<HTMLTableSectionElement>("#events-body")!;
const emptyState = document.querySelector<HTMLDivElement>("#empty-state")!;
const exportButton = document.querySelector<HTMLAnchorElement>("#export-button")!;
const defaultCalendarUrl =
  "webcal://ical.sportngin.com/v3/calendar/ical?team_ids=11f1940f-cc30-66c4-a1d9-6eaf78a0e38a";

let events: CalendarEvent[] = [];
let selectedCategory: EventCategory = "Games";

function formatDate(value: string): string {
  if (value.length === 10) {
    return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(start: string, end: string, allDay: string): string {
  if (allDay === "true") return "All day";
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const startTime = new Date(start).toLocaleTimeString(undefined, options);
  if (!end) return startTime;
  const endTime = new Date(end).toLocaleTimeString(undefined, options);
  return `${startTime} – ${endTime}`;
}

function renderEvents(): void {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const categoryCounts = new Map<EventCategory, number>(
    EVENT_CATEGORIES.map((category) => [category, 0]),
  );
  for (const event of events) {
    const mappedCategory = categoryForEvent(event.summary);
    categoryCounts.set(mappedCategory, (categoryCounts.get(mappedCategory) ?? 0) + 1);
  }
  categoryCounts.set("All", events.length);
  for (const button of categoryButtons) {
    const category = EVENT_CATEGORIES.find(
      (candidate) => candidate === button.dataset.category,
    );
    if (!category) continue;
    button.querySelector(".filter-count")!.textContent = String(
      categoryCounts.get(category) ?? 0,
    );
    button.setAttribute("aria-pressed", String(category === selectedCategory));
  }

  const filtered = events.filter((event) =>
    matchesCategory(event.summary, selectedCategory) &&
    `${event.summary} ${event.location}`.toLocaleLowerCase().includes(query),
  );

  eventsBody.replaceChildren();
  for (const event of filtered) {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    const date = document.createElement("span");
    date.className = "date-label";
    date.textContent = formatDate(event.start);
    dateCell.append(date);

    const eventCell = document.createElement("td");
    const name = document.createElement("span");
    name.className = "event-name";
    name.textContent = event.summary || "Untitled event";
    eventCell.append(name);

    const timeCell = document.createElement("td");
    timeCell.textContent = formatTime(event.start, event.end, event.all_day);

    const locationCell = document.createElement("td");
    locationCell.className = "location-cell";
    locationCell.textContent = event.location || "—";

    row.append(dateCell, eventCell, timeCell, locationCell);
    eventsBody.append(row);
  }
  eventCount.textContent = `${filtered.length} EVENT${filtered.length === 1 ? "" : "S"}`;
  emptyState.hidden = filtered.length > 0;
  emptyState.classList.toggle("no-matches", events.length > 0 && filtered.length === 0);
  if (filtered.length === 0 && events.length > 0) {
    emptyState.querySelector("h3")!.textContent = "No matching events.";
    emptyState.querySelector("p")!.textContent =
      "Try another filter, event name, or location.";
  } else if (events.length === 0) {
    emptyState.querySelector("h3")!.textContent = "Your next game starts here.";
    emptyState.querySelector("p")!.textContent =
      "Import a calendar feed above to fill in your schedule.";
  }
}

async function loadEvents(): Promise<void> {
  const [eventsResponse, statusResponse] = await Promise.all([
    fetch("/api/events"),
    fetch("/api/status"),
  ]);
  if (!eventsResponse.ok || !statusResponse.ok) {
    throw new Error("Could not load the saved schedule.");
  }
  events = (await eventsResponse.json()) as CalendarEvent[];
  const status = (await statusResponse.json()) as Status;
  syncStatus.textContent = status.lastImportedAt
    ? `Last imported ${new Date(status.lastImportedAt).toLocaleString()}`
    : "Import a calendar to see your events here.";
  exportButton.setAttribute("aria-disabled", String(status.count === 0));
  renderEvents();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  importButton.disabled = true;
  importMessage.className = "message";
  importMessage.textContent = "Fetching your calendar…";
  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: urlInput.value.trim() }),
    });
    const result = (await response.json()) as { error?: string; count?: number };
    if (!response.ok) throw new Error(result.error ?? "Calendar import failed.");
    localStorage.setItem("sportsengine-calendar-url", urlInput.value.trim());
    importMessage.classList.add("success");
    importMessage.textContent = `Imported ${result.count} events successfully.`;
    await loadEvents();
  } catch (error) {
    importMessage.classList.add("error");
    importMessage.textContent =
      error instanceof Error ? error.message : "Calendar import failed.";
  } finally {
    importButton.disabled = false;
  }
});

searchInput.addEventListener("input", renderEvents);
categoryFilters.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    ".category-filter",
  );
  const category = EVENT_CATEGORIES.find(
    (candidate) => candidate === button?.dataset.category,
  );
  if (!category) return;
  selectedCategory = category;
  renderEvents();
});

urlInput.value =
  localStorage.getItem("sportsengine-calendar-url") ?? defaultCalendarUrl;
loadEvents().catch((error: unknown) => {
  syncStatus.textContent =
    error instanceof Error ? error.message : "Could not load the saved schedule.";
});
