# Send Attendance Message Edge Function

This Supabase Edge Function automatically sends WhatsApp messages to employees when their attendance is recorded in the database.

## Setup Instructions

### 1. Deploy the Edge Function

Deploy the function to your Supabase project:

```bash
# Using Supabase CLI
supabase functions deploy send-attendance-message

# Or using the project script
pnpm run supabase:functions:deploy send-attendance-message
```

### 2. Set Environment Variables

The function needs these environment variables (set in Supabase Dashboard > Edge Functions > Settings):

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://wqfbltrnlwngyohvxjjq.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (from Supabase Dashboard > Settings > API)

### 3. Configure Database Webhook

**Recommended Approach:** Use Supabase Webhooks (easiest)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/wqfbltrnlwngyohvxjjq)
2. Navigate to: **Database** > **Webhooks**
3. Click **"Create a new webhook"**
4. Configure:
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
     - **Body**: Leave empty (the webhook will automatically send the record data)
5. Click **"Save"**

### 4. Configure Message API Settings

Before messages can be sent, configure the message API in the admin settings:

1. Log in as an admin
2. Go to **Settings** > **Message API** tab
3. Fill in:
   - **API URL**: Your WhatsApp API endpoint
   - **API Type**: Single or Bulk
   - **Authentication**: Token and header name
   - **Enable**: Check the box
4. Click **Save**

## How It Works

1. When a new attendance record is inserted into the `attendances` table:
   - The webhook triggers automatically
   - It sends a POST request to this edge function with the attendance record

2. The edge function:
   - Determines if it's a check-in or check-out
   - Fetches the employee details
   - Gets the message API configuration for the employee's company
   - Formats the message in Arabic
   - Sends the message via the configured API

3. The message includes:
   - Attendance type (check-in or check-out)
   - Date and time
   - Thank you message

## Message Format

The messages are sent in Arabic:

**Check-in:**
```
تم تسجيل الحضور بنجاح ✅
📅 التاريخ: [date]
🕐 الوقت: [time]

شكراً لالتزامك بالمواعيد.
```

**Check-out:**
```
تم تسجيل الانصراف بنجاح ✅
📅 التاريخ: [date]
🕐 الوقت: [time]

شكراً لجهودك اليوم.
```

## Testing

To test the function manually:

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

## Troubleshooting

- **Messages not sending**: Check that:
  - Message API is configured and enabled in Settings
  - Employee has a phone number
  - Webhook is properly configured
  - Edge function is deployed

- **Check function logs**: Go to Supabase Dashboard > Edge Functions > send-attendance-message > Logs


