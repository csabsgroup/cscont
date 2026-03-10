
-- Add asaas_last_sync column to offices
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS asaas_last_sync timestamp with time zone;

-- Create asaas_payments table
CREATE TABLE public.asaas_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_id text NOT NULL,
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  net_value numeric,
  due_date date NOT NULL,
  payment_date date,
  status text NOT NULL,
  status_label text,
  billing_type text,
  description text,
  invoice_url text,
  bank_slip_url text,
  days_overdue integer NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  is_overdue boolean NOT NULL DEFAULT false,
  is_pending boolean NOT NULL DEFAULT false,
  is_cancelled boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asaas_payments_asaas_id_unique UNIQUE (asaas_id)
);

-- Indexes
CREATE INDEX idx_asaas_payments_office_id ON public.asaas_payments(office_id);
CREATE INDEX idx_asaas_payments_status ON public.asaas_payments(status);
CREATE INDEX idx_asaas_payments_due_date ON public.asaas_payments(due_date);
CREATE INDEX idx_asaas_payments_office_overdue ON public.asaas_payments(office_id) WHERE is_overdue = true;

-- Enable RLS
ALTER TABLE public.asaas_payments ENABLE ROW LEVEL SECURITY;

-- RLS: read for visible offices
CREATE POLICY "Users see payments of visible offices"
  ON public.asaas_payments FOR SELECT
  TO authenticated
  USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));

-- RLS: service role handles inserts/updates/deletes (no authenticated policy needed)
