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

async function setupAllUsers() {
  console.log('🚀 Setting up all user roles...\n');
  
  // Get or create Super Admin role
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
    console.log('❌ Could not get or create Super Admin role');
    return;
  }
  
  console.log(`✅ Using role_id: ${roleId}\n`);
  
  // Super Admin 1
  const sql1 = `
    INSERT INTO user_roles (user_id, role_id, email, role, assigned_by, is_active)
    VALUES 
      ('6a871b7a-7a5d-4279-a0d8-ed08a86ddb14', '${roleId}', 'superadmin1@system.com', 'super_admin', 'system', TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = EXCLUDED.is_active;
  `;
  
  console.log('⏳ Super Admin 1...');
  await executeSQL(sql1);
  
  // Super Admin 2
  const sql2 = `
    INSERT INTO user_roles (user_id, role_id, email, role, assigned_by, is_active)
    VALUES 
      ('9bc41165-a26f-4662-ad4c-0222a541f99b', '${roleId}', 'superadmin2@system.com', 'super_admin', 'system', TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = EXCLUDED.is_active;
  `;
  
  console.log('⏳ Super Admin 2...');
  await executeSQL(sql2);
  
  // Verify
  const verifySQL = `
    SELECT email, role, is_active
    FROM user_roles
    WHERE role IN ('super_admin', 'admin', 'employee')
    ORDER BY role, email;
  `;
  
  console.log('\n📋 Current Users:');
  const verifyResult = await executeSQL(verifySQL);
  if (verifyResult.success && verifyResult.data) {
    console.table(verifyResult.data);
  }
  
  console.log('\n✅ Setup complete!');
  console.log('\n📋 To login:');
  console.log('1. Create users in Supabase Auth Dashboard with matching emails');
  console.log('2. Go to /login and use the email/password');
  console.log('3. Super Admin users are ready (just create in Auth)');
  console.log('4. For Admin/Employee, create in Auth then run SQL from QUICK_LOGIN_GUIDE.md');
}

setupAllUsers().catch(console.error);


