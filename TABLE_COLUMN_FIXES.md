# Table and Column Fixes

## Issues Found and Fixed

### 1. ❌ `hiring_checklists` table not found
**Error**: `Could not find the table 'public.hiring_checklists' in the schema cache`

**Solution**: 
- Created migration `20251221120000_fix_table_columns.sql` that ensures the table exists
- The table should have been created by `20251221000000_create_hiring_checklists.sql`
- **Action Required**: Run the migration in Supabase SQL Editor

### 2. ❌ `documents.folder` column not found
**Error**: `Could not find the 'folder' column of 'documents' in the schema cache`

**Database Schema**: The `documents` table has a `category` column, not `folder`

**Solution**:
- ✅ Added `folder` column to `documents` table in migration
- ✅ Updated `documentService.ts` to:
  - Use `category` as the primary database column
  - Map `category` to `folder` in responses for frontend compatibility
  - Set both `category` and `folder` when creating documents

**Migration**: Adds `folder` column and syncs with existing `category` data

### 3. ❌ `candidates.position` column not found
**Error**: `Could not find the 'position' column of 'candidates' in the schema cache`

**Database Schema**: The `candidates` table has a `role` column, not `position`

**Solution**:
- ✅ Added `position` column to `candidates` table in migration
- ✅ Updated `recruitmentService.ts` to:
  - Use `role` as the primary database column
  - Map `role` to `position` in responses for frontend compatibility
  - Set both `role` and `position` when creating candidates
  - Map `stage` to `status` for frontend compatibility

**Migration**: Adds `position` column and syncs with existing `role` data

## Migration File

**File**: `supabase/migrations/20251221120000_fix_table_columns.sql`

This migration:
1. Adds `folder` column to `documents` table
2. Adds `position` column to `candidates` table
3. Ensures `hiring_checklists` table exists with all required columns and policies
4. Syncs existing data (copies `category` → `folder`, `role` → `position`)

## How to Apply

### Option 1: Using Supabase CLI
```bash
supabase db push
```

### Option 2: Manual SQL Execution
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20251221120000_fix_table_columns.sql`
3. Paste and execute

### Option 3: Using Supabase Management API
The migration can be executed via the API if you have the access token.

## Code Changes Made

### `client/src/services/documentService.ts`
- ✅ Updated interface to include both `folder` and `category`
- ✅ Maps `category` → `folder` in `getAll()` response
- ✅ Sets both `category` and `folder` when creating documents

### `client/src/services/recruitmentService.ts`
- ✅ Updated interface to include `position`, `role`, and `stage`
- ✅ Maps `role` → `position` and `stage` → `status` in `getAll()` response
- ✅ Uses `role` and `stage` for database operations
- ✅ Maps responses back to `position` and `status` for frontend

## Verification

After applying the migration, verify:

1. **hiring_checklists table exists**:
   ```sql
   SELECT * FROM hiring_checklists LIMIT 1;
   ```

2. **documents table has folder column**:
   ```sql
   SELECT id, name, category, folder FROM documents LIMIT 1;
   ```

3. **candidates table has position column**:
   ```sql
   SELECT id, name, role, position, stage FROM candidates LIMIT 1;
   ```

## Summary

| Table | Missing Column | Database Column | Status |
|-------|---------------|-----------------|--------|
| `hiring_checklists` | Table missing | - | ✅ Fixed in migration |
| `documents` | `folder` | `category` | ✅ Added + mapped |
| `candidates` | `position` | `role` | ✅ Added + mapped |

All issues should be resolved after running the migration!


