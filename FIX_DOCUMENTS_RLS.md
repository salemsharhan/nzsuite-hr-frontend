# Fix Documents RLS and Storage Access

## Issue
Getting "new row violates row-level security policy" when inserting documents, and 403 when accessing storage files.

## Database RLS Fix (Applied)
✅ Migration `20251225040000_fix_documents_rls_complete.sql` has been applied:
- Drops all existing policies
- Creates permissive policies for `authenticated` role
- Allows `service_role` to bypass RLS
- All authenticated users can now INSERT, SELECT, UPDATE, DELETE documents

## Storage Bucket RLS Fix (Manual Step Required)

The storage bucket also needs RLS policies. Even though you set it to "public", you need to configure the policies:

### Option 1: Make Bucket Fully Public (Easiest)
1. Go to Supabase Dashboard → Storage → `documents` bucket
2. Click on "Policies" tab
3. Add these policies:

**Policy 1: Allow public read access**
```sql
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'documents');
```

**Policy 2: Allow authenticated uploads**
```sql
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');
```

**Policy 3: Allow authenticated updates**
```sql
CREATE POLICY "Authenticated users can update" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');
```

**Policy 4: Allow authenticated deletes**
```sql
CREATE POLICY "Authenticated users can delete" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
```

### Option 2: Use Service Role for Storage (Recommended for Admin Operations)
If you want to use service role for storage operations, update the documentService to use a service role client for storage:

```typescript
// In documentService.ts, create a service role client for storage
import { createClient } from '@supabase/supabase-js';
const supabaseService = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_KEY
);
```

## Test
After applying the storage policies, try uploading a document again. Both the database insert and file access should work.


