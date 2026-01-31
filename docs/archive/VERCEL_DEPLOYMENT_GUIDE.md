# Vercel Deployment Guide

## 🚀 Quick Start

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### Step 2: Deploy to Vercel

1. **Go to:** https://vercel.com
2. **Sign in** with GitHub
3. **Click:** "Add New Project"
4. **Import** your repository
5. **Click:** "Deploy"

---

## 🔧 Environment Variables

Set these in **Vercel Dashboard → Settings → Environment Variables**:

### Required Variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**Important:**
- Check **Production**, **Preview**, and **Development** for all variables
- `NEXT_PUBLIC_*` variables are exposed to the browser
- Never commit `.env.local` to git

---

## 📋 Pre-Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Environment variables ready
- [ ] Backend is deployed and accessible
- [ ] Supabase project is active
- [ ] Test build locally: `npm run build`

---

## 🔧 Post-Deployment Steps

### 1. Update Backend FRONTEND_URL

In your Flask backend (Railway), update:

```bash
FRONTEND_URL=https://your-app.vercel.app
```

Or if you have a custom domain:

```bash
FRONTEND_URL=https://app.willonski.com
```

### 2. Configure Supabase Redirect URLs

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. **Site URL:** `https://your-app.vercel.app`
3. **Redirect URLs:** Add:
   - `https://your-app.vercel.app/auth/callback`
   - `https://your-app.vercel.app/api/auth/callback`

### 3. Test Everything

- [ ] Login works
- [ ] Signup works
- [ ] Dashboard loads
- [ ] Recording flow works
- [ ] Admin dashboard accessible
- [ ] Feedback form works
- [ ] Email links work

---

## 🐛 Common Issues

### Build Fails

**Fix:**
```bash
# Test build locally first
npm run build
```

Check for:
- TypeScript errors
- Missing dependencies
- Environment variables

### API Calls Fail

**Check:**
- `NEXT_PUBLIC_API_URL` is set correctly
- Backend is accessible from internet
- CORS is configured on backend

### Supabase Auth Fails

**Fix:**
1. Verify environment variables in Vercel
2. Add redirect URLs in Supabase dashboard
3. Check Supabase project is active

---

## ✅ Production Checklist

- [ ] All environment variables set
- [ ] Backend `FRONTEND_URL` updated
- [ ] Supabase redirect URLs configured
- [ ] Tested all features
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active (automatic)

---

## 🎯 Quick Deploy

1. Push to GitHub
2. Connect to Vercel
3. Set environment variables
4. Deploy
5. Update backend `FRONTEND_URL`
6. Configure Supabase redirects
7. Test
8. Done! 🎉

Good luck! 🚀
