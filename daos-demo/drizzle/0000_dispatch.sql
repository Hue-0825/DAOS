CREATE TABLE control (id INTEGER PRIMARY KEY, online INTEGER NOT NULL, revision INTEGER NOT NULL);
--> statement-breakpoint
INSERT INTO control VALUES (1, 1, 0);
--> statement-breakpoint
CREATE TABLE orders (
  id TEXT PRIMARY KEY, work_date TEXT NOT NULL, segment INTEGER NOT NULL,
  title TEXT NOT NULL, cargo TEXT NOT NULL, destination TEXT NOT NULL,
  instructions TEXT NOT NULL, revision INTEGER
);
--> statement-breakpoint
CREATE TABLE events (
  id TEXT PRIMARY KEY, mode TEXT NOT NULL, job_key TEXT NOT NULL, work_date TEXT NOT NULL,
  state TEXT NOT NULL, recorded_at TEXT NOT NULL, UNIQUE(mode, job_key, state)
);
--> statement-breakpoint
CREATE TABLE receipt (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, saved_at TEXT NOT NULL);
