# API Integration Guide for External Systems

This guide explains how external systems (like Hospital Management Systems) can integrate with this HR system to share employee data.

## Overview

External systems can push employee data to this HR system via API. Each company has:
- A unique API endpoint
- API Key and Secret for authentication
- Configurable sync frequency (daily, weekly, monthly, or manual)

## API Endpoint

**POST** `/api/employees/sync-external`

### Headers
```
Content-Type: application/json
X-API-Key: <your-api-key>
X-Company-ID: <your-company-id>
```

### Request Body

```json
{
  "company_id": "uuid-of-company",
  "api_key": "your-api-key",
  "employees": [
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
    },
    {
      "external_id": "HMS-002",
      "first_name": "Sarah",
      "last_name": "Smith",
      "email": "sarah.smith@hospital.com",
      "phone": "+965 2345 6789",
      "department": "HR",
      "role": "Specialist",
      "job": "HR Specialist",
      "employment_type": "Full Time",
      "join_date": "2023-03-10",
      "status": "Active"
    }
  ]
}
```

### Response

**Success (200 OK)**
```json
{
  "success": true,
  "message": "Employees synced successfully",
  "created": 2,
  "updated": 0,
  "errors": []
}
```

**Error (400 Bad Request)**
```json
{
  "success": false,
  "message": "Invalid API key or company ID",
  "created": 0,
  "updated": 0,
  "errors": []
}
```

**Partial Success (200 OK with errors)**
```json
{
  "success": true,
  "message": "Some employees failed to sync",
  "created": 1,
  "updated": 0,
  "errors": [
    {
      "external_id": "HMS-003",
      "error": "Invalid email format"
    }
  ]
}
```

## Employee Data Schema

### Required Fields
- `external_id` (string): Unique identifier from your system
- `first_name` (string)
- `last_name` (string)
- `email` (string): Must be unique and valid email format

### Optional Fields
- `employee_id` (string): If not provided, will be auto-generated as `EMP-{external_id}`
- `phone` (string)
- `alternate_phone` (string)
- `date_of_birth` (string): Format: YYYY-MM-DD
- `gender` (string): Male, Female, Other, Prefer not to say
- `marital_status` (string): Single, Married, Divorced, Widowed
- `nationality` (string)
- `address` (string)
- `city` (string)
- `state` (string)
- `country` (string)
- `postal_code` (string)
- `emergency_contact_name` (string)
- `emergency_contact_phone` (string)
- `emergency_contact_relationship` (string): Spouse, Parent, Sibling, Child, Other
- `department` (string): Department name (will be matched to existing departments)
- `role` (string): Role name (will be matched to existing roles)
- `job` (string): Job name (will be matched to existing jobs for the role)
- `employment_type` (string): Full Time, Part Time, Consultant, Intern
- `join_date` (string): Format: YYYY-MM-DD
- `salary` (number): Decimal value
- `work_location` (string): Office, Remote, Hybrid
- `status` (string): Active, Inactive, On Leave
- `notes` (string)

## Department, Role, and Job Matching

The system will attempt to match:
- **Department**: By name (case-insensitive)
- **Role**: By name (case-insensitive)
- **Job**: By name and role (case-insensitive)

If a match is not found:
- Department: Employee will be created without department assignment
- Role: Employee will be created without role assignment
- Job: Employee will be created without job assignment

You can manage departments, roles, and jobs in the Settings page before syncing employees.

## Example Integration (Node.js)

```javascript
const axios = require('axios');

async function syncEmployees(employees) {
  try {
    const response = await axios.post(
      'https://your-hr-system.com/api/employees/sync-external',
      {
        company_id: 'your-company-uuid',
        api_key: 'your-api-key',
        employees: employees
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'your-api-key',
          'X-Company-ID': 'your-company-uuid'
        }
      }
    );

    console.log('Sync successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Sync failed:', error.response?.data || error.message);
    throw error;
  }
}

// Example usage
const employees = [
  {
    external_id: 'HMS-001',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@hospital.com',
    phone: '+965 1234 5678',
    department: 'Engineering',
    role: 'Engineer',
    job: 'Software Engineer',
    employment_type: 'Full Time',
    join_date: '2023-01-15',
    status: 'Active'
  }
];

syncEmployees(employees);
```

## Example Integration (Python)

```python
import requests
import json

def sync_employees(employees):
    url = 'https://your-hr-system.com/api/employees/sync-external'
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key',
        'X-Company-ID': 'your-company-uuid'
    }
    data = {
        'company_id': 'your-company-uuid',
        'api_key': 'your-api-key',
        'employees': employees
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()

# Example usage
employees = [
    {
        'external_id': 'HMS-001',
        'first_name': 'John',
        'last_name': 'Doe',
        'email': 'john.doe@hospital.com',
        'phone': '+965 1234 5678',
        'department': 'Engineering',
        'role': 'Engineer',
        'job': 'Software Engineer',
        'employment_type': 'Full Time',
        'join_date': '2023-01-15',
        'status': 'Active'
    }
]

result = sync_employees(employees)
print(result)
```

## Authentication

Each company has:
- **API Key**: Used for authentication
- **API Secret**: Used for signing requests (optional, for enhanced security)

The API key must be included in:
1. Request body: `api_key` field
2. Request header: `X-API-Key` header

## Sync Frequency

Companies can configure sync frequency:
- **Manual**: Only sync when triggered manually from the UI
- **Daily**: Automatic sync once per day
- **Weekly**: Automatic sync once per week
- **Monthly**: Automatic sync once per month

For automatic syncs, the system will call your `api_endpoint` (if configured) to fetch employee data.

## Error Handling

The API returns detailed error information:
- **Invalid API Key**: 401 Unauthorized
- **Invalid Company ID**: 400 Bad Request
- **Invalid Employee Data**: 400 Bad Request (with error details per employee)
- **Server Error**: 500 Internal Server Error

Always check the `errors` array in the response for individual employee sync failures.

## Best Practices

1. **Idempotency**: Use `external_id` to ensure employees are not duplicated
2. **Batch Size**: Send employees in batches of 100-500 for optimal performance
3. **Error Handling**: Always check the response and handle errors appropriately
4. **Retry Logic**: Implement retry logic for transient failures
5. **Data Validation**: Validate data before sending to avoid errors
6. **Security**: Keep API keys secure and rotate them regularly

## Support

For integration support, contact your HR system administrator or refer to the API documentation in the Settings page.



