import express from "express";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadCalendar } from "./calendar.js";
import { openDatabase } from "./database.js";
import { EVENT_FIELDS, type CalendarEvent } from "./types.js";

export function createApp(databasePath: string, webRoot?: string) {
  const app = express();
  const database = openDatabase(databasePath);
  app.use(express.json({ limit: "8kb" }));

  app.get("/api/events", (_request, response) => {
    response.json(database.getEvents());
  });

  app.get("/api/status", (_request, response) => {
    response.json(database.getStatus());
  });

  app.post("/api/import", async (request, response) => {
    const url = request.body?.url;
    if (typeof url !== "string" || !url.trim()) {
      response.status(400).json({ error: "Calendar URL is required." });
      return;
    }
    try {
      const result = await loadCalendar(url);
      database.replaceEvents(result.events);
      response.json({
        count: result.events.length,
        importedAt: database.getStatus().lastImportedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Calendar import failed.";
      const status = message.startsWith("Use an HTTPS") ||
        message.startsWith("Enter a valid")
        ? 400
        : 502;
      response.status(status).json({ error: message });
    }
  });

  app.get("/api/export.csv", (_request, response) => {
    const rows = database.getEvents();
    const csvCell = (value: string) => {
      const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const csv = [
      EVENT_FIELDS.join(","),
      ...rows.map((event) =>
        EVENT_FIELDS.map((field) => csvCell(event[field])).join(","),
      ),
    ].join("\r\n");
    response
      .type("text/csv")
      .attachment("sportsengine-events.csv")
      .send(csv);
  });

  if (webRoot) {
    app.use(express.static(webRoot));
    app.get("*path", (_request, response) => {
      response.sendFile(resolve(webRoot, "index.html"));
    });
  }

  return { app, close: () => database.close() };
}

const dataDirectory = resolve("data");
mkdirSync(dataDirectory, { recursive: true });
const webRoot = resolve("dist");
const { app } = createApp(
  resolve(dataDirectory, "events.sqlite"),
  process.env.NODE_ENV === "production" ? webRoot : undefined,
);
const port = Number(process.env.PORT ?? 3001);
app.listen(port, "127.0.0.1", () => {
  console.log(`SportsEngine exporter listening at http://127.0.0.1:${port}`);
});
