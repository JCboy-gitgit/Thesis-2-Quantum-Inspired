"""
Database connection and helper functions for Supabase
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_supabase_client() -> Client:
    """Return the Supabase client instance"""
    return supabase


# ==================== Room Operations ====================
async def get_all_rooms(campus: Optional[str] = None, building: Optional[str] = None) -> List[Dict]:
    """Fetch all rooms, optionally filtered by campus/building"""
    query = supabase.table("rooms").select("*")
    
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
    query = supabase.table("rooms").select("*").eq("is_available", True)
    
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
    response = supabase.table("rooms").insert(room_data).execute()
    return response.data[0] if response.data else {}


async def bulk_create_rooms(rooms: List[Dict]) -> List[Dict]:
    """Bulk create rooms"""
    response = supabase.table("rooms").insert(rooms).execute()
    return response.data or []


# ==================== Course Operations ====================
async def get_all_courses(department: Optional[str] = None) -> List[Dict]:
    """Fetch all courses"""
    query = supabase.table("courses").select("*")
    
    if department:
        query = query.eq("department", department)
    
    response = query.execute()
    return response.data or []


async def create_course(course_data: Dict) -> Dict:
    """Create a new course"""
    response = supabase.table("courses").insert(course_data).execute()
    return response.data[0] if response.data else {}


# ==================== Section Operations ====================
async def get_sections_for_scheduling(
    semester: str,
    academic_year: str,
    department: Optional[str] = None
) -> List[Dict]:
    """Get all sections that need scheduling"""
    query = supabase.table("sections").select(
        "*, courses(*), teachers(*)"
    ).eq("semester", semester).eq("academic_year", academic_year)
    
    if department:
        query = query.eq("department", department)
    
    response = query.execute()
    return response.data or []


async def create_section(section_data: Dict) -> Dict:
    """Create a new section"""
    response = supabase.table("sections").insert(section_data).execute()
    return response.data[0] if response.data else {}


async def bulk_create_sections(sections: List[Dict]) -> List[Dict]:
    """Bulk create sections"""
    response = supabase.table("sections").insert(sections).execute()
    return response.data or []


# ==================== Teacher Operations ====================
async def get_all_teachers(department: Optional[str] = None) -> List[Dict]:
    """Fetch all teachers"""
    query = supabase.table("teachers").select("*")
    
    if department:
        query = query.eq("department", department)
    
    response = query.execute()
    return response.data or []


async def get_teacher_availability(teacher_id: int) -> Dict:
    """Get teacher's availability and preferences"""
    response = supabase.table("teachers").select("*").eq("id", teacher_id).single().execute()
    return response.data or {}


async def create_teacher(teacher_data: Dict) -> Dict:
    """Create a new teacher"""
    response = supabase.table("teachers").insert(teacher_data).execute()
    return response.data[0] if response.data else {}


async def bulk_create_teachers(teachers: List[Dict]) -> List[Dict]:
    """Bulk create teachers"""
    response = supabase.table("teachers").insert(teachers).execute()
    return response.data or []


# ==================== Time Slot Operations ====================
async def get_time_slots() -> List[Dict]:
    """Get all time slots"""
    response = supabase.table("time_slots").select("*").order("start_time").execute()
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
    
    response = supabase.table("time_slots").insert(default_slots).execute()
    return response.data or []


# ==================== Schedule Operations ====================
async def save_schedule_summary(summary_data: Dict) -> Dict:
    """Save schedule summary"""
    response = supabase.table("class_schedule_summary").insert(summary_data).execute()
    return response.data[0] if response.data else {}


async def save_schedule_entries(entries: List[Dict]) -> List[Dict]:
    """Save schedule entries"""
    if not entries:
        return []
    response = supabase.table("class_schedule_entries").insert(entries).execute()
    return response.data or []


async def get_schedule_entries(schedule_id: int) -> List[Dict]:
    """Get all entries for a schedule"""
    response = supabase.table("class_schedule_entries").select(
        "*, rooms(*), sections(*), teachers(*)"
    ).eq("schedule_summary_id", schedule_id).execute()
    return response.data or []


async def get_all_schedules() -> List[Dict]:
    """Get all schedule summaries"""
    response = supabase.table("class_schedule_summary").select("*").order(
        "created_at", desc=True
    ).execute()
    return response.data or []


async def get_schedule_by_id(schedule_id: int) -> Optional[Dict]:
    """Get a specific schedule by ID"""
    response = supabase.table("class_schedule_summary").select("*").eq(
        "id", schedule_id
    ).execute()
    return response.data[0] if response.data else None


async def create_schedule_record(schedule_data: Dict) -> Dict:
    """Create a new schedule summary record"""
    response = supabase.table("class_schedule_summary").insert(schedule_data).execute()
    return response.data[0] if response.data else {}


async def update_schedule_status(schedule_id: int, status: str, message: str = "") -> Dict:
    """Update the status of a schedule"""
    update_data = {"status": status}
    if message:
        update_data["message"] = message
    response = supabase.table("class_schedule_summary").update(update_data).eq(
        "id", schedule_id
    ).execute()
    return response.data[0] if response.data else {}


async def delete_schedule(schedule_id: int) -> bool:
    """Delete a schedule and its entries"""
    # Delete entries first
    supabase.table("class_schedule_entries").delete().eq("schedule_summary_id", schedule_id).execute()
    # Delete summary
    supabase.table("class_schedule_summary").delete().eq("id", schedule_id).execute()
    return True


# ==================== Conflict Detection ====================
async def check_room_conflicts(
    room_id: int,
    day_of_week: str,
    time_slot_id: int,
    schedule_id: int
) -> List[Dict]:
    """Check if room is already booked at this time"""
    response = supabase.table("class_schedule_entries").select("*").eq(
        "room_id", room_id
    ).eq("day_of_week", day_of_week).eq("time_slot_id", time_slot_id).eq(
        "schedule_summary_id", schedule_id
    ).execute()
    return response.data or []


async def check_teacher_conflicts(
    teacher_id: int,
    day_of_week: str,
    time_slot_id: int,
    schedule_id: int
) -> List[Dict]:
    """Check if teacher is already scheduled at this time"""
    response = supabase.table("class_schedule_entries").select("*").eq(
        "teacher_id", teacher_id
    ).eq("day_of_week", day_of_week).eq("time_slot_id", time_slot_id).eq(
        "schedule_summary_id", schedule_id
    ).execute()
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
