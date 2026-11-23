PRAGMA foreign_keys = OFF;

ALTER TABLE participants ADD COLUMN default_dish_id TEXT REFERENCES dishes(id) ON DELETE SET NULL;

CREATE TABLE assignments_flexible (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  angelito_recipient_id TEXT NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  food_dish_id TEXT NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  angelito_revealed_at TEXT,
  food_revealed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, participant_id)
);

INSERT INTO assignments_flexible (
  id, event_id, participant_id, angelito_recipient_id, food_dish_id,
  angelito_revealed_at, food_revealed_at, created_at
)
SELECT id, event_id, participant_id, angelito_recipient_id, food_dish_id,
  angelito_revealed_at, food_revealed_at, created_at
FROM assignments;

DROP TABLE assignments;
ALTER TABLE assignments_flexible RENAME TO assignments;

CREATE INDEX IF NOT EXISTS idx_assignments_event ON assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_recipient ON assignments(event_id, angelito_recipient_id);

PRAGMA foreign_keys = ON;
