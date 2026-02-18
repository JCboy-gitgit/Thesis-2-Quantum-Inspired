"""
Database connection and helper functions for Supabase
"""
import os
import sys
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


# ==================== Room Operations ====================
async def get_all_rooms(campus: Optional[str] = None, building: Optional[str] = None) -> List[Dict]:
    """Fetch all rooms, optionally filtered by campus/building"""
    query = _db().table("rooms").select("*")
    
    if campus:
        query = query.eq("campus", campus)
    if building:
        query = query.eq("building", building)
    
    response = query.execute()
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
    
    response = query.execute()
    return response.data or []


async def create_room(room_data: Dict) -> Dict:
    """Create a new room"""
    response = _db().table("rooms").insert(room_data).execute()
    return response.data[0] if response.data else {}


async def bulk_create_rooms(rooms: List[Dict]) -> List[Dict]:
    """Bulk create rooms"""
    response = _db().table("rooms").insert(rooms).execute()
    return response.data or []


# ==================== Course Operations ====================
async def get_all_courses(department: Optional[str] = None) -> List[Dict]:
    """Fetch all courses"""
    query = _db().table("courses").select("*")
    
    if department:
        query = query.eq("department", department)
    
    response = query.execute()
    return response.data or []


async def create_course(course_data: Dict) -> Dict:
    """Create a new course"""
    response = _db().table("courses").insert(course_data).execute()
    return response.data[0] if response.data else {}


# ==================== Section Operations ====================
async def get_all_sections(department: Optional[str] = None) -> List[Dict]:
    """Fetch all sections without requiring semester/academic year"""
    query = _db().table("sections").select("*, courses(*), teachers(*)")
    
    if department:
        query = query.eq("department", department)
    
    response = query.execute()
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
    
    response = query.execute()
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
        
        req_response = req_query.execute()
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
    response = _db().table("sections").insert(section_data).execute()
    return response.data[0] if response.data else {}


async def bulk_create_sections(sections: List[Dict]) -> List[Dict]:
    """Bulk create sections"""
    response = _db().table("sections").insert(sections).execute()
    return response.data or []


# ==================== Teacher Operations ====================
async def get_all_teachers(department: Optional[str] = None) -> List[Dict]:
    """Fetch all teachers from faculty_profiles"""
    # Use 'faculty_profiles' table (renamed/new schema)
    query = _db().table("faculty_profiles").select("*")
    
    if department:
        query = query.eq("department", department)
    
    response = query.execute()
    data = response.data or []
    
    # Map 'full_name' to 'name' for compatibility
    for t in data:
        if 'full_name' in t and 'name' not in t:
            t['name'] = t['full_name']
            
    return data


async def get_teacher_availability(teacher_id: Any) -> Dict:
    """Get teacher's availability and preferences"""
    # Accept str or int ID
    response = _db().table("faculty_profiles").select("*").eq("id", teacher_id).single().execute()
    data = response.data or {}
    if data and 'full_name' in data:
        data['name'] = data['full_name']
    return data


async def create_teacher(teacher_data: Dict) -> Dict:
    """Create a new teacher"""
    response = _db().table("teachers").insert(teacher_data).execute()
    return response.data[0] if response.data else {}


async def bulk_create_teachers(teachers: List[Dict]) -> List[Dict]:
    """Bulk create teachers"""
    response = _db().table("teachers").insert(teachers).execute()
    return response.data or []


# ==================== Time Slot Operations ====================
async def get_time_slots() -> List[Dict]:
    """Get all time slots"""
    response = _db().table("time_slots").select("*").order("start_time").execute()
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
    
    response = _db().table("time_slots").insert(default_slots).execute()
    return response.data or []


# ==================== Schedule Operations (Legacy - Now uses generated_schedules) ====================
async def save_schedule_summary(summary_data: Dict) -> Dict:
    """Save schedule summary - DEPRECATED: Use create_generated_schedule instead"""
    response = _db().table("generated_schedules").insert(summary_data).execute()
    return response.data[0] if response.data else {}


async def save_schedule_entries(entries: List[Dict]) -> List[Dict]:
    """Save schedule entries/batches - DEPRECATED: Use save_room_allocations instead"""
    if not entries:
        return []
    response = _db().table("room_allocations").insert(entries).execute()
    return response.data or []


async def get_schedule_entries(schedule_id: int) -> List[Dict]:
    """Get all entries for a schedule"""
    response = _db().table("room_allocations").select("*").eq(
        "schedule_id", schedule_id
    ).execute()
    return response.data or []


async def get_all_schedules() -> List[Dict]:
    """Get all schedules - Now uses generated_schedules table"""
    response = _db().table("generated_schedules").select("*").order(
        "created_at", desc=True
    ).execute()
    return response.data or []


async def get_schedule_by_id(schedule_id: int) -> Optional[Dict]:
    """Get a specific schedule by ID - Now uses generated_schedules table"""
    response = _db().table("generated_schedules").select("*").eq(
        "id", schedule_id
    ).execute()
    return response.data[0] if response.data else None


async def create_schedule_record(schedule_data: Dict) -> Dict:
    """Create a new schedule record - Now uses generated_schedules table"""
    response = _db().table("generated_schedules").insert(schedule_data).execute()
    return response.data[0] if response.data else {}


async def update_schedule_status(schedule_id: int, status: str, message: str = "") -> Dict:
    """Update the status of a schedule - Now uses generated_schedules table"""
    update_data = {"status": status}
    if message:
        update_data["notes"] = message
    response = _db().table("generated_schedules").update(update_data).eq(
        "id", schedule_id
    ).execute()
    return response.data[0] if response.data else {}


async def delete_schedule(schedule_id: int) -> bool:
    """Delete a schedule and its entries - Now uses generated_schedules and room_allocations"""
    # Delete allocations first (foreign key)
    _db().table("room_allocations").delete().eq("schedule_id", schedule_id).execute()
    # Delete schedule
    _db().table("generated_schedules").delete().eq("id", schedule_id).execute()
    return True


# ==================== Conflict Detection ====================
async def check_room_conflicts(
    room_id: int,
    day_of_week: str,
    time_slot_id: int,
    schedule_id: int
) -> List[Dict]:
    """Check if room is already booked at this time - Now uses room_allocations"""
    response = _db().table("room_allocations").select("*").eq(
        "room_id", room_id
    ).eq("schedule_day", day_of_week).eq(
        "schedule_id", schedule_id
    ).execute()
    return response.data or []


async def check_teacher_conflicts(
    teacher_id: int,
    day_of_week: str,
    time_slot_id: int,
    schedule_id: int
) -> List[Dict]:
    """Check if teacher is already scheduled at this time - Now uses room_allocations"""
    response = _db().table("room_allocations").select("*").eq(
        "schedule_id", schedule_id
    ).eq("schedule_day", day_of_week).execute()
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
        teacher_entries = [e for e in entries if e["teacher_id"] == teacher["id"]]
        days_working = list(set([e["day_of_week"] for e in teacher_entries]))
        
        workload.append({
            "teacher_id": teacher["id"],
            "teacher_name": teacher["name"],
            "total_hours": len(teacher_entries) * 1.5,  # Assuming 90 min per slot
            "sections_count": len(set([e["section_id"] for e in teacher_entries])),
            "days_working": days_working
        })
    
    return workload


# ==================== Generated Schedules & Room Allocations ====================

async def create_generated_schedule(schedule_data: Dict) -> Dict:
    """Create a new generated schedule record"""
    response = _db().table("generated_schedules").insert(schedule_data).execute()
    return response.data[0] if response.data else {}


async def update_generated_schedule(schedule_id: int, update_data: Dict) -> Dict:
    """Update a generated schedule record"""
    response = _db().table("generated_schedules").update(update_data).eq(
        "id", schedule_id
    ).execute()
    return response.data[0] if response.data else {}


async def save_room_allocations(allocations: List[Dict]) -> List[Dict]:
    """Save room allocation entries for a schedule"""
    if not allocations:
        return []
    response = _db().table("room_allocations").insert(allocations).execute()
    return response.data or []


async def get_generated_schedules() -> List[Dict]:
    """Get all generated schedules"""
    response = _db().table("generated_schedules").select("*").order(
        "created_at", desc=True
    ).execute()
    return response.data or []


async def get_generated_schedule_by_id(schedule_id: int) -> Optional[Dict]:
    """Get a specific generated schedule by ID with its allocations"""
    schedule_response = _db().table("generated_schedules").select("*").eq(
        "id", schedule_id
    ).execute()
    
    if not schedule_response.data:
        return None
    
    schedule = schedule_response.data[0]
    
    # Get room allocations for this schedule
    allocations_response = _db().table("room_allocations").select("*").eq(
        "schedule_id", schedule_id
    ).execute()
    
    schedule["allocations"] = allocations_response.data or []
    return schedule


async def delete_generated_schedule(schedule_id: int) -> bool:
    """Delete a generated schedule and its allocations (cascade delete handles allocations)"""
    _db().table("generated_schedules").delete().eq("id", schedule_id).execute()
    return True


async def get_room_allocations_by_schedule(schedule_id: int) -> List[Dict]:
    """Get all room allocations for a schedule"""
    response = _db().table("room_allocations").select("*").eq(
        "schedule_id", schedule_id
    ).execute()
    return response.data or []
