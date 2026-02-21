CREATE SCHEMA IF NOT EXISTS wuphf;

CREATE SEQUENCE IF NOT EXISTS wuphf.notification_number_seq
    START WITH 1000
    INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS wuphf.notifications (
    notification_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    deep_link TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ NULL,
    source_event_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_wuphf_notifications_user_created
    ON wuphf.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wuphf_notifications_user_unread
    ON wuphf.notifications (user_id, is_read, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wuphf_notifications_user_event
    ON wuphf.notifications (user_id, source_event_id)
    WHERE source_event_id IS NOT NULL;
