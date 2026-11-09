ALTER TABLE orders ADD COLUMN province TEXT NOT NULL DEFAULT '경상남도';
--> statement-breakpoint
CREATE INDEX orders_province_work ON orders(province, work_date, segment, revision);
--> statement-breakpoint
CREATE TABLE province_receipt (province TEXT PRIMARY KEY, revision INTEGER NOT NULL, saved_at TEXT NOT NULL);
--> statement-breakpoint
INSERT INTO province_receipt SELECT '경상남도', revision, saved_at FROM receipt WHERE id = 1;
