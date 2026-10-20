# Flask Backend Setup for Supabase JWT Verification

## The Problem

Your Flask backend is returning:
- `401 Unauthorized` with error: "Token verification failed: Failed to fetch JWKS"

This means Flask can't verify the Supabase JWT token because it can't reach Supabase's JWKS endpoint.

## Solution: Configure Flask Backend

Your Flask backend needs to:

### 1. Have Supabase URL configured

Make sure your Flask backend has access to your Supabase project URL:

```python
SUPABASE_URL = "https://zignvkswxvtvdzctpkcr.supabase.co"
```

### 2. Be able to reach Supabase's JWKS endpoint

The JWKS endpoint is typically at:
```
https://<your-project>.supabase.co/.well-known/jwks.json
```

For your project:
```
https://zignvkswxvtvdzctpkcr.supabase.co/.well-known/jwks.json
```

### 3. Check network connectivity

If Flask is running on Railway/localhost, ensure:
- Railway has outbound internet access
- No firewall blocking HTTPS requests to Supabase
- No proxy issues

### 4. Verify JWT verification code

Your Flask backend should be using a library like `pyjwt` or `python-jose` to verify the token:

```python
import jwt
from jwt import PyJWKClient

# Initialize JWKS client
jwks_client = PyJWKClient(f"{SUPABASE_URL}/.well-known/jwks.json")

# Verify token
def verify_token(token: str):
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="authenticated",  # Supabase default audience
            issuer=f"{SUPABASE_URL}",  # Or check your Supabase settings
        )
        return payload
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}")
```

### 5. Check Supabase JWT settings

In Supabase Dashboard → Settings → API:
- Note your JWT secret (if needed for verification)
- Check JWT expiry time
- Verify the issuer URL matches what Flask expects

## Quick Test

Test if Flask can reach Supabase:

```python
import requests

response = requests.get("https://zignvkswxvtvdzctpkcr.supabase.co/.well-known/jwks.json")
print(response.status_code)  # Should be 200
print(response.json())  # Should show JWKS keys
```

If this fails, it's a network/connectivity issue.

## Common Issues

1. **Railway network restrictions**: Some Railway plans have network restrictions
2. **Firewall**: Corporate firewall blocking Supabase
3. **Wrong Supabase URL**: Double-check the URL in Flask matches your project
4. **JWT library version**: Older versions might have issues with JWKS fetching
