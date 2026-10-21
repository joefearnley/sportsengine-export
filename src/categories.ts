export const EVENT_CATEGORIES = [
  "All",
  "Other Events",
  "Games",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export function categoryForEvent(summary: string): Exclude<EventCategory, "All"> {
  switch (summary.trim().toLocaleLowerCase()) {
    case "practice":
    case "skills & drills":
    case "goalie clinic":
    case "power skate":
      return "Other Events";
    default:
      return "Games";
  }
}

export function matchesCategory(
  summary: string,
  selectedCategory: EventCategory,
): boolean {
  return selectedCategory === "All" || categoryForEvent(summary) === selectedCategory;
}
