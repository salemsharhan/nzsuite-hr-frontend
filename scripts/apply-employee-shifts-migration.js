/**
 * Script to apply the employee_shifts migration via Supabase API
 * Run this with: node scripts/apply-employee-shifts-migration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251223000000_create_employee_shifts.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying employee_shifts migration...');
    console.log('Migration file:', migrationPath);

    // Execute SQL via Supabase REST API (using rpc if available) or direct SQL execution
    // Note: Supabase REST API doesn't support arbitrary SQL execution
    // We'll need to use the Supabase Management API or execute via psql
    
    // Alternative: Use Supabase Management API to execute SQL
    const response = await axios.post(
      `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      { sql: migrationSQL },
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('Migration applied successfully!');
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error applying migration:', error.response.data);
    } else if (error.request) {
      console.error('No response received. The Supabase REST API may not support direct SQL execution.');
      console.error('\nPlease apply the migration manually:');
      console.error('1. Go to your Supabase Dashboard');
      console.error('2. Navigate to SQL Editor');
      console.error('3. Copy and paste the contents of:');
      console.error('   supabase/migrations/20251223000000_create_employee_shifts.sql');
      console.error('4. Execute the SQL');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

applyMigration();


