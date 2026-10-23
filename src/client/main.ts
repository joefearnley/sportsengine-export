import { refreshSchedule } from "./schedule-view.js";

interface ImportResult {
  error?: string;
  count?: number;
}

const form = document.querySelector<HTMLFormElement>("#import-form")!;
const teamNameInput = document.querySelector<HTMLInputElement>("#team-name")!;
const urlInput = document.querySelector<HTMLInputElement>("#calendar-url")!;
const importButton = document.querySelector<HTMLButtonElement>("#import-button")!;
const importMessage = document.querySelector<HTMLParagraphElement>("#import-message")!;
const defaultCalendarUrl =
  "webcal://ical.sportngin.com/v3/calendar/ical?team_ids=11f1940f-cc30-66c4-a1d9-6eaf78a0e38a";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  importButton.disabled = true;
  importMessage.className = "message";
  importMessage.textContent = "Fetching your calendar…";
  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: urlInput.value.trim(),
        teamName: teamNameInput.value.trim(),
      }),
    });
    const result = (await response.json()) as ImportResult;
    if (!response.ok) throw new Error(result.error ?? "Calendar import failed.");
    localStorage.setItem("sportsengine-calendar-url", urlInput.value.trim());
    localStorage.setItem("sportsengine-team-name", teamNameInput.value.trim());
    importMessage.classList.add("success");
    importMessage.textContent = `Imported ${result.count} events successfully.`;
    await refreshSchedule();
  } catch (error) {
    importMessage.classList.add("error");
    importMessage.textContent =
      error instanceof Error ? error.message : "Calendar import failed.";
  } finally {
    importButton.disabled = false;
  }
});

urlInput.value =
  localStorage.getItem("sportsengine-calendar-url") ?? defaultCalendarUrl;
teamNameInput.value = localStorage.getItem("sportsengine-team-name") ?? "";
