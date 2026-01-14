"""
FastAPI Backend for College Room Allocation System

This API provides endpoints for:
- Generating class schedules with room allocation
- Managing rooms, courses, sections, and teachers
- Viewing and analyzing scheduling results
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime
import uvicorn
import os
from dotenv import load_dotenv

from models import (
    Room, Course, Section, Teacher, TimeSlot, 
    ScheduleEntry, GenerateScheduleRequest, ScheduleResult,
    RoomType, DayOfWeek
)
from database import (
    get_supabase_client, get_all_rooms, get_sections_for_scheduling, get_all_sections,
    get_all_teachers, get_time_slots, save_schedule_entries,
    check_room_conflicts, check_teacher_conflicts, get_room_utilization,
    create_schedule_record, update_schedule_status, get_schedule_by_id,
    delete_schedule, get_all_schedules,
    create_generated_schedule, update_generated_schedule, save_room_allocations,
    get_generated_schedules, get_generated_schedule_by_id, delete_generated_schedule,
    get_room_allocations_by_schedule
)
from scheduler import run_scheduler

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="College Room Allocation API",
    description="Quantum-Inspired Optimization for Class Room Scheduling",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Build allowed origins list for CORS
def get_allowed_origins():
    """Get list of allowed origins including Vercel preview URLs"""
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # Add production frontend URL from environment
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        origins.append(frontend_url)
    
    # Add additional origins from comma-separated list (for multiple Vercel previews)
    additional_origins = os.getenv("ADDITIONAL_ORIGINS", "")
    if additional_origins:
        origins.extend([o.strip() for o in additional_origins.split(",") if o.strip()])
    
    return origins

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",  # Allow all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================
# Health Check
# ========================

@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "status": "healthy",
        "service": "College Room Allocation API",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        client = get_supabase_client()
        # Simple query to verify DB connection (sync client, no await needed)
        result = client.table("rooms").select("id").limit(1).execute()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "supabase_url_set": bool(os.getenv("SUPABASE_URL")),
        "supabase_key_set": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        "timestamp": datetime.utcnow().isoformat()
    }


# ========================
# Room Management
# ========================

class RoomResponse(BaseModel):
    id: int
    room_code: str
    room_name: str
    building: str
    campus: str
    capacity: int
    room_type: str
    floor: Optional[int] = 1
    is_accessible: Optional[bool] = False


@app.get("/api/rooms", response_model=List[RoomResponse])
async def list_rooms(
    campus: Optional[str] = None,
    building: Optional[str] = None,
    room_type: Optional[str] = None,
    min_capacity: Optional[int] = None
):
    """Get all rooms with optional filtering"""
    try:
        rooms = await get_all_rooms()
        
        # Apply filters
        if campus:
            rooms = [r for r in rooms if r.get("campus") == campus]
        if building:
            rooms = [r for r in rooms if r.get("building") == building]
        if room_type:
            rooms = [r for r in rooms if r.get("room_type") == room_type]
        if min_capacity:
            rooms = [r for r in rooms if r.get("capacity", 0) >= min_capacity]
        
        return rooms
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rooms/{room_id}")
async def get_room(room_id: int):
    """Get a specific room by ID"""
    try:
        rooms = await get_all_rooms()
        room = next((r for r in rooms if r.get("id") == room_id), None)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        return room
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rooms/{room_id}/utilization")
async def get_room_utilization_stats(room_id: int, schedule_id: Optional[int] = None):
    """Get room utilization statistics"""
    try:
        stats = await get_room_utilization(room_id, schedule_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Section Management
# ========================

@app.get("/api/sections")
async def list_sections(
    department: Optional[str] = None,
    course_code: Optional[str] = None
):
    """Get all sections with optional filtering"""
    try:
        sections = await get_all_sections(department)
        
        if course_code:
            sections = [s for s in sections if s.get("course_code") == course_code]
        
        return sections
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Teacher Management
# ========================

@app.get("/api/teachers")
async def list_teachers(department: Optional[str] = None):
    """Get all teachers with optional filtering"""
    try:
        teachers = await get_all_teachers(department)
        
        return teachers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Time Slots
# ========================

@app.get("/api/time-slots")
async def list_time_slots():
    """Get all available time slots"""
    try:
        slots = await get_time_slots()
        return slots
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Schedule Generation
# ========================

class TimeSlotModel(BaseModel):
    """Time slot model"""
    id: int
    slot_name: str
    start_time: str
    end_time: str
    duration_minutes: int

class SectionDataModel(BaseModel):
    """Section data from frontend"""
    id: int
    section_code: str
    course_code: str
    course_name: str
    teacher_id: int
    teacher_name: str
    year_level: int = 1
    student_count: int
    required_room_type: str
    weekly_hours: int
    requires_lab: bool
    department: str

class RoomDataModel(BaseModel):
    """Room data from frontend"""
    id: int
    room_code: str
    room_name: str
    building: str
    campus: str
    capacity: int
    room_type: str
    floor: int
    is_accessible: bool

class ScheduleGenerationRequest(BaseModel):
    """Request model for schedule generation - accepts frontend data directly"""
    schedule_name: str
    semester: str
    academic_year: str
    section_ids: Optional[List[int]] = None  # If None, schedule all sections
    room_ids: Optional[List[int]] = None  # If None, use all rooms
    time_slots: Optional[List[TimeSlotModel]] = None  # Time slots from frontend
    active_days: Optional[List[str]] = None  # Days to schedule (Mon-Sun)
    sections_data: Optional[List[SectionDataModel]] = None  # Direct section data
    rooms_data: Optional[List[RoomDataModel]] = None  # Direct room data
    max_iterations: int = 1000
    initial_temperature: float = 100.0
    cooling_rate: float = 0.995
    max_teacher_hours_per_day: int = 6
    prioritize_accessibility: bool = False


class ScheduleGenerationResponse(BaseModel):
    """Response model for schedule generation"""
    success: bool
    schedule_id: int
    message: str
    total_sections: int
    scheduled_sections: int
    unscheduled_sections: int
    optimization_stats: Dict[str, Any]
    conflicts: List[Dict[str, Any]]
    schedule_entries: Optional[List[Dict[str, Any]]] = None  # Include entries for frontend


@app.post("/api/schedules/generate", response_model=ScheduleGenerationResponse)
async def generate_schedule(request: ScheduleGenerationRequest):
    """
    Generate a new class schedule using quantum-inspired annealing.
    
    This endpoint accepts data directly from frontend or fetches from database.
    Supports custom time slots and days configuration.
    """
    try:
        print("=" * 60)
        print("🚀 SCHEDULE GENERATION STARTED")
        print("=" * 60)
        print(f"📋 Schedule Name: {request.schedule_name}")
        print(f"📅 Semester: {request.semester} | Year: {request.academic_year}")
        
        # Use direct data from frontend if provided, otherwise fetch from database
        if request.sections_data and request.rooms_data:
            print("📦 Using data provided directly from frontend")
            sections = [s.dict() for s in request.sections_data]
            rooms = [r.dict() for r in request.rooms_data]
            
            # Use time slots from frontend if provided
            if request.time_slots:
                time_slots = [t.dict() for t in request.time_slots]
                print(f"⏰ Using {len(time_slots)} custom time slots from frontend")
            else:
                time_slots = await get_time_slots()
                print(f"⏰ Using {len(time_slots)} time slots from database")
        else:
            print("🔍 Fetching data from database")
            all_sections = await get_sections_for_scheduling()
            all_rooms = await get_all_rooms()
            time_slots = await get_time_slots()
            
            # Filter sections if specific IDs provided
            if request.section_ids:
                sections = [s for s in all_sections if s.get("id") in request.section_ids]
            else:
                sections = all_sections
            
            # Filter rooms if specific IDs provided
            if request.room_ids:
                rooms = [r for r in all_rooms if r.get("id") in request.room_ids]
            else:
                rooms = all_rooms
        
        print(f"📚 Sections to schedule: {len(sections)}")
        print(f"🏢 Available rooms: {len(rooms)}")
        print(f"⏰ Time slots: {len(time_slots)}")
        
        if not sections:
            raise HTTPException(status_code=400, detail="No sections to schedule")
        if not rooms:
            raise HTTPException(status_code=400, detail="No rooms available")
        if not time_slots:
            raise HTTPException(status_code=400, detail="No time slots defined")
        
        # Active days - use from request or default to Mon-Fri
        active_days = request.active_days if request.active_days else ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        print(f"📅 Active days: {', '.join(active_days)}")
        
        # Create schedule record first
        # Map fields to match database schema
        current_date = datetime.utcnow().date()
        schedule_record = await create_schedule_record({
            "event_name": f"{request.schedule_name} - {request.semester} {request.academic_year}",
            "event_type": "Custom",
            "schedule_date": current_date.isoformat(),
            "start_time": "07:00:00",  # Default start time
            "end_time": "19:00:00",    # Default end time
            "campus_group_id": 1,      # Default campus group (can be updated)
            "participant_group_id": 1, # Default participant group (can be updated)
            "status": "generating"
        })
        
        schedule_id = schedule_record.get("id")
        print(f"✅ Schedule record created with ID: {schedule_id}")
        
        # Configuration for scheduler
        config = {
            "max_iterations": request.max_iterations,
            "initial_temperature": request.initial_temperature,
            "cooling_rate": request.cooling_rate,
            "max_teacher_hours_per_day": request.max_teacher_hours_per_day,
            "prioritize_accessibility": request.prioritize_accessibility,
            "active_days": active_days
        }
        
        print("🎯 Running Quantum-Inspired Annealing Algorithm...")
        print(f"   Max Iterations: {config['max_iterations']}")
        print(f"   Initial Temperature: {config['initial_temperature']}")
        print(f"   Cooling Rate: {config['cooling_rate']}")
        
        # Run the scheduler
        result = run_scheduler(
            sections_data=sections,
            rooms_data=rooms,
            time_slots_data=time_slots,
            config=config
        )
        
        print(f"✅ Scheduling complete!")
        print(f"   Success: {result['success']}")
        print(f"   Scheduled: {result['scheduled_sections']}/{result['total_sections']}")
        print(f"   Unscheduled: {result['unscheduled_sections']}")
        
        # Save to generated_schedules table
        generated_schedule_data = {
            "schedule_name": request.schedule_name,
            "semester": request.semester,
            "academic_year": request.academic_year,
            "campus_group_id": 1,  # Default campus group (can be updated)
            "class_group_id": 1,   # Default class group (can be updated)
            "total_classes": result["total_sections"],
            "scheduled_classes": result["scheduled_sections"],
            "unscheduled_classes": result["unscheduled_sections"],
            "optimization_stats": result["optimization_stats"],
            "status": "completed" if result["success"] else "failed"
        }
        
        generated_schedule = await create_generated_schedule(generated_schedule_data)
        generated_schedule_id = generated_schedule.get("id")
        print(f"✅ Generated schedule record created with ID: {generated_schedule_id}")
        
        # Save room allocations
        if result["schedule_entries"] and generated_schedule_id:
            room_allocations = []
            for entry in result["schedule_entries"]:
                allocation = {
                    "schedule_id": generated_schedule_id,
                    "class_id": entry.get("section_id"),
                    "room_id": entry.get("room_id"),
                    "course_code": entry.get("course_code", ""),
                    "course_name": entry.get("course_name", ""),
                    "section": entry.get("section_code", ""),
                    "year_level": entry.get("year_level", 1),
                    "schedule_day": entry.get("day_of_week", ""),
                    "schedule_time": f"{entry.get('start_time', '')} - {entry.get('end_time', '')}",
                    "campus": entry.get("campus", ""),
                    "building": entry.get("building", ""),
                    "room": entry.get("room_code", entry.get("room_name", "")),
                    "capacity": entry.get("room_capacity", 0),
                    "teacher_name": entry.get("teacher_name", ""),
                    "department": entry.get("department", ""),
                    "lec_hours": entry.get("lec_hours", 0),
                    "lab_hours": entry.get("lab_hours", 0),
                    "status": "scheduled"
                }
                room_allocations.append(allocation)
            
            saved_allocations = await save_room_allocations(room_allocations)
            print(f"✅ Saved {len(saved_allocations)} room allocations to database")
        
        # Also update the old schedule_summary table for backward compatibility
        if result["success"]:
            await update_schedule_status(schedule_id, "completed")
        else:
            await update_schedule_status(schedule_id, "failed")
        
        print("=" * 60)
        print("🎉 SCHEDULE GENERATION COMPLETED")
        print("=" * 60)
        
        return ScheduleGenerationResponse(
            success=result["success"],
            schedule_id=generated_schedule_id if generated_schedule_id else schedule_id,
            message=result["message"],
            total_sections=result["total_sections"],
            scheduled_sections=result["scheduled_sections"],
            unscheduled_sections=result["unscheduled_sections"],
            optimization_stats=result["optimization_stats"],
            conflicts=result["conflicts"],
            schedule_entries=result["schedule_entries"]  # Include for frontend
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print("=" * 60)
        print(f"❌ ERROR: {str(e)}")
        print("=" * 60)
        raise HTTPException(status_code=500, detail=f"Schedule generation failed: {str(e)}")


@app.get("/api/schedules")
async def list_schedules():
    """Get all schedules"""
    try:
        schedules = await get_all_schedules()
        return schedules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schedules/{schedule_id}")
async def get_schedule(schedule_id: int):
    """Get a specific schedule with all entries"""
    try:
        schedule = await get_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        return schedule
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/schedules/{schedule_id}")
async def remove_schedule(schedule_id: int):
    """Delete a schedule and all its entries"""
    try:
        await delete_schedule(schedule_id)
        return {"message": "Schedule deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Generated Schedules (QIA Results with Room Allocations)
# ========================

@app.get("/api/generated-schedules")
async def list_generated_schedules():
    """Get all generated schedules with QIA results"""
    try:
        schedules = await get_generated_schedules()
        return schedules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/generated-schedules/{schedule_id}")
async def get_generated_schedule(schedule_id: int):
    """Get a specific generated schedule with all room allocations"""
    try:
        schedule = await get_generated_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Generated schedule not found")
        return schedule
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/generated-schedules/{schedule_id}/allocations")
async def get_schedule_allocations(schedule_id: int):
    """Get all room allocations for a specific generated schedule"""
    try:
        allocations = await get_room_allocations_by_schedule(schedule_id)
        return {
            "schedule_id": schedule_id,
            "allocations": allocations,
            "total": len(allocations)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/generated-schedules/{schedule_id}")
async def remove_generated_schedule(schedule_id: int):
    """Delete a generated schedule and all its room allocations"""
    try:
        await delete_generated_schedule(schedule_id)
        return {"message": "Generated schedule deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Schedule Queries
# ========================

@app.get("/api/schedules/{schedule_id}/by-room/{room_id}")
async def get_room_schedule(schedule_id: int, room_id: int):
    """Get schedule entries for a specific room"""
    try:
        schedule = await get_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        entries = schedule.get("entries", [])
        room_entries = [e for e in entries if e.get("room_id") == room_id]
        
        return {
            "room_id": room_id,
            "schedule_id": schedule_id,
            "entries": room_entries
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schedules/{schedule_id}/by-teacher/{teacher_id}")
async def get_teacher_schedule(schedule_id: int, teacher_id: int):
    """Get schedule entries for a specific teacher"""
    try:
        schedule = await get_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        entries = schedule.get("entries", [])
        teacher_entries = [e for e in entries if e.get("teacher_id") == teacher_id]
        
        return {
            "teacher_id": teacher_id,
            "schedule_id": schedule_id,
            "entries": teacher_entries
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schedules/{schedule_id}/by-section/{section_id}")
async def get_section_schedule(schedule_id: int, section_id: int):
    """Get schedule entries for a specific section"""
    try:
        schedule = await get_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        entries = schedule.get("entries", [])
        section_entries = [e for e in entries if e.get("section_id") == section_id]
        
        return {
            "section_id": section_id,
            "schedule_id": schedule_id,
            "entries": section_entries
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/schedules/{schedule_id}/by-day/{day}")
async def get_day_schedule(schedule_id: int, day: str):
    """Get schedule entries for a specific day"""
    try:
        schedule = await get_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        entries = schedule.get("entries", [])
        day_entries = [e for e in entries if e.get("day_of_week", "").lower() == day.lower()]
        
        return {
            "day": day,
            "schedule_id": schedule_id,
            "entries": day_entries
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Conflict Detection
# ========================

@app.get("/api/schedules/{schedule_id}/conflicts")
async def check_conflicts(schedule_id: int):
    """Check for conflicts in a schedule"""
    try:
        room_conflicts = await check_room_conflicts(schedule_id)
        teacher_conflicts = await check_teacher_conflicts(schedule_id)
        
        return {
            "schedule_id": schedule_id,
            "has_conflicts": len(room_conflicts) > 0 or len(teacher_conflicts) > 0,
            "room_conflicts": room_conflicts,
            "teacher_conflicts": teacher_conflicts,
            "total_conflicts": len(room_conflicts) + len(teacher_conflicts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Analytics
# ========================

@app.get("/api/analytics/room-utilization")
async def get_analytics_room_utilization(schedule_id: Optional[int] = None):
    """Get room utilization analytics"""
    try:
        rooms = await get_all_rooms()
        utilization_data = []
        
        for room in rooms:
            stats = await get_room_utilization(room["id"], schedule_id)
            utilization_data.append({
                "room_id": room["id"],
                "room_code": room.get("room_code", room.get("room", "")),
                "room_name": room.get("room_name", room.get("room", "")),
                "building": room.get("building", ""),
                "capacity": room.get("capacity", 0),
                **stats
            })
        
        # Calculate averages
        total_utilization = sum(r.get("utilization_rate", 0) for r in utilization_data)
        avg_utilization = total_utilization / len(utilization_data) if utilization_data else 0
        
        return {
            "schedule_id": schedule_id,
            "average_utilization": avg_utilization,
            "total_rooms": len(rooms),
            "rooms": utilization_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/summary")
async def get_analytics_summary(schedule_id: Optional[int] = None):
    """Get overall scheduling analytics summary"""
    try:
        rooms = await get_all_rooms()
        sections = await get_all_sections()
        teachers = await get_all_teachers()
        
        summary = {
            "total_rooms": len(rooms),
            "total_sections": len(sections),
            "total_teachers": len(teachers),
            "rooms_by_type": {},
            "rooms_by_building": {},
            "capacity_distribution": {
                "small": 0,  # < 30
                "medium": 0,  # 30-60
                "large": 0,  # 60-100
                "extra_large": 0  # > 100
            }
        }
        
        for room in rooms:
            # Count by type
            room_type = room.get("room_type", "unknown")
            summary["rooms_by_type"][room_type] = summary["rooms_by_type"].get(room_type, 0) + 1
            
            # Count by building
            building = room.get("building", "unknown")
            summary["rooms_by_building"][building] = summary["rooms_by_building"].get(building, 0) + 1
            
            # Capacity distribution
            capacity = room.get("capacity", 0)
            if capacity < 30:
                summary["capacity_distribution"]["small"] += 1
            elif capacity < 60:
                summary["capacity_distribution"]["medium"] += 1
            elif capacity < 100:
                summary["capacity_distribution"]["large"] += 1
            else:
                summary["capacity_distribution"]["extra_large"] += 1
        
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Run Server
# ========================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
