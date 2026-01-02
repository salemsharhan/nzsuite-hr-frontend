# Companies & API Integration Implementation

## Overview
Implemented a multi-company system that allows external applications (like Hospital Management Systems) to share employee data via API integration. Each company can either manually add employees or automatically sync them from external systems.

## Database Schema

### Tables Created

#### 1. **companies** Table
- `id` (UUID, Primary Key)
- `name` (TEXT, Unique, Required)
- `code` (TEXT, Unique, Optional) - Company code (e.g., "HMS-001")
- `description` (TEXT, Optional)
- `api_endpoint` (TEXT, Optional) - External API endpoint to fetch employees
- `api_key` (TEXT, Optional) - API key for authentication
- `api_secret` (TEXT, Optional) - API secret for authentication
- `sync_enabled` (BOOLEAN, Default: FALSE) - Enable automatic sync
- `sync_frequency` (TEXT, Default: 'manual') - daily, weekly, monthly, manual
- `last_sync_at` (TIMESTAMPTZ, Optional)
- `sync_status` (TEXT, Default: 'idle') - idle, syncing, success, error
- `sync_error_message` (TEXT, Optional)
- `is_active` (BOOLEAN, Default: TRUE)
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 2. **company_admins** Table
- `id` (UUID, Primary Key)
- `company_id` (UUID, Foreign Key → companies.id, Required)
- `email` (TEXT, Unique, Required)
- `password_hash` (TEXT, Required) - Hashed password
- `first_name` (TEXT, Optional)
- `last_name` (TEXT, Optional)
- `is_active` (BOOLEAN, Default: TRUE)
- `last_login_at` (TIMESTAMPTZ, Optional)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### Employees Table Updates
- `company_id` (UUID → companies.id) - Associates employee with company
- `external_id` (TEXT) - ID from external system
- `synced_from_external` (BOOLEAN, Default: FALSE) - Flag if synced from API
- `last_synced_at` (TIMESTAMPTZ) - Last sync timestamp

## Features

### 1. Company Management
- Create companies with API integration settings
- Edit company details and API configuration
- Delete companies (cascades to employees and admins)
- View sync status and history

### 2. Admin Account Creation
When creating a company, an admin account is automatically created with:
- Email and password
- First name and last name (optional)
- Access to company-specific data

### 3. API Integration
- **API Key Authentication**: Each company has a unique API key
- **Sync Frequency**: Configurable (manual, daily, weekly, monthly)
- **Manual Sync**: Trigger sync from UI
- **Automatic Sync**: Scheduled syncs based on frequency

### 4. Employee Data Sync
- External systems can push employee data via API
- Employees are matched by `external_id` to prevent duplicates
- Supports full employee data mapping
- Department, Role, and Job matching by name

## API Integration

### Endpoint
**POST** `/api/employees/sync-external`

### Request Format
```json
{
  "company_id": "uuid-of-company",
  "api_key": "your-api-key",
  "employees": [
    {
      "external_id": "HMS-001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@hospital.com",
      "phone": "+965 1234 5678",
      "department": "Engineering",
      "role": "Engineer",
      "job": "Software Engineer",
      "employment_type": "Full Time",
      "join_date": "2023-01-15",
      "status": "Active"
    }
  ]
}
```

### Response Format
```json
{
  "success": true,
  "message": "Employees synced successfully",
  "created": 2,
  "updated": 0,
  "errors": []
}
```

See `API_INTEGRATION_GUIDE.md` for complete documentation.

## Services Created

### 1. `companyService.ts`
- `getAll()` - Get all active companies
- `getById(id)` - Get company by ID
- `create(companyData)` - Create company with admin account
- `update(id, updates)` - Update company
- `delete(id)` - Delete company
- `syncEmployees(companyId)` - Manual sync employees
- `getAdmins(companyId)` - Get company admins

### 2. `employeeSyncService.ts`
- `syncFromExternal()` - Sync employees from external API
- `manualSync()` - Manual sync from company API endpoint
- `transformExternalEmployee()` - Transform external data to internal format

## UI Implementation

### Settings Page - Companies Tab
Located at: **Settings → Companies**

#### Features:
1. **Company List**
   - Display all companies with name, code, and status
   - Show API endpoint and sync status
   - Display last sync timestamp
   - Show sync errors if any

2. **Add Company**
   - Company details (name, code, description)
   - API integration settings (endpoint, key, secret)
   - Sync configuration (frequency, auto-sync)
   - Admin account creation (email, password, name)

3. **Edit Company**
   - Update company details
   - Modify API settings
   - Change sync configuration

4. **Actions**
   - **Copy API Key**: Copy API key to clipboard
   - **Sync Now**: Manually trigger employee sync
   - **Edit**: Modify company settings
   - **Delete**: Remove company and all associated data

## Usage Flow

### Creating a Company
1. Go to **Settings → Companies**
2. Click **"Add Company"**
3. Fill in company details:
   - Company name and code
   - Description (optional)
4. Configure API integration:
   - API endpoint (if external system will be called)
   - API key (auto-generated or manual)
   - API secret (optional)
   - Sync frequency
   - Enable auto-sync
5. Create admin account:
   - Admin email
   - Admin password
   - Admin name (optional)
6. Click **"Save"**

### Syncing Employees

#### Option 1: Manual Entry
- Employees can be added manually through the employee form
- Employees are automatically associated with the company

#### Option 2: API Integration
1. External system calls the sync endpoint with employee data
2. System validates API key and company ID
3. Employees are created/updated based on `external_id`
4. Sync status is updated in company record

#### Option 3: Manual Sync
1. Go to **Settings → Companies**
2. Find the company
3. Click **"Sync Now"** button
4. System fetches employees from `api_endpoint` (if configured)

## Example JSON for External Systems

```json
{
  "external_id": "HMS-001",
  "employee_id": "EMP-001",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@hospital.com",
  "phone": "+965 1234 5678",
  "alternate_phone": "+965 9876 5432",
  "date_of_birth": "1990-05-15",
  "gender": "Male",
  "marital_status": "Married",
  "nationality": "Kuwaiti",
  "address": "123 Main Street",
  "city": "Kuwait City",
  "state": "Kuwait",
  "country": "Kuwait",
  "postal_code": "12345",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "+965 1111 2222",
  "emergency_contact_relationship": "Spouse",
  "department": "Engineering",
  "role": "Engineer",
  "job": "Software Engineer",
  "employment_type": "Full Time",
  "join_date": "2023-01-15",
  "salary": 5000.00,
  "work_location": "Office",
  "status": "Active",
  "notes": "Senior developer with 5 years experience"
}
```

## Security Considerations

1. **API Keys**: Should be stored securely and rotated regularly
2. **Password Hashing**: Admin passwords should be hashed using bcrypt
3. **API Authentication**: Validate API keys on every request
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Data Validation**: Validate all incoming employee data
6. **Error Handling**: Don't expose sensitive information in error messages

## Migration Status

✅ Migration `20251221170000_create_companies_table.sql` has been pushed to remote Supabase database

## Default Company

A default company is automatically created for existing employees:
- **Name**: "Default Company"
- **Code**: "DEFAULT"
- All existing employees are assigned to this company

## Next Steps

1. **Implement API Endpoint**: Create server-side endpoint `/api/employees/sync-external`
2. **Password Hashing**: Implement bcrypt hashing for admin passwords
3. **Login System**: Create login page for company admins
4. **Scheduled Syncs**: Implement cron jobs for automatic syncs
5. **API Documentation**: Add interactive API documentation
6. **Webhooks**: Add webhook support for real-time updates

## Support

For API integration support, refer to `API_INTEGRATION_GUIDE.md` for detailed documentation and examples.



