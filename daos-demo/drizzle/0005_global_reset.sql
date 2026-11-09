ALTER TABLE control ADD COLUMN reset_revision INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE demo_reset_archive AS SELECT * FROM intake WHERE 0;
--> statement-breakpoint
CREATE UNIQUE INDEX demo_reset_archive_id ON demo_reset_archive(id);
