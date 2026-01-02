import axios from 'axios';

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

async function addUser() {
  const userId = 'bb55785c-028f-4e76-917a-e9d0b63330b5';
  const email = 'superadmin@nzsuite.com';
  const role = 'super_admin'; // or 'admin', 'employee'
  
  console.log(`🚀 Adding user to user_roles table...\n`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Email: ${email}`);
  console.log(`   Role: ${role}\n`);
  
  // Get or create Super Admin role for role_id
  const getRoleSQL = `
    SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1;
  `;
  
  let roleId = null;
  const roleResult = await executeSQL(getRoleSQL);
  
  if (roleResult.success && roleResult.data && roleResult.data.length > 0) {
    roleId = roleResult.data[0].id;
  } else {
    const createRoleSQL = `
      INSERT INTO roles (name, code, description, is_active)
      VALUES ('Super Admin', 'SUPER_ADMIN', 'Super Administrator', TRUE)
      RETURNING id;
    `;
    const createResult = await executeSQL(createRoleSQL);
    if (createResult.success && createResult.data && createResult.data.length > 0) {
      roleId = createResult.data[0].id;
    }
  }
  
  if (!roleId) {
    console.log('❌ Could not get or create role');
    return;
  }
  
  // Insert user into user_roles
  const insertSQL = `
    INSERT INTO user_roles (user_id, role_id, email, role, assigned_by, is_active)
    VALUES 
      ('${userId}', '${roleId}', '${email}', '${role}', 'system', TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = EXCLUDED.is_active
    RETURNING *;
  `;
  
  console.log('⏳ Adding user to user_roles...');
  const result = await executeSQL(insertSQL);
  
  if (result.success) {
    console.log('✅ User added successfully!\n');
    if (result.data && result.data.length > 0) {
      console.table(result.data);
    }
    
    // Verify
    const verifySQL = `
      SELECT email, role, is_active, created_at
      FROM user_roles
      WHERE user_id = '${userId}';
    `;
    
    console.log('\n📋 Verifying user...');
    const verifyResult = await executeSQL(verifySQL);
    if (verifyResult.success && verifyResult.data) {
      console.table(verifyResult.data);
    }
    
    console.log('\n✅ Setup complete!');
    console.log(`\n📋 You can now login with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: (the password you set)`);
    console.log(`   Role: ${role}`);
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
}

addUser().catch(console.error);



