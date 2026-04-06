"""
Database connection and helper functions for Supabase
"""
import os
import sys
import re
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

load_dotenv()

# Use service role key for backend operations (bypasses RLS)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Gracefully handle missing environment variables
if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️  WARNING: Missing Supabase environment variables!")
    print("   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    print("   The server will start but database operations will fail.")
    # Create a dummy client that will fail gracefully on operations
    supabase = None
else:
    print(f"🔑 Connected to Supabase: {SUPABASE_URL}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_supabase_client() -> Client:
    """Return the Supabase client instance"""
    if supabase is None:
        raise ValueError("Supabase client not initialized. Check environment variables.")
    return supabase


def _db() -> Client:
    """Internal helper to get database client with null check"""
    return get_supabase_client()


async def _execute(query):
    """Execute a Supabase query in a worker thread to avoid blocking the event loop."""
    return await asyncio.to_thread(query.execute)


# ==================== Room Operations ====================
async def get_all_rooms(campus: Optional[str] = None, building: Optional[str] = None) -> List[Dict]:
    """Fetch all rooms, optionally filtered by campus/building"""
    query = _db().table("rooms").select("*")
    
    if campus:
        query = query.eq("campus", campus)
    if building:
        query = query.eq("building", building)
    
    response = await _execute(query)
    return response.data or []


async def get_available_rooms(
    room_type: Optional[str] = None,
    min_capacity: int = 0,
    campus: Optional[str] = None
) -> List[Dict]:
    """Get available rooms filtered by type and capacity"""
    query = _db().table("rooms").select("*").eq("is_available", True)
    
    if room_type:
        query = query.eq("room_type", room_type)
    if min_capacity > 0:
        query = query.gte("capacity", min_capacity)
    if campus:
        query = query.eq("campus", campus)
    
    response = await _execute(query)
    return response.data or []


async def create_room(room_data: Dict) -> Dict:
    """Create a new room"""
    response = await _execute(_db().table("rooms").insert(room_data))
    return response.data[0] if response.data else {}


async def bulk_create_rooms(rooms: List[Dict]) -> List[Dict]:
    """Bulk create rooms"""
    response = await _execute(_db().table("rooms").insert(rooms))
    return response.data or []


# ==================== Course Operations ====================
async def get_all_courses(department: Optional[str] = None) -> List[Dict]:
    """Fetch all courses"""
    query = _db().table("courses").select("*")
    
    if department:
        query = query.eq("department", department)
    
    response = await _execute(query)
    return response.data or []


async def create_course(course_data: Dict) -> Dict:
    """Create a new course"""
    response = await _execute(_db().table("courses").insert(course_data))
    return response.data[0] if response.data else {}


# ==================== Section Operations ====================
async def get_all_sections(department: Optional[str] = None) -> List[Dict]:
    """Fetch all sections without requiring semester/academic year"""
    query = _db().table("sections").select("*, courses(*), teachers(*)")
    
    if department:
        query = query.eq("department", department)
    
    # Optimize for large datasets: limit result size, order by recent
    response = await _execute(query.limit(5000).order("created_at", desc=True))
    return response.data or []


async def get_sections_for_scheduling(
    semester: str,
    academic_year: str,
    department: Optional[str] = None
) -> List[Dict]:
    """Get all sections that need scheduling, enriched with course requirements"""
    query = _db().table("sections").select(
        "*, courses(*), teachers(*)"
    ).eq("semester", semester).eq("academic_year", academic_year)
    
    if department:
        query = query.eq("department", department)
    
    response = await _execute(query)
    sections = response.data or []
    
    if not sections:
        return []

    # Get unique course IDs
    course_ids = list(set([s.get("course_id") for s in sections if s.get("course_id")]))
    
    if not course_ids:
        return sections

    # Fetch requirements for these courses
    try:
        # We join feature_tags to get tag_name
        req_query = _db().table("subject_room_requirements").select(
            "course_id, is_mandatory, notes, feature_tags(tag_name)"
        ).in_("course_id", course_ids)
        
        req_response = await _execute(req_query)
        requirements = req_response.data or []
        
        # Process requirements
        course_reqs = {} # course_id -> { 'all': [], 'lec': [], 'lab': [] }
        
        for r in requirements:
            c_id = r.get("course_id")
            tag = r.get("feature_tags")
            if not tag: continue
            tag_name = tag.get("tag_name")
            if not tag_name: continue
            
            notes = (r.get("notes") or "").upper()
            
            if c_id not in course_reqs:
                course_reqs[c_id] = {'all': [], 'lec': [], 'lab': []}
                
            course_reqs[c_id]['all'].append(tag_name)
            
            if notes == 'LEC':
                course_reqs[c_id]['lec'].append(tag_name)
            elif notes == 'BOTH':
                course_reqs[c_id]['lec'].append(tag_name)
                course_reqs[c_id]['lab'].append(tag_name)
            elif notes == 'LAB': 
                course_reqs[c_id]['lab'].append(tag_name)
            else: # Legacy / No notes (Treat as General/Shared with heuristic)
                course_reqs[c_id]['lab'].append(tag_name)
                # For legacy data, auto-assign basic features to lecture
                if tag_name in {'TV_Display', 'Projector', 'Whiteboard', 'Sound_System', 'Air_Conditioning', 'Accessibility', 'Podium', 'Smart_TV', 'Monitor'}:
                     course_reqs[c_id]['lec'].append(tag_name)
                
        # Augment sections
        for section in sections:
            c_id = section.get("course_id")
            if c_id in course_reqs:
                reqs = course_reqs[c_id]
                section['required_features'] = reqs['all']
                section['lec_required_features'] = reqs['lec']
                section['lab_required_features'] = reqs['lab']
                
    except Exception as e:
        print(f"⚠️ Error fetching requirements: {e}")
        # Continue without requirements rather than failing completely
            
    return sections


async def create_section(section_data: Dict) -> Dict:
    """Create a new section"""
    response = await _execute(_db().table("sections").insert(section_data))
    return response.data[0] if response.data else {}


async def bulk_create_sections(sections: List[Dict]) -> List[Dict]:
    """Bulk create sections"""
    response = await _execute(_db().table("sections").insert(sections))
    return response.data or []


# ==================== Teacher Operations ====================
async def get_all_teachers(department: Optional[str] = None) -> List[Dict]:
    """Fetch all teachers from faculty_profiles"""
    # Use 'faculty_profiles' table (renamed/new schema)
    query = _db().table("faculty_profiles").select("*")
    
    if department:
        query = query.eq("department", department)
    
    response = await _execute(query)
    data = response.data or []
    
    # Map 'full_name' to 'name' for compatibility
    for t in data:
        if 'full_name' in t and 'name' not in t:
            t['name'] = t['full_name']
            
    return data


async def get_teacher_availability(teacher_id: Any) -> Dict:
    """Get teacher's availability and preferences"""
    # Accept str or int ID
    response = await _execute(_db().table("faculty_profiles").select("*").eq("id", teacher_id).single())
    data = response.data or {}
    if data and 'full_name' in data:
        data['name'] = data['full_name']
    return data


async def create_teacher(teacher_data: Dict) -> Dict:
    """Create a new teacher in faculty_profiles"""
    response = await _execute(_db().table("faculty_profiles").insert(teacher_data))
    return response.data[0] if response.data else {}


async def bulk_create_teachers(teachers: List[Dict]) -> List[Dict]:
    """Bulk create teachers in faculty_profiles"""
    response = await _execute(_db().table("faculty_profiles").insert(teachers))
    return response.data or []


# ==================== Time Slot Operations ====================
async def get_time_slots() -> List[Dict]:
    """Get all time slots"""
    response = await _execute(_db().table("time_slots").select("*").order("start_time"))
    return response.data or []


async def create_default_time_slots() -> List[Dict]:
    """Create default time slots if none exist"""
    existing = await get_time_slots()
    if existing:
        return existing
    
    default_slots = [
        {"slot_name": "Period 1", "start_time": "07:30", "end_time": "09:00", "duration_minutes": 90},
        {"slot_name": "Period 2", "start_time": "09:00", "end_time": "10:30", "duration_minutes": 90},
        {"slot_name": "Period 3", "start_time": "10:30", "end_time": "12:00", "duration_minutes": 90},
        {"slot_name": "Period 4", "start_time": "13:00", "end_time": "14:30", "duration_minutes": 90},
        {"slot_name": "Period 5", "start_time": "14:30", "end_time": "16:00", "duration_minutes": 90},
        {"slot_name": "Period 6", "start_time": "16:00", "end_time": "17:30", "duration_minutes": 90},
        {"slot_name": "Period 7", "start_time": "17:30", "end_time": "19:00", "duration_minutes": 90},
    ]
    
    response = await _execute(_db().table("time_slots").insert(default_slots))
    return response.data or []



# ==================== Schedule Operations (Legacy - Now uses generated_schedules) ====================
async def save_schedule_summary(summary_data: Dict) -> Dict:
    """Save schedule summary - DEPRECATED: Use create_generated_schedule instead"""
    response = await _execute(_db().table("generated_schedules").insert(summary_data))
    return response.data[0] if response.data else {}


async def save_schedule_entries(entries: List[Dict]) -> List[Dict]:
    """Save schedule entries/batches - DEPRECATED: Use save_room_allocations instead"""
    if not entries:
        return []
    response = await _execute(_db().table("room_allocations").insert(entries))
    return response.data or []


async def get_schedule_entries(schedule_id: int) -> List[Dict]:
    """Get all entries for a schedule"""
    response = await _execute(
        _db().table("room_allocations").select("*").eq("schedule_id", schedule_id)
    )
    return response.data or []


async def get_all_schedules() -> List[Dict]:
    """Get all schedules - Now uses generated_schedules table"""
    response = await _execute(
        _db().table("generated_schedules").select("*").order("created_at", desc=True)
    )
    return response.data or []


async def get_schedule_by_id(schedule_id: int) -> Optional[Dict]:
    """Get a specific schedule by ID - Now uses generated_schedules table"""
    response = await _execute(
        _db().table("generated_schedules").select("*").eq("id", schedule_id)
    )
    return response.data[0] if response.data else None


async def create_schedule_record(schedule_data: Dict) -> Dict:
    """Create a new schedule record - Now uses generated_schedules table"""
    response = await _execute(_db().table("generated_schedules").insert(schedule_data))
    return response.data[0] if response.data else {}


async def update_schedule_status(schedule_id: int, status: str, message: str = "") -> Dict:
    """Update the status of a schedule - Now uses generated_schedules table"""
    update_data = {"status": status}
    if message:
        update_data["notes"] = message
    response = await _execute(
        _db().table("generated_schedules").update(update_data).eq("id", schedule_id)
    )
    return response.data[0] if response.data else {}


async def delete_schedule(schedule_id: int) -> bool:
    """Delete a schedule and its entries - Now uses generated_schedules and room_allocations"""
    # Delete allocations first (foreign key)
    await _execute(_db().table("room_allocations").delete().eq("schedule_id", schedule_id))
    # Delete schedule
    await _execute(_db().table("generated_schedules").delete().eq("id", schedule_id))
    return True


# ==================== Conflict Detection ====================
async def check_room_conflicts(
    room_id: int,
    day_of_week: str,
    time_slot_id: int,
    schedule_id: int
) -> List[Dict]:
    """Check if room is already booked at this time - Now uses room_allocations"""
    response = await _execute(
        _db().table("room_allocations")
        .select("*")
        .eq("room_id", room_id)
        .eq("schedule_day", day_of_week)
        .eq("schedule_id", schedule_id)
    )
    return response.data or []


async def check_teacher_conflicts(
    teacher_id: int,
    day_of_week: str,
    time_slot_id: int,
    schedule_id: int
) -> List[Dict]:
    """Check if teacher is already scheduled at this time - Now uses room_allocations"""
    if not teacher_id:
        return []  # No teacher assigned
    response = await _execute(
        _db().table("room_allocations")
        .select("*")
        .eq("schedule_id", schedule_id)
        .eq("schedule_day", day_of_week)
        .eq("teacher_id", teacher_id)
    )
    return response.data or []


# ==================== Analytics ====================
async def get_room_utilization(schedule_id: int) -> List[Dict]:
    """Calculate room utilization for a schedule"""
    entries = await get_schedule_entries(schedule_id)
    rooms = await get_all_rooms()
    
    # Calculate total possible slots (rooms * days * time_slots)
    time_slots = await get_time_slots()
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    total_slots_per_room = len(time_slots) * len(days)
    
    utilization = []
    for room in rooms:
        used_slots = len([e for e in entries if e["room_id"] == room["id"]])
        utilization.append({
            "room_id": room["id"],
            "room_code": room["room_code"],
            "room_name": room["room_name"],
            "total_slots": total_slots_per_room,
            "used_slots": used_slots,
            "utilization_percentage": round((used_slots / total_slots_per_room) * 100, 2) if total_slots_per_room > 0 else 0
        })
    
    return utilization


async def get_teacher_workload(schedule_id: int) -> List[Dict]:
    """Calculate teacher workload for a schedule"""
    entries = await get_schedule_entries(schedule_id)
    teachers = await get_all_teachers()
    
    workload = []
    for teacher in teachers:
        teacher_entries = [e for e in entries if e.get("teacher_id") == teacher.get("id")]
        days_working = list(
            set(
                [
                    (e.get("day_of_week") or e.get("schedule_day"))
                    for e in teacher_entries
                    if (e.get("day_of_week") or e.get("schedule_day"))
                ]
            )
        )
        
        workload.append({
            "teacher_id": teacher.get("id"),
            "teacher_name": teacher.get("name") or teacher.get("full_name") or "",
            "total_hours": len(teacher_entries) * 1.5,  # Assuming 90 min per slot
            "sections_count": len(set([e.get("section_id") for e in teacher_entries if e.get("section_id") is not None])),
            "days_working": days_working
        })
    
    return workload


# ==================== Generated Schedules & Room Allocations ====================

async def create_generated_schedule(schedule_data: Dict) -> Dict:
    """Create a new generated schedule record"""
    response = await _execute(_db().table("generated_schedules").insert(schedule_data))
    return response.data[0] if response.data else {}


async def update_generated_schedule(schedule_id: int, update_data: Dict) -> Dict:
    """Update a generated schedule record"""
    response = await _execute(
        _db().table("generated_schedules").update(update_data).eq("id", schedule_id)
    )
    return response.data[0] if response.data else {}


async def save_room_allocations(allocations: List[Dict]) -> List[Dict]:
    """Save room allocation entries for a schedule"""
    if not allocations:
        return []

    # Handle schema drift gracefully (e.g., environments that have not yet added
    # optional analytics columns like day_of_week/section_id/teacher_id).
    payload = [dict(item) for item in allocations]
    removed_columns: List[str] = []

    for _ in range(12):
        try:
            response = await _execute(_db().table("room_allocations").insert(payload))
            if removed_columns:
                print(
                    "⚠️ room_allocations insert fallback removed unknown columns: "
                    f"{', '.join(removed_columns)}"
                )
                print(
                    "   ↳ Recommended fix: apply Supabase migration "
                    "202604060001_add_room_allocations_analytics_columns.sql"
                )
            return response.data or []
        except Exception as exc:
            message = str(exc)
            match = re.search(r"Could not find the '([^']+)' column", message)
            if not match:
                raise

            missing_column = match.group(1)
            if not missing_column or missing_column in removed_columns:
                raise

            removed_columns.append(missing_column)
            payload = [{k: v for k, v in item.items() if k != missing_column} for item in payload]

            if payload and not payload[0]:
                raise ValueError("room_allocations payload became empty after removing unknown columns")

    raise ValueError("room_allocations insert failed after removing unsupported columns")


async def get_generated_schedules() -> List[Dict]:
    """Get all generated schedules"""
    response = await _execute(
        _db().table("generated_schedules").select("*").order("created_at", desc=True)
    )
    return response.data or []


async def get_generated_schedule_by_id(schedule_id: int) -> Optional[Dict]:
    """Get a specific generated schedule by ID with its allocations"""
    schedule_response = await _execute(
        _db().table("generated_schedules").select("*").eq("id", schedule_id)
    )
    
    if not schedule_response.data:
        return None
    
    schedule = schedule_response.data[0]
    
    # Get room allocations for this schedule
    allocations_response = await _execute(
        _db().table("room_allocations").select("*").eq("schedule_id", schedule_id)
    )
    
    schedule["allocations"] = allocations_response.data or []
    return schedule


async def delete_generated_schedule(schedule_id: int) -> bool:
    """Delete a generated schedule and its allocations (cascade delete handles allocations)"""
    await _execute(_db().table("generated_schedules").delete().eq("id", schedule_id))
    return True


async def get_room_allocations_by_schedule(schedule_id: int) -> List[Dict]:
    """Get all room allocations for a schedule"""
    response = await _execute(
        _db().table("room_allocations").select("*").eq("schedule_id", schedule_id)
    )
    return response.data or []
