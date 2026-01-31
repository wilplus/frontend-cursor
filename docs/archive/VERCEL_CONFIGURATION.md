# Vercel Configuration Settings

## ⚠️ Important: Fix These Settings Before Deploying

Based on your Vercel screenshot, here are the correct settings:

---

## 🔧 Configuration Settings

### 1. Framework Preset
**Current:** "Other" ❌  
**Should be:** "Next.js" ✅

**Why:** This auto-configures build settings for Next.js

---

### 2. Build Command
**Current:** Default suggestions  
**Should be:** `npm run build` ✅

This is correct if it shows `npm run build`

---

### 3. Output Directory
**Current:** `public` if it exists, or `.`  
**Should be:** `.next` ✅ (or leave default - Next.js handles this)

**Note:** For Next.js, you can leave this as default or set to `.next`

---

### 4. Install Command
**Current:** Default suggestions  
**Should be:** `npm install` ✅

This is correct if it shows `npm install`

---

## 🔑 Environment Variables (CRITICAL!)

**You MUST add these before deploying:**

Click "Add More" and add:

| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Your Supabase anon key |
| `NEXT_PUBLIC_API_URL` | `https://your-backend.railway.app` | Your Flask backend URL |

**Important:**
- Check **Production**, **Preview**, and **Development** for all variables
- `NEXT_PUBLIC_*` variables are exposed to the browser
- Get these values from your `.env.local` file

---

## ✅ Step-by-Step

### Before Clicking "Deploy":

1. **Change Framework Preset:**
   - Click the "Other" dropdown
   - Select **"Next.js"**

2. **Verify Build Settings:**
   - Build Command: `npm run build` ✅
   - Output Directory: `.next` or default ✅
   - Install Command: `npm install` ✅

3. **Add Environment Variables:**
   - Click "+ Add More"
   - Add `NEXT_PUBLIC_SUPABASE_URL` with your Supabase URL
   - Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your anon key
   - Add `NEXT_PUBLIC_API_URL` with your backend URL
   - Check all three environments (Production, Preview, Development)

4. **Click "Deploy"**

---

## 🎯 Quick Checklist

- [ ] Framework Preset: **Next.js** (not "Other")
- [ ] Build Command: `npm run build`
- [ ] Environment Variables: All 3 added
- [ ] All variables checked for Production/Preview/Development
- [ ] Ready to deploy!

---

## 🐛 If Build Fails

**Common issues:**

1. **Framework Preset wrong:**
   - Change from "Other" to "Next.js"

2. **Missing environment variables:**
   - Add all 3 required variables

3. **Build command wrong:**
   - Should be `npm run build`

4. **TypeScript errors:**
   - Fix any TypeScript errors first
   - Run `npm run build` locally to test

---

## 📝 After Deployment

1. **Update Backend FRONTEND_URL:**
   - In Railway, set: `FRONTEND_URL=https://your-app.vercel.app`

2. **Configure Supabase:**
   - Add Vercel URL to Supabase redirect URLs
   - Site URL: `https://your-app.vercel.app`

3. **Test:**
   - Visit your Vercel URL
   - Test login, signup, recording flow

---

## 🚀 You're Ready!

Once you:
1. Change Framework Preset to "Next.js"
2. Add the 3 environment variables
3. Click "Deploy"

Your app will deploy in 2-5 minutes! 🎉
