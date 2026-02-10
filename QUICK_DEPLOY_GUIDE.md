# Quick Deploy Guide - Edge Function

Since CLI is having issues, use the **Supabase Dashboard** (easiest method):

## Step 1: Deploy Function via Dashboard

1. **Open Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard/project/wqfbltrnlwngyohvxjjq/functions

2. **Create Function**:
   - Click **"Create a new function"** (or **"New Function"**)
   - Name: `send-attendance-message`

3. **Copy Function Code**:
   - Open this file: `supabase/functions/send-attendance-message/index.ts`
   - Copy **ALL** the code
   - Paste into the function editor

4. **Deploy**:
   - Click **"Deploy"** or **"Save"**

## Step 2: Set Environment Variables

1. In the same dashboard, go to **Edge Functions** > **Settings** (or **Secrets**)
2. Add these environment variables:
   - **Name**: `SUPABASE_URL`
     - **Value**: `https://wqfbltrnlwngyohvxjjq.supabase.co`
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
     - **Value**: Get from **Settings** > **API** > **service_role** key (the long JWT token)

## Step 3: Configure Database Webhook

1. Go to: https://supabase.com/dashboard/project/wqfbltrnlwngyohvxjjq/database/webhooks
2. Click **"Create a new webhook"**
3. Fill in:
   - **Name**: `Send Attendance Message`
   - **Table**: Select `attendances`
   - **Events**: Check only **INSERT** (uncheck UPDATE, DELETE)
   - **HTTP Request**:
     - **URL**: `https://wqfbltrnlwngyohvxjjq.supabase.co/functions/v1/send-attendance-message`
     - **Method**: `POST`
     - **Headers**: Click **"Add Header"** and add:
       - **Key**: `Content-Type`
       - **Value**: `application/json`
       - **Key**: `Authorization`
       - **Value**: `Bearer YOUR_SERVICE_ROLE_KEY` (replace with actual key)
   - **Body**: Leave empty (webhook sends data automatically)
4. Click **"Save"**

## Step 4: Verify Message API Settings

1. Log in to your app as admin
2. Go to **Settings** > **Message API** tab
3. Make sure your WhatsApp API is configured and enabled

## Done! ✅

Now whenever attendance is recorded (from any source), the webhook will:
1. Trigger automatically
2. Call the edge function
3. Send WhatsApp message to the employee

## Test It

Record attendance for an employee and check their phone for the WhatsApp message!

## Troubleshooting

**Function not found?**
- Make sure you deployed it in the correct project
- Check function name is exactly: `send-attendance-message`

**Messages not sending?**
- Check Edge Function logs: Dashboard > Edge Functions > send-attendance-message > Logs
- Verify webhook is active: Dashboard > Database > Webhooks
- Check message API is enabled in Settings

**Need help?**
- Check function logs for error messages
- Verify environment variables are set correctly
- Make sure employee has a phone number


