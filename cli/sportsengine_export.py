#!/usr/bin/env python3
"""Export events from a SportsEngine iCalendar feed to CSV."""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import date, datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


CSV_FIELDS = (
    "uid",
    "summary",
    "start",
    "end",
    "all_day",
    "location",
    "description",
    "url",
    "recurrence_rule",
)


def normalize_calendar_url(url: str) -> str:
    parts = urlsplit(url)
    if parts.scheme.lower() in {"webcal", "webcals"}:
        parts = parts._replace(scheme="https")
    elif parts.scheme.lower() not in {"http", "https"}:
        raise ValueError("Calendar URL must use webcal, webcals, http, or https")
    return urlunsplit(parts)


def fetch_calendar(url: str) -> str:
    request = Request(
        normalize_calendar_url(url),
        headers={"User-Agent": "sportsengine-csv-export/1.0"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not download calendar: {exc}") from exc


def unfold_lines(calendar: str) -> list[str]:
    lines: list[str] = []
    for line in calendar.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if line.startswith((" ", "\t")) and lines:
            lines[-1] += line[1:]
        else:
            lines.append(line)
    return lines


def unescape_text(value: str) -> str:
    return (
        value.replace("\\n", "\n")
        .replace("\\N", "\n")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
    )


def parse_datetime(property_line: str) -> tuple[str, bool]:
    name_and_params, value = property_line.split(":", 1)
    params = {}
    for parameter in name_and_params.split(";")[1:]:
        if "=" in parameter:
            key, parameter_value = parameter.split("=", 1)
            params[key.upper()] = parameter_value.strip('"')

    if params.get("VALUE", "").upper() == "DATE" or (
        len(value) == 8 and value.isdigit()
    ):
        return date.fromisoformat(
            f"{value[:4]}-{value[4:6]}-{value[6:]}"
        ).isoformat(), True

    is_utc = value.endswith("Z")
    date_value = value[:-1] if is_utc else value
    parsed = datetime.strptime(date_value, "%Y%m%dT%H%M%S")
    if is_utc:
        parsed = parsed.replace(tzinfo=timezone.utc)
    elif "TZID" in params:
        try:
            parsed = parsed.replace(tzinfo=ZoneInfo(params["TZID"]))
        except ZoneInfoNotFoundError as exc:
            raise ValueError(f"Unknown timezone in {name_and_params}") from exc
    return parsed.isoformat(), False


def parse_events(calendar: str) -> list[dict[str, str]]:
    events: list[dict[str, str]] = []
    current: dict[str, str] | None = None

    for line in unfold_lines(calendar):
        if line == "BEGIN:VEVENT":
            if current is not None:
                raise ValueError("Nested VEVENT component")
            current = {}
            continue
        if line == "END:VEVENT":
            if current is None:
                raise ValueError("END:VEVENT without matching BEGIN:VEVENT")
            if "DTSTART" in current:
                current["start"], is_all_day = parse_datetime(current["DTSTART"])
                current["all_day"] = str(is_all_day).lower()
                if "DTEND" in current:
                    current["end"], _ = parse_datetime(current["DTEND"])
                else:
                    current["end"] = ""
                for field in ("summary", "location", "description"):
                    current[field] = unescape_text(current.get(field, ""))
                events.append(
                    {
                        field: current.get(field, "")
                        for field in CSV_FIELDS
                    }
                )
            current = None
            continue
        if current is not None and ":" in line:
            name_and_params, value = line.split(":", 1)
            name = name_and_params.split(";", 1)[0].upper()
            field = {
                "UID": "uid",
                "SUMMARY": "summary",
                "DTSTART": "DTSTART",
                "DTEND": "DTEND",
                "LOCATION": "location",
                "DESCRIPTION": "description",
                "URL": "url",
                "RRULE": "recurrence_rule",
            }.get(name)
            if field is not None:
                current[field] = (
                    line if name in {"DTSTART", "DTEND"} else value
                )

    if current is not None:
        raise ValueError("VEVENT is missing END:VEVENT")
    return events


def write_csv(events: list[dict[str, str]], output: str) -> None:
    with open(output, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(events)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export a SportsEngine iCalendar feed to a CSV file."
    )
    parser.add_argument(
        "calendar_url",
        help="SportsEngine calendar URL (webcal:// and https:// are supported)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="events.csv",
        help="output CSV path (default: events.csv)",
    )
    args = parser.parse_args()

    try:
        events = parse_events(fetch_calendar(args.calendar_url))
        write_csv(events, args.output)
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Exported {len(events)} events to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
