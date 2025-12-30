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

async function setupSuperAdmins() {
  console.log('🚀 Setting up Super Admin users...\n');
  
  // First, check if we need to create a role or get existing role_id
  // The table requires role_id, so we need to handle this
  
  // Option 1: Try to get or create a super_admin role in roles table
  const getRoleSQL = `
    SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1;
  `;
  
  console.log('📋 Checking for Super Admin role...');
  const roleResult = await executeSQL(getRoleSQL);
  
  let roleId = null;
  if (roleResult.success && roleResult.data && roleResult.data.length > 0) {
    roleId = roleResult.data[0].id;
    console.log(`✅ Found Super Admin role: ${roleId}\n`);
  } else {
    // Create Super Admin role if it doesn't exist
    console.log('📝 Creating Super Admin role...');
    const createRoleSQL = `
      INSERT INTO roles (name, code, description, is_active)
      VALUES ('Super Admin', 'SUPER_ADMIN', 'Super Administrator with full system access', TRUE)
      ON CONFLICT (name) DO NOTHING
      RETURNING id;
    `;
    const createResult = await executeSQL(createRoleSQL);
    if (createResult.success && createResult.data && createResult.data.length > 0) {
      roleId = createResult.data[0].id;
      console.log(`✅ Created Super Admin role: ${roleId}\n`);
    } else {
      // Try to get any role as fallback
      const fallbackSQL = `SELECT id FROM roles LIMIT 1;`;
      const fallbackResult = await executeSQL(fallbackSQL);
      if (fallbackResult.success && fallbackResult.data && fallbackResult.data.length > 0) {
        roleId = fallbackResult.data[0].id;
        console.log(`⚠️  Using fallback role: ${roleId}\n`);
      }
    }
  }
  
  if (!roleId) {
    console.log('❌ Could not find or create a role. Please create a role first in the roles table.');
    return;
  }
  
  // Super Admin 1
  const sql1 = `
    INSERT INTO user_roles (user_id, role_id, email, role, assigned_by, is_active)
    VALUES 
      ('6a871b7a-7a5d-4279-a0d8-ed08a86ddb14', '${roleId}', 'superadmin1@system.com', 'super_admin', 'system', TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = EXCLUDED.is_active;
  `;
  
  console.log('⏳ Setting up Super Admin 1...');
  const result1 = await executeSQL(sql1);
  if (result1.success) {
    console.log('✅ Super Admin 1 setup successful\n');
  } else {
    console.log(`⚠️  Super Admin 1 setup failed: ${result1.error}\n`);
  }
  
  // Super Admin 2
  const sql2 = `
    INSERT INTO user_roles (user_id, role_id, email, role, assigned_by, is_active)
    VALUES 
      ('9bc41165-a26f-4662-ad4c-0222a541f99b', '${roleId}', 'superadmin2@system.com', 'super_admin', 'system', TRUE)
    ON CONFLICT (user_id) DO UPDATE 
    SET email = EXCLUDED.email, role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = EXCLUDED.is_active;
  `;
  
  console.log('⏳ Setting up Super Admin 2...');
  const result2 = await executeSQL(sql2);
  if (result2.success) {
    console.log('✅ Super Admin 2 setup successful\n');
  } else {
    console.log(`⚠️  Super Admin 2 setup failed: ${result2.error}\n`);
  }
  
  // Verify
  const verifySQL = `
    SELECT ur.email, ur.role, ur.is_active, ur.created_at
    FROM user_roles ur
    WHERE ur.role = 'super_admin'
    ORDER BY ur.email;
  `;
  
  console.log('📋 Verifying Super Admin users...');
  const verifyResult = await executeSQL(verifySQL);
  if (verifyResult.success && verifyResult.data) {
    console.log('\n✅ Super Admin Users:');
    console.table(verifyResult.data);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Super Admin setup completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. Go to Supabase Dashboard → Authentication → Users');
  console.log('2. Create users with these emails:');
  console.log('   - superadmin1@system.com');
  console.log('   - superadmin2@system.com');
  console.log('3. Use the User IDs:');
  console.log('   - 6a871b7a-7a5d-4279-a0d8-ed08a86ddb14');
  console.log('   - 9bc41165-a26f-4662-ad4c-0222a541f99b');
  console.log('4. Login at /login with email and password');
  console.log('='.repeat(60));
}

setupSuperAdmins().catch(error => {
  console.error('❌ Setup failed:', error.message);
  process.exit(1);
});

