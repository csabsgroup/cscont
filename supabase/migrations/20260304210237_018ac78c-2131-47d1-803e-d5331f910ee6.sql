
-- Add missing columns to offices
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS first_signature_date date;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS faturamento_mensal numeric;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS faturamento_anual numeric;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS qtd_clientes integer;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS qtd_colaboradores integer;

-- Add missing columns to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS contact_type text;
