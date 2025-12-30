# Netlify Deployment Guide - Environment Variables

## ✅ Yes, Netlify Can Access Environment Variables!

When you add environment variables in Netlify's dashboard, they are available during the **build process**. Here's how it works:

## 🔄 How It Works

### 1. **Build-Time vs Runtime**
- **Build-time**: Vite reads environment variables during `npm run build` or `pnpm build`
- **Runtime**: Variables are embedded into the built JavaScript bundle
- Netlify injects environment variables into the build environment

### 2. **Variable Prefix Rules**

#### ✅ **Will Work (Client-Side)**
Variables with `VITE_` prefix are embedded into the client bundle:
- `VITE_SUPABASE_URL` ✅
- `VITE_SUPABASE_ANON_KEY` ✅
- `VITE_SUPABASE_SERVICE_KEY` ✅
- `VITE_OAUTH_PORTAL_URL` ✅
- `VITE_APP_ID` ✅
- `VITE_FRONTEND_FORGE_API_KEY` ✅
- `VITE_FRONTEND_FORGE_API_URL` ✅

#### ⚠️ **Won't Work in Static Hosting (Server-Side Only)**
Variables without `VITE_` prefix are **NOT** available in static hosting:
- `DATABASE_URL` ❌ (only works in server/Node.js)
- `JWT_SECRET` ❌ (only works in server/Node.js)
- `OAUTH_SERVER_URL` ❌ (only works in server/Node.js)
- `BUILT_IN_FORGE_API_URL` ❌ (only works in server/Node.js)
- `BUILT_IN_FORGE_API_KEY` ❌ (only works in server/Node.js)
- `SUPABASE_SERVICE_ROLE_KEY` ❌ (only works in server/Node.js)

**Note**: These will work if you're using **Netlify Functions** (serverless functions), but not in static HTML/JS files.

## 📋 Required Variables for Netlify

Based on your code, you need these `VITE_` prefixed variables in Netlify:

```env
VITE_SUPABASE_URL=https://wqfbltrnlwngyohvxjjq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal.com
VITE_APP_ID=your-app-id
VITE_FRONTEND_FORGE_API_KEY=your-key
VITE_FRONTEND_FORGE_API_URL=https://forge.butterfly-effect.dev
```

## ⚙️ Netlify Build Settings

### Build Command
```bash
pnpm build
```
or
```bash
npm run build
```

### Publish Directory
```
dist/public
```
(This is where Vite outputs your build - see `vite.config.ts` line 25)

### Node Version
Set to match your local version (e.g., `18.x` or `20.x`)

## 🔍 Verifying Variables Are Loaded

### Option 1: Check Build Logs
In Netlify build logs, you can temporarily add:
```bash
echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
```

### Option 2: Debug in Code (Temporary)
Add this to `client/src/services/api.ts` temporarily:
```typescript
console.log('Netlify Env Check:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  hasAnon: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  hasService: !!import.meta.env.VITE_SUPABASE_SERVICE_KEY,
  mode: import.meta.env.MODE,
});
```

## ⚠️ Important Notes

### 1. **Rebuild Required**
After adding/changing environment variables in Netlify:
- **Trigger a new deploy** (or push a commit)
- Variables are only available during build, not at runtime

### 2. **Security Warning**
- `VITE_SUPABASE_SERVICE_KEY` is **exposed in the client bundle**!
- Anyone can see it in the browser's developer tools
- **Recommendation**: 
  - Use Row Level Security (RLS) in Supabase
  - Or move service key operations to Netlify Functions

### 3. **Server-Side Code Won't Work**
If your app uses server-side code (like `server/_core/index.ts`), you need:
- **Netlify Functions** for serverless functions
- Or deploy the server separately (e.g., on Railway, Render, etc.)

## 🚀 Deployment Checklist

- [ ] All `VITE_*` variables added to Netlify dashboard
- [ ] Build command set to `pnpm build` or `npm run build`
- [ ] Publish directory set to `dist/public`
- [ ] Node version configured in Netlify
- [ ] Triggered a new build after adding variables
- [ ] Verified variables are accessible (check browser console)

## 🔗 Netlify Environment Variable Settings

1. Go to: **Site settings** → **Environment variables**
2. Add each variable with exact name (case-sensitive)
3. Set scope: **All scopes** or specific contexts
4. Click **Save**

## 🐛 Troubleshooting

### Variables Not Working?
1. **Check variable names** - Must match exactly (case-sensitive)
2. **Check `VITE_` prefix** - Only `VITE_*` variables work in client
3. **Trigger new build** - Variables are embedded at build time
4. **Check build logs** - Look for errors during build
5. **Verify in browser** - Check `import.meta.env` in console

### Build Failing?
- Check Node version matches your local setup
- Verify build command is correct
- Check that all dependencies are in `package.json`

## 📝 Example Netlify Configuration

If you create a `netlify.toml` file in your project root:

```toml
[build]
  command = "pnpm build"
  publish = "dist/public"

[build.environment]
  NODE_VERSION = "18.x"

# Environment variables should be set in Netlify dashboard, not here
# (for security reasons)
```

## 🎯 Summary

✅ **Yes, Netlify can access environment variables!**
- `VITE_*` variables → ✅ Work in client-side code
- Non-`VITE_` variables → ❌ Only work in server/Node.js (need Netlify Functions)
- Variables are embedded at **build time**
- **Trigger a new build** after adding/changing variables


