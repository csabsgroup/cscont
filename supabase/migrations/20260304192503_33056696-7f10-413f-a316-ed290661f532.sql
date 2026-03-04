
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload office logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update office logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete office logos" ON storage.objects;

-- Avatars: scope to own folder (user_id as first path segment)
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Office logos: only admin, manager, or csm can write
CREATE POLICY "Authorized users can upload office logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'office-logos' AND (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'csm')
  ));

CREATE POLICY "Authorized users can update office logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'office-logos' AND (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'csm')
  ));

CREATE POLICY "Authorized users can delete office logo" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'office-logos' AND (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'csm')
  ));
