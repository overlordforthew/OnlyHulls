ALTER TABLE introductions
  ADD COLUMN IF NOT EXISTS seller_stage VARCHAR(20) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS seller_notes TEXT,
  ADD COLUMN IF NOT EXISTS seller_last_contacted_at TIMESTAMPTZ;

UPDATE introductions
SET seller_stage = CASE
  WHEN status = 'declined' THEN 'closed_lost'
  ELSE 'new'
END
WHERE seller_stage IS NULL OR seller_stage = '';

ALTER TABLE introductions
  DROP CONSTRAINT IF EXISTS introductions_seller_stage_check;

ALTER TABLE introductions
  ADD CONSTRAINT introductions_seller_stage_check
  CHECK (seller_stage IN ('new', 'contacted', 'qualified', 'negotiating', 'closed_won', 'closed_lost'));

CREATE INDEX IF NOT EXISTS idx_introductions_seller_stage ON introductions(seller_stage);
