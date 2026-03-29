# Backend Development Guidelines

## Architecture Overview

```
my-app/backend/
├── main.py              # FastAPI routes & request handlers
├── database.py          # Supabase client & async data access
├── models.py            # Pydantic schemas for validation
├── scheduler.py         # Original scheduling algorithm
├── scheduler_v2.py      # Enhanced quantum-inspired scheduler
```

---

## Critical Patterns to Follow

### 1. ✅ Function Signature Consistency

When calling database functions from endpoints, **always verify parameter requirements**:

```python
# ❌ WRONG: Missing semester/academic_year
sections = await get_sections_for_scheduling()

# ✅ CORRECT: Provide all required parameters
sections = await get_sections_for_scheduling(
    request.semester, 
    request.academic_year
)
```

**Rule**: Check `database.py` function signatures before calling.

---

### 2. ✅ Data Field Alignment

When saving allocations, include fields needed by analytics readers:

```python
# Fields MUST be present for analytics functions:
allocation = {
    "section_id": entry.get("section_id"),      # ← For get_teacher_workload
    "day_of_week": entry.get("day_of_week"),    # ← For get_teacher_workload
    "teacher_id": entry.get("teacher_id"),      # ← For conflict detection
    "schedule_day": entry.get("day_of_week"),   # ← For compatibility
    "schedule_time": f"{start} - {end}",
    # ... other fields
}
```

**Rule**: Export fields that later queries will read.

---

### 3. ✅ Table Source Consistency

Choose ONE data source and use it everywhere:

```python
# ✅ CORRECT: Teachers always use faculty_profiles
async def get_all_teachers():
    response = _db().table("faculty_profiles").select("*").execute()

async def create_teacher(data):
    response = _db().table("faculty_profiles").insert(data).execute()
```

**Rule**: Document table names in comments. Don't mix `teachers` and `faculty_profiles`.

---

### 4. ✅ Error Response Sanitization

Never leak internal errors to clients:

```python
# ❌ WRONG: Exposes database internals
raise HTTPException(status_code=500, detail=str(e))

# ✅ CORRECT: Generic user-facing message
raise HTTPException(status_code=500, detail="Failed to retrieve schedule")
```

**Rule**: Generic error messages + log details server-side with `print()` or logging module.

---

### 5. ✅ Input Validation Before Processing

Validate expensive operations early:

```python
# ✅ CORRECT: Validate before heavy computation
@app.post("/api/schedules/generate")
async def generate_schedule(request: ScheduleGenerationRequest):
    # Validate immediately
    if not request.schedule_name or not request.schedule_name.strip():
        raise HTTPException(status_code=400, detail="schedule_name required")
    
    # Then run expensive scheduler
    result = run_enhanced_scheduler(...)
```

**Rule**: Validate inputs before calling CPU-intensive functions.

---

### 6. ✅ Database Query Optimization

Use database-level filtering instead of in-memory filtering:

```python
# ❌ WRONG: Fetch all, filter in Python (O(n) memory)
rooms = await get_all_rooms()
rooms = [r for r in rooms if r.get("campus") == campus]

# ✅ CORRECT: Filter at database (O(1) memory)
rooms = await get_available_rooms(campus=campus)
```

**Rule**: Use `WHERE` clauses in database, not Python list comprehensions.

---

### 7. ✅ Result Size Limits

Prevent memory exhaustion from large datasets:

```python
# ✅ CORRECT: Limit result set
response = _db().table("sections").select("*").limit(5000).execute()
```

**Rule**: Add `.limit(N)` to queries that might return many rows.

---

## Common Pitfalls & Fixes

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Missing function args | `TypeError: missing required argument` | Check function signature in database.py |
| Field name mismatch | Analytics returns empty/KeyError | Add field to allocation during save |
| Wrong table name | `Table not found` error | Grep for table name, use one source |
| Error leakage | `"detail": "..."` contains internal details | Use generic error messages |
| No input validation | Endpoint hangs on bad parameters | Add validation at start of handler |
| In-memory filtering | Endpoint times out on large data | Use database WHERE clauses |

---

## Testing Checklist

Before committing backend changes:

- [ ] **Syntax**: `python -m py_compile main.py database.py models.py`
- [ ] **Function signatures**: Verify all DB function calls match definitions
- [ ] **Data fields**: Check allocations include fields needed by readers
- [ ] **Error handling**: All exceptions return generic messages
- [ ] **Input validation**: Required parameters checked early
- [ ] **Database queries**: No `for loop` filtering after fetching all rows

---

## Quick Reference: Key Functions

### Database reads (main.py callers should know these signatures)

```python
# REQUIRES: semester, academic_year
get_sections_for_scheduling(semester, academic_year, department=None)

# OPTIONAL: campus, building
get_all_rooms(campus=None, building=None)

# OPTIONAL: room_type, min_capacity, campus
get_available_rooms(room_type=None, min_capacity=0, campus=None)

# OPTIONAL: department
get_all_sections(department=None)
get_all_teachers(department=None)

# NO ARGS
get_time_slots()
get_all_schedules()
get_generated_schedules()
```

### Database writes

```python
# Returns created record
create_generated_schedule(schedule_data: Dict)
save_room_allocations(allocations: List[Dict])
create_teacher(teacher_data: Dict)

# Returns list of created records
bulk_create_rooms(rooms: List[Dict])
bulk_create_sections(sections: List[Dict])
bulk_create_teachers(teachers: List[Dict])
```

---

## Performance Guidelines

- **Fast queries** (<100ms): get_all_rooms, get_time_slots
- **Medium queries** (100-500ms): get_all_sections (with joins), get_generated_schedules
- **Slow queries** (>1s): schedule generation (expected, runs optimizer)
- **Optimize if**: Endpoint response > 5 seconds (except generate_schedule)

---

## Monitoring & Debugging

### Check for common issues:

```bash
# Syntax errors
python -m py_compile my-app/backend/main.py

# Runtime errors (run server locally)
cd my-app/backend
python -m uvicorn main:app --reload
```

### Log places to monitor:

```python
# Schedule generation logging (should see progress messages)
print("🚀 SCHEDULE GENERATION STARTED")
print("📚 Sections to schedule: {len(sections)}")

# Database errors (won't show in response, but terminal)
except Exception as e:
    traceback.print_exc()  # Log before raising
```

---

## Code Style

- Use type hints: `async def get_schedule(schedule_id: int) -> Optional[Dict]:`
- Use docstrings: `"""Get a schedule by ID with all entries"""`
- Use emoji in logs for visibility: 🚀 start, ✅ success, ❌ error, ⏰ timing
- Comment non-obvious logic: `# Filter by department at DB level for efficiency`

---

**Version**: 1.0  
**Last Updated**: March 29, 2026
