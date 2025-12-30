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
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
}

async function runSetup() {
  try {
    console.log('🚀 Setting up user roles...\n');
    
    // Read the simplified SQL file
    const sqlPath = join(__dirname, '..', 'supabase', 'setup_users_simple.sql');
    let sql = readFileSync(sqlPath, 'utf-8');
    
    // Remove comments and empty lines for cleaner execution
    sql = sql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('--') && trimmed !== '';
      })
      .join('\n');
    
    // Split by semicolon but keep DO blocks together
    const statements = [];
    let currentStatement = '';
    let inDoBlock = false;
    let doBlockDepth = 0;
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChars = sql.substring(i, i + 3).toUpperCase();
      
      if (nextChars === 'DO ') {
        inDoBlock = true;
        doBlockDepth = 0;
      }
      
      if (inDoBlock) {
        if (char === '$') {
          // Check for $$ delimiter
          const dollarMatch = sql.substring(i).match(/^\$\$[^$]*\$\$/);
          if (dollarMatch) {
            currentStatement += dollarMatch[0];
            i += dollarMatch[0].length - 1;
            continue;
          }
        }
        if (char === 'E' && sql.substring(i, i + 3).toUpperCase() === 'END') {
          doBlockDepth--;
          if (doBlockDepth === 0) {
            inDoBlock = false;
          }
        }
      }
      
      currentStatement += char;
      
      if (char === ';' && !inDoBlock) {
        const trimmed = currentStatement.trim();
        if (trimmed && trimmed.length > 5) {
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }
    
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute statements that don't have placeholders
    const executed = [];
    const skipped = [];
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip statements with placeholders (they need manual update)
      if (statement.includes('YOUR_ADMIN_USER_ID_HERE') || 
          statement.includes('YOUR_EMPLOYEE_USER_ID_HERE')) {
        skipped.push(statement);
        console.log(`⏭️  Skipping statement ${i + 1} (contains placeholder - needs manual update)\n`);
        continue;
      }
      
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`   ${preview}...`);
      
      const result = await executeSQL(statement);
      
      if (result.success) {
        console.log('✅ Statement executed successfully\n');
        executed.push(statement);
      } else {
        console.log(`⚠️  Statement failed: ${result.error}\n`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Setup Summary:');
    console.log(`   ✅ Executed: ${executed.length} statements`);
    console.log(`   ⏭️  Skipped: ${skipped.length} statements (need manual update)`);
    console.log('='.repeat(60));
    
    if (skipped.length > 0) {
      console.log('\n📋 Next Steps:');
      console.log('1. Go to Supabase Dashboard → Authentication → Users');
      console.log('2. Create users with these emails:');
      console.log('   - admin@company.com');
      console.log('   - employee@company.com');
      console.log('3. Copy the User IDs from Supabase Auth');
      console.log('4. Go to Supabase SQL Editor:');
      console.log(`   https://app.supabase.com/project/${PROJECT_REF}/sql/new`);
      console.log('5. Replace placeholders in supabase/setup_users_simple.sql:');
      console.log('   - YOUR_ADMIN_USER_ID_HERE → actual admin User ID');
      console.log('   - YOUR_EMPLOYEE_USER_ID_HERE → actual employee User ID');
      console.log('6. Copy and paste the updated SQL statements into SQL Editor');
      console.log('7. Click "Run" to execute');
    } else {
      console.log('\n✅ All users have been set up!');
      console.log('\n📋 You can now login with:');
      console.log('   - superadmin1@system.com');
      console.log('   - superadmin2@system.com');
      console.log('   (And admin/employee after completing manual steps)');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

runSetup();

