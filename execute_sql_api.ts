import axios from 'axios';

const PROJECT_REF = 'wqfbltrnlwngyohvxjjq';
const ACCESS_TOKEN = 'sbp_47af015c2abbbcdd29a82d806b62b3a1e47a569e';

const sql = `ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Full Time';`;

async function run() {
  try {
    const response = await axios.post(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/query`,
      { query: sql },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Success:', response.data);
  } catch (error: any) {
    console.error('Error:', error.response?.status, error.response?.data);
  }
}

run();
