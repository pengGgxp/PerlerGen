DROP TABLE IF EXISTS access_logs;
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  details TEXT,
  ip TEXT,
  country TEXT,
  user_agent TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);
