# Attendance Message Setup Guide

This guide explains how to set up automatic WhatsApp message sending when attendance is recorded.

## What Was Changed

### 1. Fixed Message Formatting
- **File**: `client/src/services/messageService.ts`
- **Change**: Removed escape characters (`\n`) and used actual newlines in message templates
- Messages now display properly formatted in WhatsApp

### 2. Created Supabase Edge Function
- **File**: `supabase/functions/send-attendance-message/index.ts`
- **Purpose**: Automatically sends WhatsApp messages when attendance is recorded
- **Features**:
  - Detects check-in vs check-out
  - Fetches employee details
  - Uses configured message API settings
  - Sends formatted Arabic messages

### 3. Created Database Webhook Migration
- **File**: `supabase/migrations/20260109000000_create_attendance_message_trigger.sql`
- **Purpose**: Provides instructions for setting up database webhooks

## Deployment Steps

### Step 1: Deploy the Edge Function

```bash
# Make sure you're in the project root
cd D:\Work\the-system-hr-frontend

# Deploy the function
supabase functions deploy send-attendance-message --project-ref wqfbltrnlwngyohvxjjq
```

Or use the Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/wqfbltrnlwngyohvxjjq/functions
2. Click "Create a new function"
3. Name it: `send-attendance-message`
4. Copy the contents of `supabase/functions/send-attendance-message/index.ts`
5. Click "Deploy"

### Step 2: Set Environment Variables

In Supabase Dashboard > Edge Functions > Settings, add:

- `SUPABASE_URL`: `https://wqfbltrnlwngyohvxjjq.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (from Settings > API)

### Step 3: Configure Database Webhook

1. Go to: https://supabase.com/dashboard/project/wqfbltrnlwngyohvxjjq/database/webhooks
2. Click **"Create a new webhook"**
3. Configure:
   - **Name**: `Send Attendance Message`
   - **Table**: `attendances`
   - **Events**: Check only **INSERT**
   - **HTTP Request**:
     - **URL**: `https://wqfbltrnlwngyohvxjjq.supabase.co/functions/v1/send-attendance-message`
     - **Method**: `POST`
     - **Headers**:
       ```json
       {
         "Content-Type": "application/json",
         "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"
       }
       ```
     - **Body**: Leave empty (webhook automatically sends record data)
4. Click **"Save"**

### Step 4: Configure Message API in Settings

1. Log in as admin
2. Go to **Settings** > **Message API** tab
3. Fill in your WhatsApp API configuration:
   - API URL
   - API Type (Single or Bulk)
   - Authentication token and header
   - Enable the feature
4. Click **Save**

## How It Works

1. **Attendance Recorded**: When a new record is inserted into `attendances` table (from any source - web, mobile app, API, etc.)

2. **Webhook Triggers**: The database webhook automatically sends a POST request to the edge function

3. **Edge Function Processes**:
   - Determines if it's check-in or check-out
   - Fetches employee details (name, phone, company)
   - Gets message API configuration for the company
   - Formats message in Arabic with date/time
   - Sends message via configured API

4. **Message Sent**: Employee receives WhatsApp message with attendance confirmation

## Testing

### Test the Edge Function Manually

```bash
curl -X POST https://wqfbltrnlwngyohvxjjq.supabase.co/functions/v1/send-attendance-message \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "record": {
      "id": 123,
      "employee_id": 901,
      "timestamp": "2026-01-09T10:00:00Z",
      "status1": true,
      "status2": false
    }
  }'
```

### Test with Real Attendance

1. Record attendance for an employee (via web, mobile, or API)
2. Check the employee's phone for the WhatsApp message
3. Check Edge Function logs in Supabase Dashboard for any errors

## Troubleshooting

### Messages Not Sending

1. **Check Webhook Configuration**:
   - Go to Database > Webhooks
   - Verify webhook is active and configured correctly
   - Check webhook logs for errors

2. **Check Edge Function**:
   - Go to Edge Functions > send-attendance-message > Logs
   - Look for error messages
   - Verify environment variables are set

3. **Check Message API Settings**:
   - Verify API is configured in Settings > Message API
   - Verify API is enabled
   - Test API URL manually

4. **Check Employee Data**:
   - Employee must have a phone number
   - Employee must belong to a company with message API configured

### Common Issues

- **"Employee not found"**: Employee ID in attendance record doesn't match any employee
- **"Message API not configured"**: Company doesn't have message API settings
- **"Employee has no phone number"**: Employee record missing phone field
- **"Failed to send message"**: API endpoint returned error (check API logs)

## Message Format

Messages are sent in Arabic:

**Check-in:**
```
تم تسجيل الحضور بنجاح ✅
📅 التاريخ: ٦‏/١‏/٢٠٢٦
🕐 الوقت: ١٠:٠٠ ص

شكراً لالتزامك بالمواعيد.
```

**Check-out:**
```
تم تسجيل الانصراف بنجاح ✅
📅 التاريخ: ٦‏/١‏/٢٠٢٦
🕐 الوقت: ٠٤:٠٠ م

شكراً لجهودك اليوم.
```

## Notes

- Messages are sent automatically for **all** attendance sources (web, mobile, API, etc.)
- The edge function handles both single and bulk message APIs
- Messages are sent asynchronously (won't block attendance recording)
- If message sending fails, attendance is still recorded (non-blocking)


