import axios from 'axios';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'wqfbltrnlwngyohvxjjq';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_47af015c2abbbcdd29a82d806b62b3a1e47a569e';

async function executeSQL(sql) {
  try {
    console.log('📝 Executing SQL query...');
    
    // Use Supabase Management API to execute SQL
    const response = await axios.post(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      { query: sql },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ SQL executed successfully');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
    throw error;
  }
}

async function setupUsers() {
  try {
    console.log('🚀 Setting up user roles...\n');
    
    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'supabase', 'setup_users.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    // Split SQL into statements (handle DO blocks properly)
    const statements = sql
      .split(/;\s*(?=\n|$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--') || statement.length < 10) {
        continue;
      }
      
      // Add semicolon if not present (for DO blocks)
      const sqlStatement = statement.endsWith(';') ? statement : statement + ';';
      
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`   ${sqlStatement.substring(0, 100)}${sqlStatement.length > 100 ? '...' : ''}`);
      
      try {
        await executeSQL(sqlStatement);
        console.log('✅ Statement executed successfully\n');
      } catch (error) {
        console.log('⚠️  Statement failed, continuing...\n');
        // Continue with next statement
      }
    }
    
    console.log('✅ User setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to Supabase Dashboard → Authentication → Users');
    console.log('2. Create users with emails:');
    console.log('   - superadmin1@system.com');
    console.log('   - superadmin2@system.com');
    console.log('   - admin@company.com');
    console.log('   - employee@company.com');
    console.log('3. Copy the User IDs from Supabase Auth');
    console.log('4. Update the user_id values in supabase/setup_users.sql');
    console.log('5. Run this script again or execute the SQL manually in Supabase SQL Editor');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupUsers();








