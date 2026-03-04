
-- Add new activity types to enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'ligacao';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'check_in';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'planejamento';

-- Add observations column to activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS observations text;

-- Create activity_checklists table
CREATE TABLE public.activity_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_checklists ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage checklists for their own activities
CREATE POLICY "Users can manage own activity checklists"
  ON public.activity_checklists
  FOR ALL
  USING (
    activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
  )
  WITH CHECK (
    activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin can manage all checklists"
  ON public.activity_checklists
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
