import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wqfbltrnlwngyohvxjjq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZmJsdHJubHduZ3lvaHZ4ampxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIzODI4MCwiZXhwIjoyMDgxODE0MjgwfQ.ZCaKOuu0Q2OEKrzT88Q0OXiL8gSfx7NBdlsvEwnBftw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addEmploymentTypeColumn() {
  try {
    // Execute raw SQL using the rpc method
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: "ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full Time';"
    });
    
    if (error) {
      console.error('Error executing SQL:', error);
      process.exit(1);
    }
    
    console.log('✅ Successfully added employment_type column to employees table');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

addEmploymentTypeColumn();
