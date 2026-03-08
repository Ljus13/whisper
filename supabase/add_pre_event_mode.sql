-- Pre-event Mode — seed site_settings key
-- Run after add_maintenance_mode.sql

INSERT INTO site_settings (key, value)
VALUES ('pre_event_mode', '{"enabled": false, "web_note": ""}')
ON CONFLICT (key) DO NOTHING;
