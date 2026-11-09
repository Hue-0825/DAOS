CREATE TABLE intake (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, work_date TEXT NOT NULL,
  province TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL,
  recipient TEXT NOT NULL, product TEXT NOT NULL, quantity INTEGER NOT NULL,
  instructions TEXT NOT NULL, destination TEXT, region TEXT, segment INTEGER
);
--> statement-breakpoint
CREATE INDEX intake_hub_date ON intake(province, work_date, segment);
