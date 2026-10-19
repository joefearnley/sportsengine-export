# SportsEngine event CSV export

Export a SportsEngine iCalendar feed to `events.csv`:

```sh
python3 sportsengine_export.py 'webcal://ical.sportngin.com/v3/calendar/ical?team_ids=YOUR_TEAM_ID'
```

Choose a different output path with `-o`:

```sh
python3 sportsengine_export.py 'YOUR_CALENDAR_URL' -o schedule.csv
```

The script uses only the Python standard library. It accepts `webcal://`,
`webcals://`, `http://`, and `https://` feed URLs, and converts webcal URLs to
HTTPS before downloading. The CSV includes event IDs, names, start/end times,
all-day status, location, description, event URL, and any recurrence rule.
Each VEVENT is exported as one row; recurring rules are recorded but not
expanded into separate occurrences.

Run the parser tests with:

```sh
python3 -m unittest -v test_sportsengine_export
```
