# Vercel Setup: Step-by-Step Guide

## 🎯 Current Step: Configure Vercel Before Deploying

You're on the Vercel "New Project" page. Follow these steps:

---

## Step 1: Change Framework Preset

**Current:** Framework Preset shows "Other" ❌

**Action:**
1. Click the dropdown that says "Other"
2. Select **"Next.js"** from the list
3. This will auto-configure build settings

**Why:** Next.js needs specific build settings that Vercel knows how to handle.

---

## Step 2: Verify Build Settings

After selecting "Next.js", these should auto-populate correctly:

- **Build Command:** Should show `npm run build` ✅
- **Output Directory:** Should show `.next` or default ✅
- **Install Command:** Should show `npm install` ✅

**If they're wrong:** Click the edit icon and set:
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

---

## Step 3: Add Environment Variables (CRITICAL!)

**You MUST add these before deploying!**

### Find Your Values

First, get your values from your local `.env.local` file:

```bash
# In your terminal, run:
cat .env.local
```

You should see:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Add to Vercel

In the Vercel page, in the **"Environment Variables"** section:

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL

1. Click **"+ Add More"** button
2. **Key:** `NEXT_PUBLIC_SUPABASE_URL`
3. **Value:** Paste your Supabase URL (e.g., `https://zignvkswxvtvdzctpkcr.supabase.co`)
4. **Checkboxes:** Check all three:
   - ☑ Production
   - ☑ Preview
   - ☑ Development
5. Click outside or press Enter

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY

1. Click **"+ Add More"** button again
2. **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Value:** Paste your Supabase anon key (long string starting with `eyJ...`)
4. **Checkboxes:** Check all three:
   - ☑ Production
   - ☑ Preview
   - ☑ Development
5. Click outside or press Enter

#### Variable 3: NEXT_PUBLIC_API_URL

1. Click **"+ Add More"** button again
2. **Key:** `NEXT_PUBLIC_API_URL`
3. **Value:** Your Flask backend URL (e.g., `https://your-backend.railway.app`)
4. **Checkboxes:** Check all three:
   - ☑ Production
   - ☑ Preview
   - ☑ Development
5. Click outside or press Enter

---

## Step 4: Review Settings

Before clicking "Deploy", verify:

- [ ] Framework Preset: **Next.js** (not "Other")
- [ ] Build Command: `npm run build`
- [ ] Environment Variables: All 3 added
- [ ] All variables have Production/Preview/Development checked

---

## Step 5: Deploy!

1. Click the **"Deploy"** button (black button at bottom)
2. Wait 2-5 minutes for build to complete
3. Watch the build logs for any errors

---

## 📸 Visual Guide

### Environment Variables Section Should Look Like:

```
Environment Variables
┌─────────────────────────────────────────┐
│ Key: NEXT_PUBLIC_SUPABASE_URL           │
│ Value: https://xxx.supabase.co          │
│ ☑ Production ☑ Preview ☑ Development   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Key: NEXT_PUBLIC_SUPABASE_ANON_KEY      │
│ Value: eyJxxx...                         │
│ ☑ Production ☑ Preview ☑ Development     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Key: NEXT_PUBLIC_API_URL                │
│ Value: https://your-backend.railway.app │
│ ☑ Production ☑ Preview ☑ Development    │
└─────────────────────────────────────────┘

[+ Add More]
```

---

## 🐛 If You Don't Have .env.local

If you don't have a `.env.local` file, you need to get these values:

### Get Supabase Values:

1. Go to https://supabase.com
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Get Backend URL:

1. Go to Railway (or wherever your backend is hosted)
2. Copy the public URL
3. Use it for `NEXT_PUBLIC_API_URL`

---

## ✅ Quick Checklist

Before clicking "Deploy":

- [ ] Framework Preset changed to **"Next.js"**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` added
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` added
- [ ] `NEXT_PUBLIC_API_URL` added
- [ ] All 3 variables checked for Production/Preview/Development
- [ ] Build Command shows `npm run build`
- [ ] Ready to click "Deploy"!

---

## 🚀 After Deployment

Once deployment completes:

1. **Copy your Vercel URL** (e.g., `https://frontend-cursor.vercel.app`)

2. **Update Backend:**
   - In Railway, set: `FRONTEND_URL=https://frontend-cursor.vercel.app`

3. **Configure Supabase:**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Site URL: `https://frontend-cursor.vercel.app`
   - Redirect URLs: Add `https://frontend-cursor.vercel.app/auth/callback`

4. **Test:**
   - Visit your Vercel URL
   - Test login, signup, recording flow

---

## 📝 Summary

**3 Things to Do:**
1. Change Framework Preset to "Next.js"
2. Add 3 environment variables
3. Click "Deploy"

That's it! 🎉
