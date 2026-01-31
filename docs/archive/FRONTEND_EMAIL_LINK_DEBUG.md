# Frontend: Email Link Debugging Guide

## 🔍 If Email Link Doesn't Work

If the admin clicks the email link and it doesn't work, here's how to debug:

---

## ✅ Frontend Route is Ready

The route `/recordings/[id]/feedback?user_id=[userId]` is set up and working.

---

## 🐛 Common Issues & Fixes

### Issue 1: Link Points to Wrong Domain

**Check:** What URL is in the email?

**If it's:**
- `localhost:3000` → Backend is using wrong `FRONTEND_URL`
- `http://app.willonski.com` → Missing `https://`
- `app.willonski.com` → Missing protocol

**Fix:** Backend needs to use `https://app.willonski.com`

---

### Issue 2: 404 Not Found

**Check:** Does the link open but show 404?

**Possible causes:**
1. Route doesn't exist (but it does at `/recordings/[id]/feedback`)
2. Wrong parameter name in URL
3. Next.js routing issue

**Verify:**
- Link format: `https://app.willonski.com/recordings/{id}/feedback?user_id={userId}`
- Check browser console for errors
- Check Network tab for failed requests

---

### Issue 3: Access Denied / Redirect to Login

**This is expected behavior!** The page is protected by `AdminAuthGuard`.

**Flow:**
1. Admin clicks link
2. If not logged in → Redirects to `/login`
3. After login → Should redirect back to feedback page
4. `AdminAuthGuard` checks admin status
5. If admin → Shows feedback form
6. If not admin → Shows "Access Denied"

**Fix:** Make sure admin is logged in before clicking link, or implement redirect after login.

---

### Issue 4: Link Opens But Shows Error

**Check browser console for:**
- 401 Unauthorized → Admin not authenticated
- 403 Forbidden → User is not admin
- 500 Server Error → Backend issue
- Network error → Backend not accessible

---

## 🔧 Frontend Debugging

### Add Temporary Logging

If needed, you can add temporary logging to see what's happening:

```typescript
// In src/app/recordings/[id]/feedback/page.tsx
useEffect(() => {
  console.log("Feedback page loaded:", {
    recordingId: params.id,
    userId: searchParams.get("user_id"),
    url: window.location.href
  });
}, []);
```

### Check AdminAuthGuard

The `AdminAuthGuard` component:
1. Checks if user is admin by calling `fetchAdminRecordings()`
2. If 403/401 → Shows access denied
3. If success → Renders the page

**If access denied:**
- User might not be logged in
- User might not be admin
- Backend might not be verifying admin role correctly

---

## ✅ Expected Behavior

### When Link Works Correctly:

1. **Admin clicks link:**
   ```
   https://app.willonski.com/recordings/abc123/feedback?user_id=xyz789
   ```

2. **If not logged in:**
   - Redirects to `/login?redirectTo=/recordings/abc123/feedback?user_id=xyz789`
   - After login, redirects back to feedback page

3. **If logged in:**
   - `AdminAuthGuard` checks admin status
   - If admin → Shows feedback form
   - If not admin → Shows "Access Denied"

4. **Feedback form loads:**
   - Shows recording context
   - Pre-fills existing feedback (if any)
   - Allows submission

---

## 🧪 Test the Route Locally

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to:**
   ```
   http://localhost:3000/recordings/{recording_id}/feedback?user_id={user_id}
   ```

3. **Verify:**
   - Page loads
   - AdminAuthGuard checks admin status
   - Form displays correctly

---

## 📋 Checklist

If link doesn't work:

- [ ] Check what URL is in the email (copy link address)
- [ ] Verify URL format: `https://app.willonski.com/recordings/{id}/feedback?user_id={userId}`
- [ ] Check if admin is logged in
- [ ] Check browser console for errors
- [ ] Check Network tab for failed requests
- [ ] Verify backend `FRONTEND_URL` is set correctly
- [ ] Test the route directly in browser

---

## 🎯 Most Likely Issue

**The backend is using `localhost:3000` instead of `https://app.willonski.com`**

**Fix:**
1. Update Railway `FRONTEND_URL` to: `https://app.willonski.com`
2. Remove any `localhost:3000` values
3. Restart backend
4. Send test email
5. Verify link uses production URL

The frontend is ready - the issue is likely the backend URL configuration! 🚀
