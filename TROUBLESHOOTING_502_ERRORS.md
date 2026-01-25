# Troubleshooting 502 Errors: Backend Not Responding

## What is a 502 Error?

A **502 Bad Gateway** error means your Next.js frontend cannot reach your Flask backend server. The backend is either:
- Not running
- Not accessible at the configured URL
- Timing out (taking too long to respond)
- Crashing on startup

## Quick Checks

### 1. Check if Backend is Running

```bash
# If running locally
curl http://localhost:5000/health  # or whatever port your Flask uses

# If on Railway/Heroku/etc
curl https://your-backend-url.railway.app/health
```

### 2. Verify Environment Variable

Check your `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000  # or your production URL
```

**Important:** The URL should:
- Not have a trailing slash (`/`)
- Be accessible from your Next.js server (not just browser)
- Use `http://` for localhost, `https://` for production

### 3. Check Backend Logs

Look for:
- Flask startup errors
- Port binding issues
- Database connection errors
- Missing dependencies

### 4. Test Backend Directly

Try accessing your backend in a browser or with curl:

```bash
# Test health endpoint (if you have one)
curl http://localhost:5000/health

# Test a real endpoint (with auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/session/status
```

## Common Issues

### Issue 1: Backend Not Running

**Symptom:** All requests return 502

**Solution:**
```bash
# Start your Flask backend
python app.py
# or
flask run
# or
gunicorn app:app
```

### Issue 2: Wrong URL in Environment Variable

**Symptom:** 502 errors, but backend is running

**Solution:**
1. Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
2. Restart Next.js dev server after changing `.env.local`
3. Verify the URL matches where Flask is actually running

### Issue 3: CORS Issues (Less Common with BFF Pattern)

**Symptom:** 502 or CORS errors

**Solution:**
Since we use BFF (Backend-for-Frontend) pattern, CORS shouldn't be an issue. But if you see CORS errors, check Flask CORS configuration.

### Issue 4: Backend Crashes on Startup

**Symptom:** Backend starts then immediately stops

**Solution:**
1. Check Flask logs for Python errors
2. Verify all dependencies are installed
3. Check database connection strings
4. Verify Supabase credentials

### Issue 5: Timeout Issues

**Symptom:** 502 after 15-30 seconds

**Solution:**
- Backend is taking too long to respond
- Check for slow database queries
- Check for infinite loops
- Increase timeout in `bff.ts` if needed (currently 30 seconds)

## Debugging Steps

1. **Check Console Logs**
   - Look for `[BFF]` logs in Next.js server console
   - Check Flask backend logs

2. **Verify Backend URL**
   ```bash
   # In Next.js server console, you should see:
   [BFF] Backend URL: http://localhost:5000/session/status
   ```

3. **Test Backend Manually**
   ```bash
   # Get your auth token from browser DevTools → Application → Cookies
   # Then test:
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:5000/session/status
   ```

4. **Check Network Tab**
   - Open browser DevTools → Network
   - Look for failed requests to `/api/*`
   - Check response status and body

## Frontend Error Messages

The frontend now shows helpful error messages when 502 occurs:

- **"Backend server is not responding"** - Backend is down or unreachable
- **"Check if Flask backend is running"** - Backend might not be started
- **"Is NEXT_PUBLIC_API_URL set correctly?"** - Environment variable issue

## Production Checklist

If deploying to production:

- [ ] Backend is deployed and running
- [ ] `NEXT_PUBLIC_API_URL` points to production backend URL
- [ ] Backend URL is accessible from Next.js server (not just browser)
- [ ] Backend has proper health check endpoint
- [ ] Backend logs are accessible for debugging
- [ ] Database connections are configured correctly
- [ ] Supabase credentials are set in backend

## Still Having Issues?

1. Check Flask backend logs for startup errors
2. Verify `NEXT_PUBLIC_API_URL` matches where Flask is actually running
3. Test backend directly with curl/Postman
4. Check Next.js server console for `[BFF]` error logs
5. Verify network connectivity between Next.js and Flask servers
