
CREATE POLICY "Authenticated can update event covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-covers')
WITH CHECK (bucket_id = 'event-covers');
