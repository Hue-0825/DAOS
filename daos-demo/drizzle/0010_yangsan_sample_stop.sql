-- Move one of the two November 9 E-Mart sample orders without changing delivered history.
UPDATE intake
SET destination = 'yssangyong',
    address = '양산신도시쌍용아파트',
    instructions = '시연용 · 단지 담당자에게 인계'
WHERE id = (
  SELECT candidate.id
  FROM intake AS candidate
  LEFT JOIN orders AS dispatched ON dispatched.id = candidate.id
  WHERE candidate.id IN ('53f4c3a6-5270-2e4b-0bd6-3934be6475b5', '79326e43-4127-cb1d-80a7-21c6fbc19b1a')
    AND candidate.destination = 'yemart'
    AND NOT EXISTS (
      SELECT 1 FROM events WHERE job_key = candidate.work_date || '/' || candidate.id AND state = 'delivered'
    )
  ORDER BY dispatched.revision IS NOT NULL, candidate.created_at DESC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM intake
  WHERE id IN ('53f4c3a6-5270-2e4b-0bd6-3934be6475b5', '79326e43-4127-cb1d-80a7-21c6fbc19b1a')
    AND destination = 'yssangyong'
);
--> statement-breakpoint
UPDATE control
SET revision = revision + 1
WHERE id = 1 AND EXISTS (
  SELECT 1 FROM orders JOIN intake USING (id)
  WHERE orders.id IN ('53f4c3a6-5270-2e4b-0bd6-3934be6475b5', '79326e43-4127-cb1d-80a7-21c6fbc19b1a')
    AND orders.destination = 'yemart' AND intake.destination = 'yssangyong'
);
--> statement-breakpoint
UPDATE orders
SET destination = 'yssangyong',
    instructions = '양산신도시쌍용아파트 · 시연용 · 단지 담당자에게 인계',
    revision = CASE WHEN revision IS NOT NULL THEN (SELECT revision FROM control WHERE id = 1) END
WHERE destination = 'yemart' AND id IN (
  SELECT id FROM intake
  WHERE id IN ('53f4c3a6-5270-2e4b-0bd6-3934be6475b5', '79326e43-4127-cb1d-80a7-21c6fbc19b1a')
    AND destination = 'yssangyong'
);
