# Backend Quick Start & Testing

## Installation

```bash
cd my-app/backend

# Create virtual environment (if not already created)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

---

## Environment Setup

Create `.env` file in `my-app/backend/`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FRONTEND_URL=http://localhost:3000
ADDITIONAL_ORIGINS=
```

---

## Running the Server

```bash
# Development with hot reload
python -m uvicorn main:app --reload

# Production
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Server starts at: `http://localhost:8000`

---

## Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "configured": true,
  "timestamp": "2026-03-29T12:34:56.789"
}
```

---

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Testing the Fixed Issues

### ✅ Test 1: Schedule Generation (Fixed get_sections_for_scheduling)

```bash
curl -X POST http://localhost:8000/api/schedules/generate \
  -H "Content-Type: application/json" \
  -d '{
    "schedule_name": "Test Schedule",
    "semester": "1st Semester",
    "academic_year": "2024-2025",
    "sections_data": [
      {
        "id": 1,
        "section_code": "BSCS-1A",
        "course_code": "CS101",
        "course_name": "Intro to CS",
        "teacher_id": 1,
        "teacher_name": "Dr. Smith",
        "year_level": 1,
        "student_count": 30,
        "required_room_type": "classroom",
        "weekly_hours": 3,
        "requires_lab": false,
        "department": "CS"
      }
    ],
    "rooms_data": [
      {
        "id": 1,
        "room_code": "A101",
        "building": "A",
        "campus": "Main",
        "capacity": 40,
        "room_type": "classroom"
      }
    ],
    "max_iterations": 100,
    "initial_temperature": 50.0,
    "cooling_rate": 0.95
  }'
```

Expected: 200 OK with schedule details (not 500 error)

---

### ✅ Test 2: Conflict Detection (Fixed endpoint redesign)

```bash
curl http://localhost:8000/api/schedules/1/conflicts
```

Expected response:
```json
{
  "schedule_id": 1,
  "has_conflicts": false,
  "room_conflicts": [],
  "teacher_conflicts": [],
  "total_conflicts": 0,
  "total_allocations": 3
}
```

**Not** error or missing data

---

### ✅ Test 3: Room Utilization Analytics (Fixed argument passing)

```bash
# Must pass schedule_id as query parameter
curl http://localhost:8000/api/analytics/room-utilization?schedule_id=1
```

Expected: 200 OK with utilization data structure

---

### ✅ Test 4: List Rooms (Optimized with DB filtering)

```bash
# Database-level filtering (fast)
curl http://localhost:8000/api/rooms?campus=Main&room_type=classroom
```

Expected: Rooms filtered by campus and type (response should be quick)

---

### ✅ Test 5: List Sections (With required args)

```bash
curl http://localhost:8000/api/sections?department=CS
```

Expected: Sections from Computer Science department

---

### ✅ Test 6: Teachers List (Uses faculty_profiles)

```bash
curl http://localhost:8000/api/teachers
```

Expected: Teacher list from faculty_profiles (not broken due to table mismatch)

---

### ✅ Test 7: Error Messages (Sanitized)

```bash
curl http://localhost:8000/api/schedules/99999/conflicts
```

Expected response (when schedule doesn't exist):
```json
{
  "detail": "Schedule not found"
}
```

**Not**: Internal exception text or stack trace

---

### ✅ Test 8: Input Validation (Before expensive processing)

```bash
# Invalid parameters should fail fast
curl -X POST http://localhost:8000/api/schedules/generate \
  -H "Content-Type: application/json" \
  -d '{
    "schedule_name": "",
    "semester": "1st",
    "academic_year": "2024-2025",
    "sections_data": [],
    "rooms_data": [],
    "max_iterations": 50,
    "cooling_rate": 1.5
  }'
```

Expected: 400 Bad Request (immediate, before scheduler runs)

---

## Verification Checklist

After fixes, verify:

- [ ] Server starts without SSL/import errors
- [ ] `/health` endpoint returns 200
- [ ] `/api/schedules/generate` returns proper response (not 500)
- [ ] `/api/schedules/{id}/conflicts` returns conflict data structure
- [ ] `/api/analytics/room-utilization?schedule_id=1` returns utilization %
- [ ] Error responses don't contain exception text
- [ ] Input validation rejects invalid data immediately
- [ ] All endpoints complete within <5 seconds (except generate_schedule)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Module 'database' has no attribute '_db'` | Make sure imports in main.py are correct |
| `TypeError: missing required positional args` | Check function signature in database.py vs. call in main.py |
| `Table 'xxx' not found` | Verify table names in database.py match Supabase schema |
| `Connection timeout` | Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env |
| `Endpoint returns 500` | Check server logs for detailed error (should be logged) |

---

## Deployment Checklist

Before pushing to production:

- [ ] All tests from "Testing the Fixed Issues" pass
- [ ] `.env` file is not committed (add to .gitignore)
- [ ] Dependencies in requirements.txt are pinned: `package==1.2.3`
- [ ] Syntax validation: `python -m py_compile *.py`
- [ ] Error handling covers all exception types
- [ ] Database indexes exist on frequently filtered columns
- [ ] CORS origins include production frontend URL

---

## Performance Monitoring

Monitor these metrics after deployment:

```bash
# Response times (should see in logs)
print(f"⏰ Request completed in {time.time() - start}ms")

# Error rate (watch for increases)
# Look for "❌ ERROR" messages in logs

# Database connection issues
# Monitor Supabase dashboard for connection count
```

---

## Next Steps

1. Run test suite above ✅
2. Review [BACKEND_IMPROVEMENTS.md](BACKEND_IMPROVEMENTS.md) for details on each fix
3. Share [BACKEND_DEV_GUIDE.md](BACKEND_DEV_GUIDE.md) with team
4. Schedule code review before merging to main
5. Deploy to staging environment for QA testing

---

**Last Updated**: March 29, 2026  
**Backend Status**: ✅ Ready for Testing
