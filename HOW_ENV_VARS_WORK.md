# How Environment Variables Work in This Project

## 📍 Where `client/src/services/api.ts` Gets Its Keys

The file `client/src/services/api.ts` uses:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
```

## 🔄 The Loading Flow

### 1. **Vite Configuration** (`vite.config.ts` line 21)
```typescript
envDir: path.resolve(import.meta.dirname),
```
This tells Vite to look for `.env` files in the **project root directory** (where `vite.config.ts` is located).

### 2. **Vite Automatically Loads** (in this order):
- `.env` - Default for all environments
- `.env.local` - Local overrides (ignored by git)
- `.env.[mode]` - Mode-specific (e.g., `.env.development`, `.env.production`)
- `.env.[mode].local` - Mode-specific local overrides

### 3. **Variable Prefix Rule**
- Variables with `VITE_` prefix → **Exposed to client-side code** via `import.meta.env.*`
- Variables without `VITE_` prefix → **Only available on server-side** via `process.env.*`

### 4. **Access in Code**
- **Client-side** (browser): `import.meta.env.VITE_*`
- **Server-side** (Node.js): `process.env.*`

## 📂 File Locations

```
the-system-hr-frontend/
├── .env                    ← Vite reads from here (project root)
├── vite.config.ts          ← Configures envDir to project root
└── client/
    └── src/
        └── services/
            └── api.ts      ← Uses import.meta.env.VITE_*
```

## 🔍 Current Setup

1. **`.env` file location**: `D:\Work\the-system-hr-frontend\.env` (project root)
2. **Vite reads from**: Project root (configured in `vite.config.ts`)
3. **Variables needed in `.env`**:
   ```env
   VITE_SUPABASE_URL=https://wqfbltrnlwngyohvxjjq.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_SUPABASE_SERVICE_KEY=your-service-key-here
   ```

## ⚠️ Important Notes

1. **Restart Required**: After changing `.env`, you must restart the dev server for changes to take effect
2. **Build-time**: Environment variables are embedded at build time, not runtime
3. **Security**: Only `VITE_` prefixed variables are exposed to the client bundle - **never put secrets in `VITE_` variables**
4. **Service Key Warning**: `VITE_SUPABASE_SERVICE_KEY` is exposed to the client! This is a security risk. Consider:
   - Using it only on server-side
   - Or using Row Level Security (RLS) policies in Supabase

## 🧪 Testing if Variables Are Loaded

Add this temporarily to `api.ts` to debug:
```typescript
console.log('Env check:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  anon: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
  service: import.meta.env.VITE_SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing'
});
```

## 🔗 Related Files

- **Config**: `vite.config.ts` (line 21: `envDir`)
- **Client usage**: `client/src/services/api.ts`
- **Client usage**: `client/src/services/supabase.ts`
- **Template**: `env.template` (reference for all variables)



