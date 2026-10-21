"""Tests for the SportsEngine iCalendar CSV exporter."""

import unittest

from sportsengine_export import normalize_calendar_url, parse_events


class CalendarUrlTests(unittest.TestCase):
    def test_webcal_url_uses_https(self):
        self.assertEqual(
            normalize_calendar_url(
                "webcal://ical.sportngin.com/v3/calendar/ical?team_ids=example"
            ),
            "https://ical.sportngin.com/v3/calendar/ical?team_ids=example",
        )


class ParseEventsTests(unittest.TestCase):
    def test_parses_and_unescapes_event_fields(self):
        calendar = (
            "BEGIN:VCALENDAR\r\n"
            "BEGIN:VEVENT\r\n"
            "UID:event-1\r\n"
            "SUMMARY:Practice\\, indoors\r\n"
            "DTSTART;TZID=America/New_York:20261102T180000\r\n"
            "DTEND;TZID=America/New_York:20261102T190000\r\n"
            "LOCATION:Main gym\r\n"
            "DESCRIPTION:Bring a ball\\nand water\r\n"
            "RRULE:FREQ=WEEKLY;BYDAY=MO\r\n"
            "END:VEVENT\r\n"
            "END:VCALENDAR\r\n"
        )

        event = parse_events(calendar)[0]

        self.assertEqual(event["summary"], "Practice, indoors")
        self.assertEqual(event["start"], "2026-11-02T18:00:00-05:00")
        self.assertEqual(event["end"], "2026-11-02T19:00:00-05:00")
        self.assertEqual(event["all_day"], "false")
        self.assertEqual(event["description"], "Bring a ball\nand water")
        self.assertEqual(event["recurrence_rule"], "FREQ=WEEKLY;BYDAY=MO")

    def test_parses_all_day_event_and_folded_lines(self):
        calendar = (
            "BEGIN:VEVENT\n"
            "UID:event-2\n"
            "SUMMARY:A long event \n"
            " description\n"
            "DTSTART;VALUE=DATE:20261225\n"
            "END:VEVENT\n"
        )

        event = parse_events(calendar)[0]

        self.assertEqual(event["summary"], "A long event description")
        self.assertEqual(event["start"], "2026-12-25")
        self.assertEqual(event["all_day"], "true")
        self.assertEqual(event["end"], "")


if __name__ == "__main__":
    unittest.main()
