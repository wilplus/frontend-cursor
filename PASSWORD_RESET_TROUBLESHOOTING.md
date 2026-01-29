# Password Reset Troubleshooting Guide

## ✅ No Backend Changes Needed

Password reset is handled entirely by **Supabase Auth** - your Flask backend is not involved.

---

## 🔍 Step 1: Check Supabase Configuration

### 1. Site URL Configuration
Go to **Supabase Dashboard → Authentication → URL Configuration**

**Site URL** should be set to:
- Development: `http://localhost:3000`
- Production: `https://app.willonski.com` (or your Vercel URL)

### 2. Redirect URLs (Already Configured ✅)
You have these URLs whitelisted:
- `https://app.willonski.com/auth/callback`
- `http://localhost:3000/auth/callback`
- `https://frontend-cursor-tau.vercel.app/auth/callback`
- `http://localhost:3000/update-password`
- `https://app.willonski.com/update-password`
- `https://frontend-cursor.vercel.app/update-password`

**✅ These are correct!**

---

## 🔍 Step 2: Check the Reset Link

When you click the reset link from your email, check:

1. **What URL does it redirect to?**
   - Should be: `https://app.willonski.com/auth/callback#access_token=...&refresh_token=...&type=recovery`
   - Or: `https://app.willonski.com/update-password#access_token=...&refresh_token=...&type=recovery`

2. **Does the URL have a hash fragment (`#`)?**
   - If **NO hash** → The redirect URL might be wrong
   - If **YES hash** → The tokens should be there

3. **Check browser console:**
   - Look for `[UpdatePassword]` logs
   - Look for `[Auth Callback]` logs
   - Check for any errors

---

## 🔧 Step 3: Common Issues & Fixes

### Issue 1: Hash is Empty
**Symptom:** Diagnostic page shows "Hash: (empty)"

**Possible causes:**
- Supabase is redirecting to wrong URL
- Redirect URL doesn't match whitelist exactly
- Link has expired

**Fix:**
1. Request a **new** reset link (old ones expire after 1 hour)
2. Check that the redirect URL in the email matches your whitelist
3. Make sure Site URL is set correctly in Supabase

### Issue 2: "Invalid or expired reset link"
**Symptom:** Error message appears immediately

**Possible causes:**
- Link actually expired (1 hour limit)
- Tokens are invalid
- Redirect URL mismatch

**Fix:**
1. Request a **brand new** reset link
2. Use the link **immediately** (within a few minutes)
3. Check Supabase logs for errors

### Issue 3: Redirects to Callback But No Hash
**Symptom:** Goes to `/auth/callback` but hash is lost

**Fix:**
- The callback route should preserve the hash
- Check browser console for `[Auth Callback]` logs
- The HTML redirect should preserve the hash

---

## 🧪 Step 4: Test the Flow

1. **Request reset:**
   - Go to `/reset-password`
   - Enter your email (`artur@willonski.com`)
   - Click "Send reset link"

2. **Check email:**
   - Open the reset email
   - **Right-click** the link and "Copy link address"
   - Check what URL it points to

3. **Click the link:**
   - Open browser console (F12)
   - Click the reset link
   - Watch for:
     - What URL does it go to?
     - Does it have a hash?
     - What do the console logs say?

4. **Share the results:**
   - What URL is in the email link?
   - What does the diagnostic page show?
   - What do the console logs say?

---

## 📋 Quick Checklist

- [ ] Site URL is set correctly in Supabase
- [ ] Redirect URLs are whitelisted (✅ you have this)
- [ ] Requested a **new** reset link (not using old one)
- [ ] Using the link within a few minutes of receiving it
- [ ] Checked browser console for errors
- [ ] Checked the diagnostic info on the update-password page

---

## 🎯 Most Likely Issue

Based on your setup, the most likely issue is:

**The redirect URL in the email doesn't match your Supabase whitelist exactly**

**Solution:**
1. Check what URL Supabase is actually using in the email
2. Make sure it matches one of your whitelisted URLs **exactly** (including protocol, domain, path)
3. If it doesn't match, either:
   - Update the redirect URL in your code to match the whitelist
   - Or add the URL from the email to your Supabase whitelist

---

## 💡 Alternative: Manual Password Reset

If the automated flow keeps failing, you can manually reset the password in Supabase:

1. Go to **Supabase Dashboard → Authentication → Users**
2. Find your user (`artur@willonski.com`)
3. Click on the user
4. Click "Reset Password" or "Send Password Reset Email"
5. This will send a new reset link

---

## 🔗 Useful Links

- Supabase Auth Docs: https://supabase.com/docs/guides/auth/auth-password-reset
- Supabase Dashboard: https://supabase.com/dashboard
