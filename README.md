# SportsEngine Schedule

A small local web app that imports a SportsEngine iCalendar feed into SQLite,
shows the events in a searchable list, and downloads them as CSV.
The schedule defaults to Games and can also show Other Events (Practice,
Skills & Drills, Goalie Clinic, and Power Skate) or All events. It can also be
searched by event name or location.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

The server reads its bind address from `HOST` in `.env`. The default is
`127.0.0.1` (local only); set `HOST=0.0.0.0` to allow Docker or other network
interfaces to reach it. Only use `0.0.0.0` on a trusted network.

Open the local address printed by Vite (normally `http://localhost:5173`).
Paste the SportsEngine calendar link beginning with `webcal://` and choose
**Import schedule**. Enter the team name associated with the calendar; it is
saved with the import and included in the CSV export. The calendar URL and
team name are also saved in this browser for next time. The feed is fetched
by the local backend, which stores its events in `data/events.sqlite`. Use
**Download CSV** to export the stored rows.
Open `/schedule/` to view the saved team name and schedule directly.

The server only accepts the HTTPS/webcal feed host `ical.sportngin.com` and
binds to localhost. It does not require a SportsEngine password.

## Production build

```sh
npm run build
NODE_ENV=production npm start
```

The production server serves both the web app and API at
`http://127.0.0.1:3001`.

## Tests

```sh
npm test
```

The original command-line CSV exporter is still available:

```sh
python3 cli/sportsengine_export.py 'webcal://ical.sportngin.com/v3/calendar/ical?team_ids=YOUR_TEAM_ID'
```

Run its tests with:

```sh
python3 -m unittest discover -s cli -v
```
