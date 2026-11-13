import "dotenv/config";
import express from "express";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadCalendar } from "./calendar.js";
import { openDatabase } from "./database.js";
import { createSchedulePdf } from "./pdf.js";
import { EVENT_FIELDS, type CalendarEvent } from "./types.js";

function schedulePdfFilename(teamName: string): string {
  const safeTeamName = teamName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/[. ]+$/g, "");
  return `${safeTeamName || "team"}-schedule.pdf`;
}

export function createApp(
  databasePath: string,
  webRoot?: string,
  legacySqlitePath?: string,
) {
  const app = express();
  const database = openDatabase(databasePath, legacySqlitePath);
  app.use(express.json({ limit: "8kb" }));

  app.get("/api/events", (_request, response) => {
    response.json(database.getEvents());
  });

  app.get("/api/status", (_request, response) => {
    response.json(database.getStatus());
  });

  app.post("/api/import", async (request, response) => {
    const url = request.body?.url;
    const teamName =
      typeof request.body?.teamName === "string" ? request.body.teamName.trim() : "";
    if (typeof url !== "string" || !url.trim()) {
      response.status(400).json({ error: "Calendar URL is required." });
      return;
    }
    if (!teamName || teamName.length > 100) {
      response.status(400).json({
        error: "Team name is required and must be 100 characters or fewer.",
      });
      return;
    }
    try {
      const result = await loadCalendar(url);
      database.replaceEvents(result.events, teamName);
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
    const teamName = database.getStatus().teamName ?? "";
    const csvCell = (value: string) => {
      const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const csv = [
      ["team_name", ...EVENT_FIELDS].join(","),
      ...rows.map((event) =>
        [csvCell(teamName), ...EVENT_FIELDS.map((field) => csvCell(event[field]))]
          .join(","),
      ),
    ].join("\r\n");
    response
      .type("text/csv")
      .attachment("sportsengine-events.csv")
      .send(csv);
  });

  app.get("/api/export.pdf", async (_request, response) => {
    const events = database.getEvents();
    const teamName = database.getStatus().teamName;
    if (events.length === 0 || !teamName) {
      response.status(404).json({ error: "Import a team calendar before exporting a PDF." });
      return;
    }
    try {
      const pdf = await createSchedulePdf(events, teamName);
      response
        .type("application/pdf")
        .attachment(schedulePdfFilename(teamName))
        .send(pdf);
    } catch (error) {
      console.error("Could not generate schedule PDF:", error);
      response.status(500).json({ error: "Could not generate the schedule PDF." });
    }
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
  resolve(dataDirectory, "events.json"),
  process.env.NODE_ENV === "production" ? webRoot : undefined,
  resolve(dataDirectory, "events.sqlite"),
);
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
app.listen(port, host, () => {
  console.log(`SportsEngine exporter listening at http://${host}:${port}`);
});
