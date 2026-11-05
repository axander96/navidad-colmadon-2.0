CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_dishes_event ON dishes(event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_event ON assignments(event_id);
