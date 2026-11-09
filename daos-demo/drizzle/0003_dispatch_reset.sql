CREATE TABLE dispatch_reset (
  province TEXT NOT NULL, work_date TEXT NOT NULL, revision INTEGER NOT NULL,
  PRIMARY KEY (province, work_date)
);
