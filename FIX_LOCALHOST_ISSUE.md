# Fix: App Won't Host on Localhost

## 🔍 Problem

Error: `EPERM: operation not permitted 0.0.0.0:3000`

This means port 3000 is either:
1. Already in use by another process
2. Blocked by permissions
3. Another Next.js instance is running

---

## ✅ Solution 1: Kill Process Using Port 3000

### Find and Kill the Process

```bash
# Find what's using port 3000
lsof -ti:3000

# Kill the process (replace PID with the number from above)
kill -9 <PID>

# Or kill all processes on port 3000
lsof -ti:3000 | xargs kill -9
```

### Then Restart

```bash
npm run dev
```

---

## ✅ Solution 2: Use a Different Port

### Option A: Use Port 3001

```bash
# Run on port 3001
PORT=3001 npm run dev
```

### Option B: Update package.json

```json
{
  "scripts": {
    "dev": "next dev -p 3001"
  }
}
```

Then run:
```bash
npm run dev
```

---

## ✅ Solution 3: Check for Running Next.js Processes

```bash
# Find all Node processes
ps aux | grep node

# Find Next.js processes specifically
ps aux | grep "next dev"

# Kill all Next.js processes
pkill -f "next dev"
```

Then restart:
```bash
npm run dev
```

---

## ✅ Solution 4: Clean and Restart

Sometimes Next.js cache can cause issues:

```bash
# Remove .next folder
rm -rf .next

# Clear node_modules and reinstall (if needed)
rm -rf node_modules
npm install

# Restart dev server
npm run dev
```

---

## ✅ Solution 5: Check for Multiple Terminal Windows

Make sure you don't have:
- Multiple terminal windows running `npm run dev`
- Background processes from previous sessions
- Other development servers running

---

## 🔧 Quick Fix Script

Create a script to kill port 3000 and restart:

```bash
#!/bin/bash
# kill-port-3000.sh

echo "Killing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No processes found on port 3000"

echo "Starting Next.js dev server..."
npm run dev
```

Make it executable:
```bash
chmod +x kill-port-3000.sh
./kill-port-3000.sh
```

---

## 🎯 Recommended Steps

1. **Kill existing process:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **Wait a few seconds** for the port to be released

3. **Start dev server:**
   ```bash
   npm run dev
   ```

---

## 📝 If Still Not Working

### Check System Permissions

On macOS, sometimes you need to allow Node.js network access:

1. System Settings → Privacy & Security → Firewall
2. Make sure Node.js is allowed

### Try Different Port

```bash
PORT=3001 npm run dev
```

Then access at: `http://localhost:3001`

---

## ✅ Verify It's Working

After starting, you should see:
```
✓ Ready in Xms
○ Local:        http://localhost:3000
```

If you see this, the server is running! 🎉
