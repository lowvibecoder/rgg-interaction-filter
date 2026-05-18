CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  date_added BIGINT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_login TEXT NOT NULL,
  action_type TEXT NOT NULL,
  note TEXT,
  raw_text TEXT NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interaction_recipients (
  interaction_id TEXT REFERENCES interactions(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_login TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_date_added ON interactions(date_added DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_sender ON interactions(sender_name);
CREATE INDEX IF NOT EXISTS idx_interactions_action ON interactions(action_type);
CREATE INDEX IF NOT EXISTS idx_interactions_date_sender_action ON interactions(date_added DESC, sender_name, action_type);
CREATE INDEX IF NOT EXISTS idx_recipients_interaction ON interaction_recipients(interaction_id);
CREATE INDEX IF NOT EXISTS idx_recipients_name ON interaction_recipients(recipient_name);
CREATE INDEX IF NOT EXISTS idx_recipients_name_interaction ON interaction_recipients(recipient_name, interaction_id);

CREATE TABLE IF NOT EXISTS game_items (
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  icon TEXT DEFAULT '',
  PRIMARY KEY (name, source)
);

CREATE INDEX IF NOT EXISTS idx_game_items_name ON game_items(name);

CREATE TABLE IF NOT EXISTS player_items (
  player_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_name, item_name, item_type)
);

CREATE INDEX IF NOT EXISTS idx_player_items_name ON player_items(item_name);
CREATE INDEX IF NOT EXISTS idx_player_items_player ON player_items(player_name);

CREATE TABLE IF NOT EXISTS player_overview (
  player_name TEXT PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 0,
  tears INTEGER NOT NULL DEFAULT 0,
  effects INTEGER NOT NULL DEFAULT 0,
  items INTEGER NOT NULL DEFAULT 0,
  special_rolls INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
