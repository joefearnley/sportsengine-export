import PDFDocument from "pdfkit";
import { categoryForEvent } from "./categories.js";
import type { CalendarEvent } from "./types.js";

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function eventDateParts(event: CalendarEvent): DateParts {
  if (event.all_day === "true") {
    const [year, month, day] = event.start.slice(0, 10).split("-").map(Number);
    return { year, month: month - 1, day };
  }
  const date = new Date(event.start);
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

function dateKey({ year, month, day }: DateParts): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthKey({ year, month }: DateParts): number {
  return year * 12 + month;
}

function formatTime(event: CalendarEvent): string {
  if (event.all_day === "true") return "All day";
  return new Date(event.start).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventLabel(event: CalendarEvent): string {
  const time = formatTime(event);
  return `${time}  ${event.summary || "Untitled event"}`;
}

export function createSchedulePdf(
  events: CalendarEvent[],
  teamName: string,
): Promise<Buffer> {
  if (events.length === 0) {
    return Promise.reject(new Error("There are no events to export."));
  }

  const eventsByDate = new Map<string, CalendarEvent[]>();
  const eventDates = events.map(eventDateParts);
  events.forEach((event, index) => {
    const key = dateKey(eventDates[index]!);
    const items = eventsByDate.get(key) ?? [];
    items.push(event);
    eventsByDate.set(key, items);
  });
  for (const items of eventsByDate.values()) {
    items.sort((left, right) => left.start.localeCompare(right.start));
  }

  const firstMonth = Math.min(...eventDates.map(monthKey));
  const lastMonth = Math.max(...eventDates.map(monthKey));
  const document = new PDFDocument({
    size: "LETTER",
    layout: "landscape",
    margins: { top: 34, bottom: 34, left: 36, right: 36 },
    bufferPages: false,
    info: {
      Title: `${teamName} Schedule`,
      Author: "SportsEngine Schedule",
    },
  });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex += 1) {
      if (monthIndex > firstMonth) document.addPage();
      const year = Math.floor(monthIndex / 12);
      const month = monthIndex % 12;
      const firstDay = new Date(year, month, 1);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstWeekday = firstDay.getDay();
      const weekCount = Math.ceil((firstWeekday + daysInMonth) / 7);
      const pageWidth = document.page.width;
      const pageHeight = document.page.height;
      const left = document.page.margins.left;
      const right = pageWidth - document.page.margins.right;
      const contentWidth = right - left;
      const columnWidth = contentWidth / 7;
      const calendarTop = 119;
      const calendarBottom = pageHeight - 58;
      const rowHeight = (calendarBottom - calendarTop) / weekCount;

      document
        .fillColor("#222629")
        .font("Helvetica-Bold")
        .fontSize(19)
        .text(teamName, left, 34, { width: contentWidth - 180 });
      document
        .fillColor("#92784b")
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(firstDay.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        }), right - 180, 39, {
          width: 180,
          align: "right",
        });

      const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const weekdayTop = 82;
      document.font("Helvetica-Bold").fontSize(8);
      weekdayNames.forEach((weekday, index) => {
        const x = left + index * columnWidth;
        document
          .fillColor("#777b7d")
          .text(weekday, x + 5, weekdayTop, { width: columnWidth - 10 });
        document
          .moveTo(x, calendarTop)
          .lineTo(x, calendarBottom)
          .strokeColor("#e5e4e1")
          .lineWidth(0.7)
          .stroke();
      });
      document
        .moveTo(right, calendarTop)
        .lineTo(right, calendarBottom)
        .strokeColor("#e5e4e1")
        .stroke();

      for (let week = 0; week < weekCount; week += 1) {
        const y = calendarTop + week * rowHeight;
        document
          .moveTo(left, y)
          .lineTo(right, y)
          .strokeColor("#e5e4e1")
          .lineWidth(0.7)
          .stroke();
        for (let weekday = 0; weekday < 7; weekday += 1) {
          const dayNumber = week * 7 + weekday - firstWeekday + 1;
          if (dayNumber < 1 || dayNumber > daysInMonth) continue;

          const x = left + weekday * columnWidth;
          const cellDate = { year, month, day: dayNumber };
          const key = dateKey(cellDate);
          const dayEvents = eventsByDate.get(key) ?? [];
          document
            .fillColor("#303437")
            .font("Helvetica-Bold")
            .fontSize(9)
            .text(String(dayNumber), x + 5, y + 5, {
              width: columnWidth - 10,
            });

          dayEvents.slice(0, 3).forEach((event, index) => {
            const color = categoryForEvent(event.summary) === "Games"
              ? "#cf2944"
              : "#92784b";
            document
              .fillColor(color)
              .font("Helvetica")
              .fontSize(7.5)
              .text(eventLabel(event), x + 5, y + 19 + index * 16, {
                width: columnWidth - 10,
                height: 15,
                ellipsis: true,
              });
          });
          if (dayEvents.length > 3) {
            document
              .fillColor("#777b7d")
              .font("Helvetica-Oblique")
              .fontSize(7)
              .text(`+${dayEvents.length - 3} more`, x + 5, y + rowHeight - 12, {
                width: columnWidth - 10,
                ellipsis: true,
              });
          }
        }
      }
      document
        .moveTo(left, calendarBottom)
        .lineTo(right, calendarBottom)
        .strokeColor("#e5e4e1")
        .lineWidth(0.7)
        .stroke();
      document
        .fillColor("#92918d")
        .font("Helvetica")
        .fontSize(7)
        .text("Generated from your SportsEngine schedule", left, pageHeight - 40, {
          width: contentWidth,
          align: "right",
        });
    }

    document.end();
  });
}
