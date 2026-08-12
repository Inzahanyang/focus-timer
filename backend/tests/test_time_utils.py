"""Fixed-clock boundary tests: the helpers /sessions and /stats share."""

from datetime import datetime

from app.time_utils import parse_utc_timestamp, utc_bounds_for_range


def bounds(range_name, tz, iso_now_utc):
    now = datetime.fromisoformat(iso_now_utc)
    return utc_bounds_for_range(range_name, tz, now)


def test_all_range_has_no_bounds():
    assert bounds("all", "Asia/Seoul", "2026-08-12T05:00:00") is None


def test_week_bounds_seoul_are_local_monday_half_open():
    # 2026-08-12 (Wed) 14:00 KST == 05:00 UTC. Local week: Mon Aug 10 00:00
    # KST -> Mon Aug 17 00:00 KST, i.e. Aug 9 15:00 UTC -> Aug 16 15:00 UTC.
    start, end = bounds("week", "Asia/Seoul", "2026-08-12T05:00:00")
    assert start == datetime(2026, 8, 9, 15, 0, 0)
    assert end == datetime(2026, 8, 16, 15, 0, 0)


def test_monday_midnight_included_next_monday_excluded():
    start, end = bounds("week", "Asia/Seoul", "2026-08-12T05:00:00")
    monday_00_00_kst_utc = datetime(2026, 8, 9, 15, 0, 0)
    next_monday_00_00_kst_utc = datetime(2026, 8, 16, 15, 0, 0)
    assert start <= monday_00_00_kst_utc < end
    assert not (start <= next_monday_00_00_kst_utc < end)


def test_month_bounds_are_first_to_first():
    # Aug in Seoul: Jul 31 15:00 UTC -> Aug 31 15:00 UTC
    start, end = bounds("month", "Asia/Seoul", "2026-08-12T05:00:00")
    assert start == datetime(2026, 7, 31, 15, 0, 0)
    assert end == datetime(2026, 8, 31, 15, 0, 0)


def test_dst_spring_forward_week_is_167_hours():
    # US DST starts Sun 2026-03-08 (America/New_York). Week Mon Mar 2 ->
    # Mon Mar 9 local. EST(-5) start, EDT(-4) end => 167 hours in UTC.
    start, end = bounds("week", "America/New_York", "2026-03-04T12:00:00")
    hours = (end - start).total_seconds() / 3600
    assert hours == 167


def test_dst_fall_back_week_is_169_hours():
    # US DST ends Sun 2026-11-01. Week Mon Oct 26 -> Mon Nov 2 local.
    start, end = bounds("week", "America/New_York", "2026-10-28T12:00:00")
    hours = (end - start).total_seconds() / 3600
    assert hours == 169


def test_extreme_timezone_offsets():
    # UTC+14 (Pacific/Kiritimati): local Wed Aug 12 02:00 on Aug 11 12:00 UTC
    start, end = bounds("week", "Pacific/Kiritimati", "2026-08-11T12:00:00")
    assert (end - start).total_seconds() == 7 * 24 * 3600
    assert start == datetime(2026, 8, 9, 10, 0, 0)  # Mon 00:00 local == Sun 10:00 UTC


def test_parse_utc_timestamp_variants():
    assert parse_utc_timestamp("2026-08-12T05:00:00Z") == datetime(2026, 8, 12, 5, 0, 0)
    assert parse_utc_timestamp("2026-08-12T14:00:00+09:00") == datetime(
        2026, 8, 12, 5, 0, 0
    )
    # bare timestamps are treated as UTC
    assert parse_utc_timestamp("2026-08-12T05:00:00") == datetime(2026, 8, 12, 5, 0, 0)
    # millisecond precision from JS toISOString()
    assert parse_utc_timestamp("2026-08-12T05:00:00.123Z") == datetime(
        2026, 8, 12, 5, 0, 0, 123000
    )
    for bad in ("not-a-date", "", None, 5, "2026-13-40T99:00:00Z"):
        assert parse_utc_timestamp(bad) is None
