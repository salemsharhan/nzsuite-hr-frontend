# Local Development Guide

## 🚀 Running the Development Server

### Option 1: Using npm (Cross-Platform) ✅ Recommended
```bash
npm run dev
```

This now works on Windows, macOS, and Linux thanks to `cross-env`.

### Option 2: Using PowerShell (Windows Only)
If you prefer PowerShell syntax:
```powershell
$env:NODE_ENV="development"; tsx watch server/_core/index.ts
```

### Option 3: Using pnpm
```bash
pnpm dev
```

## 📋 Prerequisites

1. **Node.js** installed (check with `node --version`)
2. **Dependencies** installed:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Environment Variables** set up:
   - Copy `env.template` to `.env`
   - Fill in your Supabase credentials and other variables
   - See `ENV_SETUP.md` for details

## 🔧 Available Scripts

### Development
```bash
npm run dev          # Start development server
```

### Build
```bash
npm run build        # Build for production
```

### Start Production Server
```bash
npm run start        # Run production build
```

### Other Commands
```bash
npm run check        # TypeScript type checking
npm run format       # Format code with Prettier
npm test            # Run tests
```

## 🌐 Accessing the App

After running `npm run dev`, the app should be available at:
- **Frontend**: http://localhost:5173 (Vite default port)
- **Backend**: http://localhost:3000 (Express server)

## 🐛 Troubleshooting

### "NODE_ENV is not recognized"
- ✅ **Fixed!** The scripts now use `cross-env` which works on all platforms
- If you still see this error, make sure you ran `npm install` after the update

### Port Already in Use
If port 3000 or 5173 is already in use:
- Change the port in `server/_core/index.ts` (line 53)
- Or set `PORT` environment variable:
  ```powershell
  $env:PORT=3001; npm run dev
  ```

### Environment Variables Not Loading
1. Make sure `.env` file exists in project root
2. Restart the dev server after changing `.env`
3. Check `vite.config.ts` - `envDir` should point to project root

### Module Not Found Errors
```bash
npm install
# or
pnpm install
```

## 📝 Development Workflow

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Make changes** to your code

3. **Hot reload** - Vite will automatically reload changes

4. **Check console** for any errors

## 🔍 Debugging

### Check Environment Variables
Add this temporarily to see what's loaded:
```typescript
console.log('Environment:', {
  nodeEnv: process.env.NODE_ENV,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
});
```

### View Server Logs
The dev server logs will show:
- Server startup messages
- Request logs
- Error messages

## 💡 Tips

- **Use VS Code** with the recommended extensions for best experience
- **Keep terminal open** to see real-time logs
- **Check browser console** for client-side errors
- **Use React DevTools** for component debugging

## 🆘 Need Help?

- Check `ENV_SETUP.md` for environment variable setup
- Check `NETLIFY_DEPLOYMENT.md` for deployment issues
- Check `HOW_ENV_VARS_WORK.md` for environment variable details


