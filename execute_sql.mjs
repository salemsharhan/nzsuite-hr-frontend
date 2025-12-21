import axios from 'axios';

const supabaseUrl = 'https://wqfbltrnlwngyohvxjjq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZmJsdHJubHduZ3lvaHZ4ampxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIzODI4MCwiZXhwIjoyMDgxODE0MjgwfQ.ZCaKOuu0Q2OEKrzT88Q0OXiL8gSfx7NBdlsvEwnBftw';

async function addEmploymentTypeColumn() {
  try {
    // First, check if column already exists
    const checkResponse = await axios.get(
      `${supabaseUrl}/rest/v1/employees?select=employment_type&limit=1`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        }
      }
    );
    
    console.log('✅ Column employment_type already exists in employees table');
    process.exit(0);
  } catch (error) {
    if (error.response && error.response.status === 400) {
      // Column doesn't exist, which is expected
      console.log('Column does not exist yet. Need to add it manually via Supabase Dashboard.');
      console.log('');
      console.log('Please execute this SQL in Supabase SQL Editor:');
      console.log('ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT \'Full Time\';');
      process.exit(1);
    } else {
      console.error('Error checking column:', error.message);
      process.exit(1);
    }
  }
}

addEmploymentTypeColumn();
