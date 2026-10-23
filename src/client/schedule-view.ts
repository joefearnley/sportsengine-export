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
  teamName: string | null;
}

const syncStatus = document.querySelector<HTMLParagraphElement>("#sync-status")!;
const teamNameLabel = document.querySelector<HTMLSpanElement>("#team-name-label");
const teamNameHeading =
  document.querySelector<HTMLHeadingElement>("#schedule-team-name");
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
    const category = categoryForEvent(event.summary);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
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
    dateCell.dataset.label = "Date";
    const date = document.createElement("span");
    date.className = "date-label";
    date.textContent = formatDate(event.start);
    dateCell.append(date);

    const eventCell = document.createElement("td");
    eventCell.dataset.label = "Event";
    const name = document.createElement("span");
    name.className = "event-name";
    name.textContent = event.summary || "Untitled event";
    eventCell.append(name);

    const timeCell = document.createElement("td");
    timeCell.dataset.label = "Time";
    timeCell.textContent = formatTime(event.start, event.end, event.all_day);

    const locationCell = document.createElement("td");
    locationCell.className = "location-cell";
    locationCell.dataset.label = "Location";
    locationCell.textContent = event.location || "—";

    row.append(dateCell, eventCell, timeCell, locationCell);
    eventsBody.append(row);
  }

  eventCount.textContent = `${filtered.length} EVENT${filtered.length === 1 ? "" : "S"}`;
  emptyState.hidden = filtered.length > 0;
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

export async function refreshSchedule(): Promise<void> {
  const [eventsResponse, statusResponse] = await Promise.all([
    fetch("/api/events"),
    fetch("/api/status"),
  ]);
  if (!eventsResponse.ok || !statusResponse.ok) {
    throw new Error("Could not load the saved schedule.");
  }
  events = (await eventsResponse.json()) as CalendarEvent[];
  const status = (await statusResponse.json()) as Status;
  if (teamNameLabel) {
    teamNameLabel.textContent = status.teamName ? `· ${status.teamName}` : "";
  }
  if (teamNameHeading) {
    teamNameHeading.textContent = status.teamName ?? "Team Schedule";
    document.title = `${status.teamName ?? "Team"} Schedule`;
  }
  syncStatus.textContent = status.lastImportedAt
    ? `Last imported ${new Date(status.lastImportedAt).toLocaleString()}`
    : "Import a calendar to see your events here.";
  exportButton.setAttribute("aria-disabled", String(status.count === 0));
  renderEvents();
}

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

refreshSchedule().catch((error: unknown) => {
  syncStatus.textContent =
    error instanceof Error ? error.message : "Could not load the saved schedule.";
});
