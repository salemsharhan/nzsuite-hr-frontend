# Environment Variables Setup Guide

## ✅ Created Files

1. **`.env`** - Your actual environment file (DO NOT commit to git)
2. **`env.template`** - Template file with all required variables (safe to commit)

## 📋 Environment Variables Summary

### Supabase Configuration (Required)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Anonymous/public key (client-safe) | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_SERVICE_KEY` | Service role key (server-only) | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternative name for service role key | Same as above |

**Default values found in code:**
- URL: `https://wqfbltrnlwngyohvxjjq.supabase.co` (from setup scripts)
- URL: `https://hlcobldukxhxscqmvcgi.supabase.co` (from supabase.ts)

### Database Configuration (Required)

| Variable | Description | Format |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres` |

**Connection Pooler Alternative:**
- `postgresql://postgres:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`

### Authentication & OAuth (Required)

| Variable | Description | Notes |
|----------|-------------|-------|
| `JWT_SECRET` | Secret for signing cookies/tokens | Generate strong random string (min 32 chars) |
| `OAUTH_SERVER_URL` | OAuth server URL | Your authentication server |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal URL (client-side) | For login redirects |
| `VITE_APP_ID` | Application ID | Your app identifier |
| `OWNER_OPEN_ID` | Owner/admin OpenID | For admin role assignment |

### Forge API Configuration (Maps & Storage)

| Variable | Description | Used For |
|----------|-------------|----------|
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key | Client-side maps (Map.tsx) |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API URL | Default: `https://forge.butterfly-effect.dev` |
| `BUILT_IN_FORGE_API_URL` | Backend API URL | Server-side maps & storage |
| `BUILT_IN_FORGE_API_KEY` | Backend API key | Server-side operations |

### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |

### Optional Variables

| Variable | Description | Status |
|----------|-------------|--------|
| `VITE_APP_TITLE` | Application title | Mentioned in docs, may not be used |
| `VITE_APP_LOGO` | Application logo URL | Mentioned in docs, may not be used |

## 🔍 Where Variables Are Used

### Client-Side (VITE_ prefix)
- `client/src/services/supabase.ts` - Supabase client initialization
- `client/src/services/api.ts` - API client setup
- `client/src/const.ts` - OAuth configuration
- `client/src/components/Map.tsx` - Maps integration

### Server-Side
- `server/_core/env.ts` - Centralized environment config
- `server/db.ts` - Database connection
- `server/storage.ts` - File storage operations
- `server/_core/map.ts` - Maps API integration
- `server/_core/index.ts` - Server initialization
- `drizzle.config.ts` - Database migrations

### Scripts
- `scripts/setup-supabase.js` - Supabase setup script
- `scripts/setup-supabase-direct.js` - Direct Supabase setup

## 🚀 Quick Start

1. **Copy the template:**
   ```powershell
   Copy-Item env.template .env
   ```
   (Already done ✅)

2. **Fill in your Supabase credentials:**
   - Go to: https://app.supabase.com/project/YOUR_PROJECT/settings/api
   - Copy your project URL, anon key, and service role key

3. **Set up database connection:**
   - Get your database password from Supabase Dashboard → Settings → Database
   - Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

4. **Configure OAuth:**
   - Set your OAuth server and portal URLs
   - Set your application ID
   - Set owner OpenID for admin access

5. **Set up Forge API (if using maps/storage):**
   - Get API keys from your Forge API provider
   - Set both frontend and backend keys

6. **Generate JWT Secret:**
   ```powershell
   # Generate a random secret (PowerShell)
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
   ```

## ⚠️ Security Notes

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Never expose service role keys** - Only use on server-side
3. **Use strong JWT secrets** - Minimum 32 characters, random
4. **Rotate keys regularly** - Especially if exposed
5. **Use different keys for dev/prod** - Never use production keys in development

## 📝 Notes

- Variables with `VITE_` prefix are exposed to the client-side bundle
- Server-side variables (without `VITE_`) are only available in Node.js
- The `.env` file is loaded from the project root (see `vite.config.ts` line 21)
- Restart your dev server after changing `.env` values

## 🔗 Useful Links

- [Supabase Dashboard](https://app.supabase.com)
- [Supabase API Settings](https://app.supabase.com/project/_/settings/api)
- [Supabase Database Settings](https://app.supabase.com/project/_/settings/database)




