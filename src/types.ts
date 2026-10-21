export interface CalendarEvent {
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

export const EVENT_FIELDS: Array<keyof CalendarEvent> = [
  "uid",
  "summary",
  "start",
  "end",
  "all_day",
  "location",
  "description",
  "url",
  "recurrence_rule",
];
