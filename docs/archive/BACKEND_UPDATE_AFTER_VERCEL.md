# Backend Updates After Vercel Deployment

## ✅ What Needs to Be Updated

After deploying the frontend to Vercel, you need to update **one environment variable** in your backend (Railway).

---

## 🔧 Required Backend Update

### Update FRONTEND_URL in Railway

1. **Get your Vercel URL:**
   - After deployment, Vercel will give you a URL like: `https://frontend-cursor.vercel.app`
   - Or if you set a custom domain: `https://app.willonski.com`

2. **Update Railway Environment Variable:**
   - Go to Railway Dashboard
   - Select your Flask backend project
   - Go to **Variables** tab
   - Find `FRONTEND_URL`
   - Update it to: `https://your-vercel-url.vercel.app`
   - **Remove** any `localhost:3000` values
   - Save

3. **Restart Backend:**
   - Railway should auto-restart, or manually restart

---

## 📋 Backend Environment Variables Checklist

Make sure these are set in Railway:

```bash
# Frontend URL (UPDATE THIS!)
FRONTEND_URL=https://your-vercel-url.vercel.app

# OpenAI (if using real OpenAI)
OPENAI_API_KEY=sk-your-key

# Database (Supabase)
DATABASE_URL=your-supabase-connection-string

# Other backend env vars...
```

---

## 🎯 Why This Matters

The backend uses `FRONTEND_URL` to:
1. **Generate email links** for admin notifications
2. **Construct feedback URLs** in admin emails

**Example email link:**
```
https://your-vercel-url.vercel.app/recordings/{recording_id}/feedback?user_id={user_id}
```

If `FRONTEND_URL` is still `localhost:3000`, the email links will point to localhost and won't work! ❌

---

## ✅ After Updating

1. **Test email link:**
   - Upload a recording
   - Check admin email
   - Click the feedback link
   - Should open your Vercel app ✅

2. **Verify:**
   - Link should be: `https://your-vercel-url.vercel.app/recordings/...`
   - NOT: `http://localhost:3000/recordings/...`

---

## 📝 Summary

**Backend Code:** ✅ No changes needed

**Backend Environment Variable:** ⚠️ **UPDATE REQUIRED**
- Update `FRONTEND_URL` in Railway
- Set to your Vercel URL
- Remove `localhost:3000`

**That's it!** Just one environment variable update. 🚀
