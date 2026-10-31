import { categoryForEvent } from "./categories.js";
import type { CalendarEvent } from "./types.js";

export interface WeekendGames {
  startDate: Date;
  endDate: Date;
  events: CalendarEvent[];
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function eventDateKey(event: CalendarEvent): string {
  if (event.all_day === "true") return event.start.slice(0, 10);
  return localDateKey(new Date(event.start));
}

function isUpcoming(event: CalendarEvent, now: Date): boolean {
  if (event.all_day === "true") {
    return eventDateKey(event) >= localDateKey(now);
  }
  return new Date(event.start).getTime() >= now.getTime();
}

export function getClosestWeekendGames(
  events: CalendarEvent[],
  now: Date,
): WeekendGames {
  const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = saturday.getDay();
  const daysUntilSaturday = dayOfWeek === 0 ? -1 : (6 - dayOfWeek + 7) % 7;
  saturday.setDate(saturday.getDate() + daysUntilSaturday);
  const upcomingWeekendGames = events.filter((event) => {
    const dateKey = eventDateKey(event);
    const weekday = dateFromKey(dateKey).getDay();
    return (
      categoryForEvent(event.summary) === "Games" &&
      (weekday === 0 || weekday === 6) &&
      isUpcoming(event, now)
    );
  });
  const closestGame = upcomingWeekendGames
    .slice()
    .sort((left, right) => eventDateKey(left).localeCompare(eventDateKey(right)))[0];
  if (closestGame) {
    const gameDate = dateFromKey(eventDateKey(closestGame));
    if (gameDate.getDay() === 0) gameDate.setDate(gameDate.getDate() - 1);
    saturday.setTime(gameDate.getTime());
  }

  const sunday = new Date(
    saturday.getFullYear(),
    saturday.getMonth(),
    saturday.getDate() + 1,
  );
  const saturdayKey = localDateKey(saturday);
  const sundayKey = localDateKey(sunday);
  const weekendEvents = upcomingWeekendGames.filter((event) => {
    const dateKey = eventDateKey(event);
    return dateKey === saturdayKey || dateKey === sundayKey;
  });

  return { startDate: saturday, endDate: sunday, events: weekendEvents };
}
