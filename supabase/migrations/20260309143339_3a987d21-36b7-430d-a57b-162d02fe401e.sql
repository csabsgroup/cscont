ALTER TABLE offices ADD COLUMN IF NOT EXISTS installments_overdue integer DEFAULT 0;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS total_overdue_value numeric DEFAULT 0;