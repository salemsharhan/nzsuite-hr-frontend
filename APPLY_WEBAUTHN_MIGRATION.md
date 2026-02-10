# Apply WebAuthn Migration

Since Supabase CLI is not installed, you can manually apply the migration by running the SQL in your Supabase dashboard.

## Steps:

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and paste the migration SQL**
   - Open the file: `supabase/migrations/20260104000000_create_webauthn_credentials.sql`
   - Copy all the SQL content
   - Paste it into the SQL Editor

4. **Run the SQL**
   - Click "Run" or press `Ctrl+Enter`
   - Wait for the query to complete

5. **Verify the migration**
   - Go to "Table Editor" in the left sidebar
   - You should see a new table called `webauthn_credentials`
   - Check that `attendance_logs` table has the new columns:
     - `webauthn_verified`
     - `webauthn_credential_id`
     - `webauthn_device_name`

## Alternative: Install Supabase CLI (for future migrations)

If you want to use the CLI for future migrations:

### Windows (using Scoop):
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Windows (using Chocolatey):
```powershell
choco install supabase
```

### Or download directly:
1. Visit: https://github.com/supabase/cli/releases
2. Download the Windows executable
3. Add it to your PATH

Then you can use:
```powershell
supabase link --project-ref your-project-ref
supabase db push
```






