# Backend Checklist: Why Old Recordings Aren't Showing

## Expected API Contract

Your Flask backend endpoint `/user/recordings` should:

### Request
```
GET /user/recordings?limit=10&offset=0
Headers:
  Authorization: Bearer <supabase_access_token>
```

### Response
```json
{
  "items": [
    {
      "id": "uuid",
      "created_at": "2026-01-20T10:00:00Z",
      "duration": 45.5
    }
  ],
  "limit": 10,
  "offset": 0,
  "total": 25  // optional
}
```

## Common Backend Issues to Check

### 1. **Date Filtering** ❌
**Problem**: Backend might be filtering out old recordings
```python
# ❌ BAD - Only shows last 30 days
WHERE created_at > NOW() - INTERVAL '30 days'

# ✅ GOOD - Show all recordings
WHERE user_id = current_user_id
```

**Check**: Look for any `WHERE created_at > ...` or date filters in your SQL query.

### 2. **Status Filtering** ❌
**Problem**: Backend might only return recordings with specific status
```python
# ❌ BAD - Only shows completed
WHERE status = 'completed'

# ✅ GOOD - Show all recordings (or filter appropriately)
WHERE status IN ('completed', 'processing', 'uploaded')
```

**Check**: Verify your status filter includes all relevant statuses.

### 3. **Pagination Not Working** ❌
**Problem**: Backend might not respect `limit` and `offset`
```python
# ❌ BAD - Ignores pagination
recordings = db.query(Recording).all()

# ✅ GOOD - Respects pagination
recordings = db.query(Recording)\
    .filter(Recording.user_id == user_id)\
    .order_by(Recording.created_at.desc())\
    .limit(limit)\
    .offset(offset)\
    .all()
```

**Check**: Ensure your query uses `LIMIT` and `OFFSET` correctly.

### 4. **Wrong Ordering** ⚠️
**Problem**: Backend might be ordering incorrectly
```python
# ❌ BAD - Oldest first (old recordings at end)
.order_by(Recording.created_at.asc())

# ✅ GOOD - Newest first (most recent at top)
.order_by(Recording.created_at.desc())
```

**Check**: Verify ordering is `DESC` (newest first).

### 5. **Missing Fields** ❌
**Problem**: Backend might not return all required fields
```python
# ❌ BAD - Missing fields
{
    "id": recording.id,
    # Missing created_at and duration!
}

# ✅ GOOD - All required fields
{
    "id": str(recording.id),
    "created_at": recording.created_at.isoformat(),
    "duration": float(recording.duration_seconds or 0)
}
```

**Check**: Ensure response includes `id`, `created_at`, and `duration`.

### 6. **User ID Mismatch** ❌
**Problem**: Backend might not filter by the correct user
```python
# ❌ BAD - Returns all users' recordings
recordings = db.query(Recording).all()

# ✅ GOOD - Filter by authenticated user
user_id = get_user_id_from_token(token)  # Extract from JWT
recordings = db.query(Recording)\
    .filter(Recording.user_id == user_id)\
    .all()
```

**Check**: Verify you're extracting `user_id` from the JWT token and filtering correctly.

### 7. **Database Query Issues** ❌
**Problem**: SQL query might have bugs
```python
# Check your SQL query for:
# - Missing JOINs
# - Incorrect table names
# - Wrong column names
# - NULL handling issues
```

## Recommended Flask Endpoint Implementation

```python
from flask import Blueprint, request, jsonify
from your_auth import verify_token, get_user_id_from_token

recordings_bp = Blueprint('recordings', __name__)

@recordings_bp.route('/user/recordings', methods=['GET'])
def get_user_recordings():
    # 1. Verify token
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        user_id = get_user_id_from_token(token)
    except Exception as e:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # 2. Get pagination params
    limit = request.args.get('limit', 10, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    # 3. Query database - NO date filtering, show ALL recordings
    recordings = db.query(Recording)\
        .filter(Recording.user_id == user_id)\
        .order_by(Recording.created_at.desc())  # Newest first
        .limit(limit)\
        .offset(offset)\
        .all()
    
    # 4. Get total count (optional, for pagination UI)
    total = db.query(Recording)\
        .filter(Recording.user_id == user_id)\
        .count()
    
    # 5. Format response
    items = [
        {
            'id': str(r.id),
            'created_at': r.created_at.isoformat() if r.created_at else None,
            'duration': float(r.duration_seconds or 0)
        }
        for r in recordings
    ]
    
    return jsonify({
        'items': items,
        'limit': limit,
        'offset': offset,
        'total': total
    })
```

## Debugging Steps

1. **Add logging to your Flask endpoint**:
```python
import logging
logger = logging.getLogger(__name__)

@recordings_bp.route('/user/recordings', methods=['GET'])
def get_user_recordings():
    logger.info(f"GET /user/recordings - limit={request.args.get('limit')}, offset={request.args.get('offset')}")
    # ... your code ...
    logger.info(f"Returning {len(items)} recordings")
    return jsonify({...})
```

2. **Test the endpoint directly**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/user/recordings?limit=10&offset=0"
```

3. **Check your database directly**:
```sql
-- Check if old recordings exist
SELECT id, created_at, duration_seconds, user_id 
FROM recordings 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Check total count
SELECT COUNT(*) FROM recordings WHERE user_id = 'YOUR_USER_ID';
```

4. **Compare with frontend logs**:
   - Check browser console for `[HistorySection] Received response`
   - Compare `itemsCount` with what you expect from database

## Most Likely Issues

Based on common problems:
1. **Date filtering** - Backend only showing recent recordings
2. **Status filtering** - Backend only showing "completed" recordings
3. **Missing pagination** - Backend not using LIMIT/OFFSET

Start by checking these three!
