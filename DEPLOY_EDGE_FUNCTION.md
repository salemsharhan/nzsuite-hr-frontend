# Deploy Edge Function - Quick Guide

Since Supabase CLI might not be in your PATH, here are **3 ways** to deploy the edge function:

## Method 1: Using pnpm (Recommended)

Since `supabase` is in your `devDependencies`, use pnpm to run it:

```powershell
# Navigate to project root
cd D:\Work\the-system-hr-frontend

# Deploy the function using pnpm
pnpm exec supabase functions deploy send-attendance-message --project-ref wqfbltrnlwngyohvxjjq
```

Or use the npm script:

```powershell
pnpm run supabase:functions:deploy send-attendance-message --project-ref wqfbltrnlwngyohvxjjq
```

## Method 2: Via Supabase Dashboard (Easiest - No CLI needed)

1. **Go to Supabase Dashboard**:
   - https://supabase.com/dashboard/project/wqfbltrnlwngyohvxjjq/functions

2. **Create New Function**:
   - Click **"Create a new function"**
   - Name it: `send-attendance-message`

3. **Copy Function Code**:
   - Open `supabase/functions/send-attendance-message/index.ts`
   - Copy **all** the contents
   - Paste into the function editor in the dashboard

4. **Deploy**:
   - Click **"Deploy"** button

5. **Set Environment Variables**:
   - Go to **Edge Functions** > **Settings**
   - Add these secrets:
     - `SUPABASE_URL` = `https://wqfbltrnlwngyohvxjjq.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY` = (Get from Settings > API > service_role key)

## Method 3: Install Supabase CLI Globally

If you want to use `supabase` command directly:

```powershell
# Install globally using npm
npm install -g supabase

# Or using pnpm
pnpm add -g supabase

# Then deploy
supabase functions deploy send-attendance-message --project-ref wqfbltrnlwngyohvxjjq
```

## After Deployment

### 1. Set Environment Variables

In Supabase Dashboard > Edge Functions > Settings, add:
- `SUPABASE_URL`: `https://wqfbltrnlwngyohvxjjq.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

### 2. Configure Database Webhook

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
4. Click **"Save"**

### 3. Test the Function

After deployment, test it:

```powershell
# Get your service role key from Supabase Dashboard > Settings > API
$serviceKey = "YOUR_SERVICE_ROLE_KEY"

# Test the function
curl -X POST https://wqfbltrnlwngyohvxjjq.supabase.co/functions/v1/send-attendance-message `
  -H "Authorization: Bearer $serviceKey" `
  -H "Content-Type: application/json" `
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

### "The system cannot find the path specified"
- Use **Method 2 (Dashboard)** - it's the easiest and doesn't require CLI
- Or use **Method 1** with `pnpm exec`

### "supabase is not recognized"
- Use **Method 2 (Dashboard)** - no CLI needed
- Or install CLI globally with **Method 3**

### Function not working after deployment
- Check Edge Function logs in Dashboard
- Verify environment variables are set
- Verify webhook is configured correctly
- Check that message API is configured in Settings


