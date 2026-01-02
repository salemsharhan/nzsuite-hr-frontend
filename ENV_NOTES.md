# Environment Variables - Important Notes

## ⚠️ Project Discrepancy Found

Your codebase references **two different Supabase projects**:

1. **Primary Project (used in setup scripts):**
   - Project Ref: `wqfbltrnlwngyohvxjjq`
   - URL: `https://wqfbltrnlwngyohvxjjq.supabase.co`
   - Service Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZmJsdHJubHduZ3lvaHZ4ampxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIzODI4MCwiZXhwIjoyMDgxODE0MjgwfQ.ZCaKOuu0Q2OEKrzT88Q0OXiL8gSfx7NBdlsvEwnBftw`
   - Used in: `package.json`, `scripts/setup-supabase.js`, `scripts/setup-supabase-direct.js`, `execute_sql.mjs`, `add_employment_type.mjs`

2. **Secondary Project (used in client service):**
   - Project Ref: `hlcobldukxhxscqmvcgi`
   - URL: `https://hlcobldukxhxscqmvcgi.supabase.co`
   - Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY29ibGR1a3hoc3hjcW12Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzE4NDEsImV4cCI6MjA4MTgwNzg0MX0.zNhSF6Q5wGsC7bhL2TZLRmCqay_0JWTYD0xQuEzYcgA`
   - Used in: `client/src/services/supabase.ts`, `client/src/pages/SetupPage.tsx`

## ✅ Recommended Action

**Use the primary project (`wqfbltrnlwngyohvxjjq`)** since it's referenced in:
- `package.json` scripts
- All setup scripts
- Migration scripts

**Update `client/src/services/supabase.ts`** to use the same project URL, or get the anon key for `wqfbltrnlwngyohvxjjq` from your Supabase dashboard.

## 📋 Values Already in .env

The `.env` file has been prepared with:
- ✅ `VITE_SUPABASE_URL` = `https://wqfbltrnlwngyohvxjjq.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = (service key from your scripts)
- ✅ `VITE_SUPABASE_SERVICE_KEY` = (same service key)
- ⚠️ `VITE_SUPABASE_ANON_KEY` = **YOU NEED TO GET THIS** from Supabase Dashboard

## 🔗 Get Missing Values

1. **Get Anon Key:**
   - Go to: https://app.supabase.com/project/wqfbltrnlwngyohvxjjq/settings/api
   - Copy the "anon" or "public" key
   - Replace `YOUR_ANON_KEY_FROM_DASHBOARD` in `.env`

2. **Get Database Password:**
   - Go to: https://app.supabase.com/project/wqfbltrnlwngyohvxjjq/settings/database
   - Copy your database password
   - Replace `YOUR_DB_PASSWORD` in `DATABASE_URL`

## 🔄 Alternative: Use Secondary Project

If you want to use the project from `supabase.ts` (`hlcobldukxhxscqmvcgi`), update your `.env`:

```env
VITE_SUPABASE_URL=https://hlcobldukxhxscqmvcgi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY29ibGR1a3hoc3hjcW12Y2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzE4NDEsImV4cCI6MjA4MTgwNzg0MX0.zNhSF6Q5wGsC7bhL2TZLRmCqay_0JWTYD0xQuEzYcgA
```

But you'll also need to:
- Update `package.json` scripts
- Update all setup scripts
- Get the service role key for this project




