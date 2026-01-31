# Backend Environment Variables: Update Checklist

## 🔧 After Vercel Deployment

Based on your Railway environment variables, here's what to update:

---

## ✅ Required Updates

### 1. FRONTEND_URL (CRITICAL!)

**Current:** (Value not visible, but needs to be updated)

**Update to:**
```bash
FRONTEND_URL=https://your-vercel-app.vercel.app
```

**Or if you have a custom domain:**
```bash
FRONTEND_URL=https://app.willonski.com
```

**Why:** Backend uses this to generate email links for admin notifications.

**Action:**
1. Click on `FRONTEND_URL` in Railway
2. Update value to your Vercel URL
3. Remove any `localhost:3000` if present
4. Save

---

### 2. CORS_ORIGINS (May Need Update)

**Current:** 
```
http://localhost:3000,https://speaking-coach-frontend.vercel.app/practice,https://app.willonski.com
```

**If your new Vercel URL is different, add it:**
```bash
CORS_ORIGINS=http://localhost:3000,https://your-new-vercel-app.vercel.app,https://app.willonski.com
```

**Note:** 
- Remove `/practice` from the old Vercel URL if it's not needed
- Add your new Vercel URL
- Keep `localhost:3000` for local development
- Keep `https://app.willonski.com` if that's your production domain

**Why:** Backend needs to allow requests from your new frontend domain.

---

## 📋 Complete Checklist

After Vercel deployment:

- [ ] **Get Vercel URL** (e.g., `https://frontend-cursor.vercel.app`)
- [ ] **Update `FRONTEND_URL`** in Railway to Vercel URL
- [ ] **Update `CORS_ORIGINS`** to include new Vercel URL (if different)
- [ ] **Remove old Vercel URL** from `CORS_ORIGINS` (if not needed)
- [ ] **Restart backend** (Railway usually auto-restarts)
- [ ] **Test email link** (upload recording, check admin email)

---

## 🎯 Quick Update Steps

1. **In Railway Dashboard:**
   - Find `FRONTEND_URL`
   - Click to edit
   - Set to: `https://your-vercel-url.vercel.app`
   - Save

2. **Check `CORS_ORIGINS`:**
   - If your new Vercel URL is different from `speaking-coach-frontend.vercel.app`
   - Add the new URL to the comma-separated list
   - Remove old one if not needed

3. **Verify:**
   - Backend restarts automatically
   - Test by uploading a recording
   - Check admin email - link should point to new Vercel URL

---

## 📝 Example Updates

### If Vercel URL is: `https://frontend-cursor.vercel.app`

**FRONTEND_URL:**
```bash
FRONTEND_URL=https://frontend-cursor.vercel.app
```

**CORS_ORIGINS:**
```bash
CORS_ORIGINS=http://localhost:3000,https://frontend-cursor.vercel.app,https://app.willonski.com
```

---

## ✅ Summary

**Backend Code:** ✅ No changes needed

**Backend Environment Variables:** ⚠️ **UPDATE REQUIRED**
- `FRONTEND_URL` → Set to Vercel URL
- `CORS_ORIGINS` → Add Vercel URL if different

**That's it!** Just environment variable updates, no code changes. 🚀
