-- Multi-day event excluded dates (e.g. skip weekends within a vacation range)
-- Migration: 0013_event_excluded_dates

ALTER TABLE events ADD COLUMN excluded_dates_json TEXT;
