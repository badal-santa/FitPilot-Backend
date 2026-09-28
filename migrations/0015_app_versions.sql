-- Per-platform app version config, edited from the admin panel. The mobile
-- app compares its installed version against these to show an update sheet:
-- below latest_version = optional update, below min_version = forced update.
CREATE TABLE IF NOT EXISTS app_versions (
    platform TEXT PRIMARY KEY CHECK (platform IN ('android', 'ios')),
    latest_version TEXT NOT NULL,
    min_version TEXT NOT NULL,
    store_url TEXT,
    release_notes TEXT,
    updated_by TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_versions (platform, latest_version, min_version, store_url)
VALUES
    ('android', '1.0.0', '1.0.0', 'https://play.google.com/store/apps/details?id=com.anonymous.aihealthfitness'),
    ('ios', '1.0.0', '1.0.0', NULL);
